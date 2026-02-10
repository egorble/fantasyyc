/**
 * Daily Tournament Scorer
 * Fetches Twitter data, calculates points with card multipliers, updates leaderboard
 */

import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import Twitter scorer
const twitterScorerPath = join(__dirname, '../../scripts/twitter-league-scorer.js');
const { processStartup } = await import(`file:///${twitterScorerPath.replace(/\\/g, '/')}`);

// Blockchain configuration
const RPC_URL = 'https://node.shadownet.etherlink.com'; // Etherlink Shadownet Testnet
const PACK_OPENER_ADDRESS = '0x638B92a58a8317e5f47247B5bD47cb16faA87eD9';
const TOURNAMENT_ADDRESS = '0x6036a89aE64cd3A1404E0e093A80622E949942d0';
const NFT_ADDRESS = '0x757e1f6f8c52Cd367fa42cb305de227CDC308140';

// ABIs (minimal needed for scoring)
const packOpenerABI = [
    'function activeTournamentId() view returns (uint256)'
];

const tournamentABI = [
    'function getTournament(uint256 tournamentId) view returns (tuple(uint256 id, uint256 registrationStart, uint256 startTime, uint256 endTime, uint256 prizePool, uint256 entryCount, uint8 status))',
    'function getTournamentParticipants(uint256 tournamentId) view returns (address[])',
    'function getUserLineup(uint256 tournamentId, address user) view returns (tuple(uint256[5] cardIds, address owner, uint256 timestamp, bool cancelled, bool claimed))',
    'function nextTournamentId() view returns (uint256)'
];

const nftABI = [
    'function getCardInfo(uint256 tokenId) view returns (tuple(uint256 startupId, uint256 edition, uint8 rarity, uint256 multiplier, bool isLocked, string name))',
    'function startups(uint256 id) view returns (tuple(string name, uint8 rarity, uint256 multiplier))'
];

// Rarity multipliers
const RARITY_MULTIPLIERS = {
    'Common': 1,
    'Rare': 2,
    'Epic': 3,
    'EpicRare': 4,
    'Legendary': 5
};

// Startup name mapping (Twitter handle -> Startup name)
const STARTUP_MAPPING = {
    'OpenAI': 'OpenAI',
    'AnthropicAI': 'Anthropic',
    'stripe': 'Stripe',
    'Rippling': 'Rippling',
    'deel': 'Deel',
    'brexHQ': 'Brex',
    'mercury': 'Mercury',
    'tryramp': 'Ramp',
    'retool': 'Retool',
    'vercel': 'Vercel',
    'linear': 'Linear',
    'NotionHQ': 'Notion',
    'figma': 'Figma',
    'airtable': 'Airtable',
    'Superhuman': 'Superhuman',
    'scale_AI': 'Scale AI',
    'Instacart': 'Instacart',
    'DoorDash': 'DoorDash',
    'coinbase': 'Coinbase'
};

/**
 * Get active tournament from blockchain
 */
async function getActiveTournamentFromBlockchain() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const packOpener = new ethers.Contract(PACK_OPENER_ADDRESS, packOpenerABI, provider);
    const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, tournamentABI, provider);

    try {
        // Get active tournament ID from PackOpener
        const tournamentId = await packOpener.activeTournamentId();

        if (tournamentId == 0) {
            console.log('No active tournament set');
            return null;
        }

        // Get tournament details
        const tournamentData = await tournament.getTournament(tournamentId);

        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = Number(tournamentData.startTime);
        const endTime = Number(tournamentData.endTime);
        const registrationStart = Number(tournamentData.registrationStart);

        let status = 'upcoming';
        if (currentTime < registrationStart) status = 'upcoming';
        else if (currentTime >= registrationStart && currentTime < startTime) status = 'registration';
        else if (currentTime >= startTime && currentTime < endTime) status = 'active';
        else if (currentTime >= endTime) status = 'ended';

        return {
            id: Number(tournamentId),
            startTime,
            endTime,
            registrationStart,
            prizePool: ethers.formatEther(tournamentData.prizePool),
            entryCount: Number(tournamentData.entryCount),
            status
        };
    } catch (error) {
        console.error('Error fetching tournament:', error);
        return null;
    }
}

/**
 * Get tournament entries from blockchain
 */
async function getTournamentEntriesFromBlockchain(tournamentId) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, tournamentABI, provider);

    try {
        const participants = await tournament.getTournamentParticipants(tournamentId);
        return participants.map(addr => addr.toLowerCase());
    } catch (error) {
        console.error('Error fetching entries:', error);
        return [];
    }
}

/**
 * Get player's locked cards from blockchain
 */
async function getPlayerCards(tournamentId, playerAddress) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, tournamentABI, provider);
    const nft = new ethers.Contract(NFT_ADDRESS, nftABI, provider);

    try {
        const lineup = await tournament.getUserLineup(tournamentId, playerAddress);
        const cardIds = lineup.cardIds;

        const cards = [];
        for (const tokenId of cardIds) {
            if (tokenId == 0) continue; // Skip empty slots

            const cardInfo = await nft.getCardInfo(tokenId);
            cards.push({
                tokenId: Number(tokenId),
                name: cardInfo.name,
                rarity: getRarityName(cardInfo.rarity),
                multiplier: Number(cardInfo.multiplier)
            });
        }

        return cards;
    } catch (error) {
        console.error(`Error fetching cards for ${playerAddress}:`, error);
        return [];
    }
}

