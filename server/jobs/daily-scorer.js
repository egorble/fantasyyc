/**
 * Daily Tournament Scorer
 *
 * Game logic:
 * 1. Reads active tournament from blockchain (PackOpener.activeTournamentId)
 * 2. Only scores if tournament status is "active"
 * 3. Fetches ALL tweets from the scoring day for each startup (via advanced_search)
 * 4. Calculates base points per startup from tweet analysis
 * 5. For each participant: multiplies startup base points by their card rarity
 * 6. Updates leaderboard with cumulative scores
 *
 * Designed to run daily at 00:00 UTC via server scheduler.
 * Scores the PREVIOUS day (yesterday UTC).
 */

import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from '../db/database.js';
import { CHAIN, CONTRACTS } from '../config.js';
import { computeDailyScoreHmac, computeScoreHmac, computeLeaderboardHmac, computeIntegrityHash } from '../middleware/integrity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import Twitter scorer
const twitterScorerPath = join(__dirname, '../../scripts/twitter-league-scorer.js');
const { processStartupForDate, STARTUP_MAPPING } = await import(`file:///${twitterScorerPath.replace(/\\/g, '/')}`);

// ============ Blockchain config (from server/config.js) ============

const packOpenerABI = [
    'function activeTournamentId() view returns (uint256)'
];

const tournamentABI = [
    'function getTournament(uint256 tournamentId) view returns (tuple(uint256 id, uint256 registrationStart, uint256 startTime, uint256 endTime, uint256 prizePool, uint256 entryCount, uint8 status))',
    'function getTournamentParticipants(uint256 tournamentId) view returns (address[])',
    'function getUserLineup(uint256 tournamentId, address user) view returns (tuple(uint256[5] cardIds, address owner, uint256 timestamp, bool cancelled, bool claimed))',
];

const nftABI = [
    'function getCardInfo(uint256 tokenId) view returns (tuple(uint256 startupId, uint256 edition, uint8 rarity, uint256 multiplier, bool isLocked, string name))',
];

const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'EpicRare', 'Legendary'];
const RARITY_MULTIPLIERS = { Common: 1, Rare: 2, Epic: 3, EpicRare: 4, Legendary: 5 };

// ============ Blockchain reads ============

function getProvider() {
    return new ethers.JsonRpcProvider(CHAIN.RPC_URL);
}

async function getActiveTournament() {
    const provider = getProvider();
    const packOpener = new ethers.Contract(CONTRACTS.PackOpener, packOpenerABI, provider);
    const tournament = new ethers.Contract(CONTRACTS.TournamentManager, tournamentABI, provider);

    const tournamentId = await packOpener.activeTournamentId();
    if (tournamentId == 0) return null;

    const t = await tournament.getTournament(tournamentId);
    const now = Math.floor(Date.now() / 1000);
    const regStart = Number(t.registrationStart);
    const start = Number(t.startTime);
    const end = Number(t.endTime);

    let status = 'upcoming';
    if (now < regStart) status = 'upcoming';
    else if (now >= regStart && now < start) status = 'registration';
    else if (now >= start && now < end) status = 'active';
    else if (now >= end) status = 'ended';

    return {
        id: Number(tournamentId),
        startTime: start,
        endTime: end,
        registrationStart: regStart,
        prizePool: ethers.formatEther(t.prizePool),
        entryCount: Number(t.entryCount),
        status
    };
}

async function getParticipants(tournamentId) {
    const provider = getProvider();
    const tournament = new ethers.Contract(CONTRACTS.TournamentManager, tournamentABI, provider);
    const participants = await tournament.getTournamentParticipants(tournamentId);
    return participants.map(addr => addr.toLowerCase());
}

async function getPlayerCards(tournamentId, playerAddress) {
    const provider = getProvider();
    const tournament = new ethers.Contract(CONTRACTS.TournamentManager, tournamentABI, provider);
    const nft = new ethers.Contract(CONTRACTS.UnicornX_NFT, nftABI, provider);

    const lineup = await tournament.getUserLineup(tournamentId, playerAddress);
    const cards = [];

    for (const tokenId of lineup.cardIds) {
        if (tokenId == 0) continue;
        const info = await nft.getCardInfo(tokenId);
        cards.push({
            tokenId: Number(tokenId),
            name: info.name,
            rarity: RARITY_NAMES[info.rarity] || 'Common',
            multiplier: Number(info.multiplier)
        });
    }

    return cards;
}

// ============ Scoring logic ============

function calculatePlayerScore(playerCards, startupBaseScores) {
    let totalPoints = 0;
    const breakdown = {};

    for (const card of playerCards) {
        const baseScore = startupBaseScores[card.name] || 0;
        const multiplier = RARITY_MULTIPLIERS[card.rarity] || 1;
        const cardPoints = baseScore * multiplier;

        totalPoints += cardPoints;
        breakdown[card.name] = {
            basePoints: baseScore,
            rarity: card.rarity,
            multiplier,
            totalPoints: cardPoints
        };
    }

    return { totalPoints, breakdown };
}

/**
 * Get yesterday's date string in UTC (YYYY-MM-DD).
 * Since this runs at 00:00 UTC, "yesterday" is the day we're scoring.
 */
function getYesterdayUTC() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
}

// ============ Main scoring function ============

/**
 * Run daily scoring for the active tournament.
 * @param {string} [dateOverride] - Optional date to score (YYYY-MM-DD). Defaults to yesterday UTC.
 */