// Helper function to convert rarity number to name
function getRarityName(rarityNum) {
    const rarities = ['Common', 'Rare', 'Epic', 'EpicRare', 'Legendary'];
    return rarities[rarityNum] || 'Common';
}

/**
 * Calculate player score for the day
 */
function calculatePlayerScore(playerCards, dailyScores) {
    let totalPoints = 0;
    const breakdown = {};

    for (const card of playerCards) {
        const startupScore = dailyScores[card.name] || 0;
        const rarityMultiplier = RARITY_MULTIPLIERS[card.rarity] || 1;
        const cardPoints = startupScore * rarityMultiplier;

        totalPoints += cardPoints;
        breakdown[card.name] = {
            basePoints: startupScore,
            rarity: card.rarity,
            multiplier: rarityMultiplier,
            totalPoints: cardPoints
        };
    }

    return { totalPoints, breakdown };
}

/**
 * Main scoring function
 */
async function runDailyScoring() {
    console.log('🚀 Daily Tournament Scorer Started');
    console.log('━'.repeat(60));
    console.log(`📅 Date: ${new Date().toISOString().split('T')[0]}`);

    // Initialize database
    await db.initDatabase();

    // 1. Get active tournament
    console.log('\n📊 Step 1: Fetching active tournament...');
    const tournament = await getActiveTournamentFromBlockchain();

    if (!tournament) {
        console.log('❌ No active tournament found');
        return;
    }

    if (tournament.status !== 'active') {
        console.log(`⚠️  Tournament status is "${tournament.status}", not "active". Skipping scoring.`);
        return;
    }

    console.log(`✅ Found active tournament #${tournament.id}`);
    console.log(`   Participants: ${tournament.entryCount}`);

    // Save tournament to DB
    db.saveTournament(tournament);

    // 2. Get tournament participants
    console.log('\n👥 Step 2: Fetching tournament participants...');
    const participants = await getTournamentEntriesFromBlockchain(tournament.id);
    console.log(`✅ Found ${participants.length} participants`);

    // Save entries to DB
    for (const participant of participants) {
        db.saveTournamentEntry(tournament.id, participant);
    }

    // 3. Fetch Twitter scores for all startups
    console.log('\n🐦 Step 3: Fetching Twitter scores...');
    const dailyScores = {};
    const startupNames = Object.keys(STARTUP_MAPPING);

    for (let i = 0; i < startupNames.length; i++) {
        const twitterHandle = startupNames[i];
        const startupName = STARTUP_MAPPING[twitterHandle];

        console.log(`\n   [${i + 1}/${startupNames.length}] Processing @${twitterHandle} (${startupName})...`);

        const result = await processStartup(twitterHandle, true);

        if (result.isStub || result.error) {
            console.log(`   ⚠️  Skipped (${result.message || result.error})`);
            dailyScores[startupName] = 0;
        } else {
            dailyScores[startupName] = result.totalPoints;
            console.log(`   ✅ Score: ${result.totalPoints} points`);

            // Save to daily_scores table
            const today = new Date().toISOString().split('T')[0];
            db.saveDailyScore(
                tournament.id,
                startupName,
                today,
                result.totalPoints,
                result.tweets.length,
                result.tweets.flatMap(t => t.events)
            );

            // Save events to live feed
            if (result.tweets && result.tweets.length > 0) {
                for (const tweet of result.tweets) {
                    if (tweet.events && tweet.events.length > 0) {
                        for (const event of tweet.events) {
                            const description = tweet.text
                                ? tweet.text.substring(0, 200)
                                : `${startupName}: ${event} detected`;
                            db.saveLiveFeedEvent(
                                startupName,
                                event,
                                description,
                                tweet.points || result.totalPoints,
                                tweet.id || null,
                                today
                            );
                        }
                    }
                }
            }
        }

        // Delay for rate limiting
        if (i < startupNames.length - 1) {
            console.log('   ⏳ Waiting 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    // 4. Calculate scores for all participants
    console.log('\n🎯 Step 4: Calculating participant scores...');
    const today = new Date().toISOString().split('T')[0];

    for (const participant of participants) {
        console.log(`\n   Player: ${participant}`);

        // Get player's cards
        const cards = await getPlayerCards(tournament.id, participant);
        console.log(`   Cards: ${cards.length}`);

        if (cards.length === 0) {
            console.log('   ⚠️  No cards found, skipping');
            continue;
        }

        // Save cards to DB
        db.saveTournamentCards(tournament.id, participant, cards);

        // Calculate score
        const { totalPoints, breakdown } = calculatePlayerScore(cards, dailyScores);
        console.log(`   Points earned today: ${totalPoints.toFixed(2)}`);

        // Save score history
        db.saveScoreHistory(tournament.id, participant, today, totalPoints, breakdown);

        // Update total score in leaderboard
        const history = db.getPlayerScoreHistory(tournament.id, participant);
        const totalScore = history.reduce((sum, h) => sum + h.points_earned, 0);

        db.updateLeaderboard(tournament.id, participant, totalScore);
        console.log(`   Total score: ${totalScore.toFixed(2)}`);
    }

    // 5. Display leaderboard
    console.log('\n\n🏆 LEADERBOARD');
    console.log('━'.repeat(60));
    const leaderboard = db.getLeaderboard(tournament.id, 10);

    leaderboard.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.player_address.substring(0, 10)}... - ${entry.total_score.toFixed(2)} pts`);
    });

    console.log('\n✅ Daily scoring complete!');
    console.log('━'.repeat(60));
}

// Run if called directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
    runDailyScoring()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { runDailyScoring };