async function runDailyScoring(dateOverride) {
    const scoringDate = dateOverride || getYesterdayUTC();
    console.log(`\n--- Daily Scorer ---`);
    console.log(`Scoring date: ${scoringDate}`);

    // 1. Get active tournament from blockchain
    console.log('\n[1] Fetching active tournament from chain...');
    let tournament;
    try {
        tournament = await getActiveTournament();
    } catch (error) {
        console.error('Failed to read tournament from chain:', error.message);
        return;
    }

    if (!tournament) {
        console.log('No active tournament found on chain. Skipping.');
        return;
    }

    if (tournament.status !== 'active') {
        console.log(`Tournament #${tournament.id} status is "${tournament.status}". Scoring only runs for "active" tournaments. Skipping.`);
        return;
    }

    console.log(`Tournament #${tournament.id} | status=${tournament.status} | players=${tournament.entryCount} | pool=${tournament.prizePool} XTZ`);

    // Sync tournament to DB
    db.saveTournament(tournament);

    // Check if this date was already scored (prevent double scoring)
    const existingScores = db.getDailyScores(tournament.id, scoringDate);
    if (existingScores.length > 0) {
        console.log(`Date ${scoringDate} already has ${existingScores.length} startup scores for tournament #${tournament.id}. Skipping to avoid duplicates.`);
        return;
    }

    // 2. Get participants from blockchain
    console.log('\n[2] Fetching participants from chain...');
    let participants;
    try {
        participants = await getParticipants(tournament.id);
    } catch (error) {
        console.error('Failed to read participants:', error.message);
        participants = [];
    }
    console.log(`Found ${participants.length} participants`);

    for (const p of participants) {
        db.saveTournamentEntry(tournament.id, p);
    }

    // 3. Fetch & score tweets for all startups
    console.log('\n[3] Scoring startups from Twitter...');
    const startupBaseScores = {};
    const handles = Object.keys(STARTUP_MAPPING);

    for (let i = 0; i < handles.length; i++) {
        const handle = handles[i];
        const name = STARTUP_MAPPING[handle];
        console.log(`\n  [${i + 1}/${handles.length}] @${handle} (${name})`);

        try {
            const result = await processStartupForDate(handle, scoringDate);
            startupBaseScores[name] = result.totalPoints;

            console.log(`  -> ${result.tweetCount} tweets, ${result.totalPoints} pts`);

            // Save daily score with HMAC
            const dailyHmac = computeDailyScoreHmac({
                tournamentId: tournament.id,
                startupName: name,
                date: scoringDate,
                basePoints: result.totalPoints,
                tweetsAnalyzed: result.tweetCount
            });
            db.saveDailyScore(
                tournament.id,
                name,
                scoringDate,
                result.totalPoints,
                result.tweetCount,
                result.tweets.flatMap(t => t.events),
                dailyHmac
            );

            // Save events to live feed
            for (const tweet of result.tweets) {
                for (const event of (tweet.events || [])) {
                    db.saveLiveFeedEvent(
                        name,
                        event.type,
                        tweet.text ? tweet.text.substring(0, 200) : `${name}: ${event.type}`,
                        event.score || 0,
                        tweet.id || null,
                        scoringDate
                    );
                }
            }
        } catch (error) {
            console.error(`  Error scoring ${name}: ${error.message}`);
            startupBaseScores[name] = 0;
        }

        // Rate limit between startups
        if (i < handles.length - 1) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // 3b. Build integrity hash chain for this day's scores
    try {
        const scoresJson = JSON.stringify(
            Object.entries(startupBaseScores).sort(([a], [b]) => a.localeCompare(b))
        );
        const previousHash = db.getLatestIntegrityHash(tournament.id);
        const integrityHash = computeIntegrityHash(tournament.id, scoringDate, scoresJson, previousHash);
        db.setConfig(`integrity_latest_${tournament.id}`, JSON.stringify({
            hash: integrityHash,
            previousHash: previousHash || 'GENESIS',
            date: scoringDate
        }));
        console.log(`  Integrity chain: ${integrityHash.substring(0, 16)}...`);
    } catch (e) {
        console.error('  Integrity hash error:', e.message);
    }

    // 4. Calculate player scores
    console.log('\n[4] Calculating player scores...');

    for (const participant of participants) {
        try {
            const cards = await getPlayerCards(tournament.id, participant);

            if (cards.length === 0) {
                console.log(`  ${participant.substring(0, 10)}... - no cards, skipping`);
                continue;
            }

            // Save cards to DB
            db.savePlayerCards(tournament.id, participant, cards);

            // Calculate today's score
            const { totalPoints, breakdown } = calculatePlayerScore(cards, startupBaseScores);

            // Save daily score history with HMAC
            const scoreHmac = computeScoreHmac({
                tournamentId: tournament.id,
                playerAddress: participant,
                date: scoringDate,
                points: totalPoints,
                breakdown
            });
            db.saveScoreHistory(tournament.id, participant, scoringDate, totalPoints, breakdown, scoreHmac);

            // Recalculate total from all days
            const history = db.getPlayerScoreHistory(tournament.id, participant);
            const totalScore = history.reduce((sum, h) => sum + h.points_earned, 0);

            // Update leaderboard with HMAC
            const leaderboardHmac = computeLeaderboardHmac({
                tournamentId: tournament.id,
                playerAddress: participant,
                totalScore
            });
            db.updateLeaderboard(tournament.id, participant, totalScore, leaderboardHmac);

            console.log(`  ${participant.substring(0, 10)}... - today: ${totalPoints.toFixed(1)} | total: ${totalScore.toFixed(1)}`);
        } catch (error) {
            console.error(`  Error for ${participant.substring(0, 10)}...: ${error.message}`);
        }
    }

    // 5. Print leaderboard
    const leaderboard = db.getLeaderboard(tournament.id, 10);
    if (leaderboard.length > 0) {
        console.log('\n[5] Leaderboard:');
        leaderboard.forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry.address.substring(0, 10)}... - ${entry.score.toFixed(1)} pts`);
        });
    }

    // Save to disk
    db.saveDatabase();
    console.log('\nScoring complete. DB saved.');
}

export { runDailyScoring };
