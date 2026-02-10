/**
 * FantasyYC API Server
 * Provides leaderboard and tournament data to frontend
 */

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ethers } from 'ethers';
import * as db from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ============= API ROUTES =============

/**
 * GET /api/tournaments/active
 * Get current active tournament
 */
app.get('/api/tournaments/active', (req, res) => {
    try {
        const tournament = db.getActiveTournament();

        if (!tournament) {
            return res.json({
                success: false,
                message: 'No active tournament'
            });
        }

        return res.json({
            success: true,
            data: {
                id: tournament.blockchain_id,
                startTime: tournament.start_time,
                endTime: tournament.end_time,
                prizePool: tournament.prize_pool,
                entryCount: tournament.entry_count,
                status: tournament.status
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/tournaments/:id
 * Get specific tournament by ID
 */
app.get('/api/tournaments/:id', (req, res) => {
    try {
        const tournament = db.getTournament(parseInt(req.params.id));

        if (!tournament) {
            return res.status(404).json({
                success: false,
                message: 'Tournament not found'
            });
        }

        return res.json({
            success: true,
            data: {
                id: tournament.blockchain_id,
                startTime: tournament.start_time,
                endTime: tournament.end_time,
                prizePool: tournament.prize_pool,
                entryCount: tournament.entry_count,
                status: tournament.status
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/leaderboard/:tournamentId
 * Get leaderboard for a tournament
 */
app.get('/api/leaderboard/:tournamentId', (req, res) => {
    try {
        const tournamentId = parseInt(req.params.tournamentId);
        const limit = parseInt(req.query.limit) || 100;

        const leaderboard = db.getLeaderboard(tournamentId, limit);

        // Enrich with user profile data
        const addresses = leaderboard.map(e => e.address);
        const profiles = db.getUserProfiles(addresses);
        const profileMap = {};
        profiles.forEach(p => { profileMap[p.address] = p; });

        const enriched = leaderboard.map(entry => ({
            ...entry,
            username: profileMap[entry.address]?.username || null,
            avatar: profileMap[entry.address]?.avatar_url || null,
        }));

        return res.json({
            success: true,
            data: enriched
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/player/:address/rank/:tournamentId
 * Get player's rank in a tournament
 */
app.get('/api/player/:address/rank/:tournamentId', (req, res) => {
    try {
        const { address, tournamentId } = req.params;
        const rank = db.getPlayerRank(parseInt(tournamentId), address.toLowerCase());

        if (!rank) {
            return res.json({
                success: false,
                message: 'Player not found in tournament'
            });
        }

        // getPlayerRank already returns mapped data
        return res.json({
            success: true,
            data: rank
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/player/:address/history/:tournamentId
 * Get player's score history
 */
app.get('/api/player/:address/history/:tournamentId', (req, res) => {
    try {
        const { address, tournamentId } = req.params;
        const history = db.getPlayerScoreHistory(parseInt(tournamentId), address.toLowerCase());

        return res.json({
            success: true,
            data: history.map(h => ({
                date: h.date,
                points: h.points_earned,
                breakdown: h.breakdown || {}
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/player/:address/cards/:tournamentId
 * Get player's cards in tournament
 */
app.get('/api/player/:address/cards/:tournamentId', (req, res) => {
    try {
        const { address, tournamentId } = req.params;
        const cards = db.getPlayerCards(parseInt(tournamentId), address.toLowerCase());

        return res.json({
            success: true,
            data: cards.map(c => ({
                tokenId: c.token_id,
                name: c.startup_name,
                rarity: c.rarity,
                multiplier: c.multiplier,
                lockedAt: c.locked_at
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/stats/:tournamentId
 * Get tournament statistics
 */
app.get('/api/stats/:tournamentId', (req, res) => {
    try {
        const stats = db.getTournamentStats(parseInt(req.params.tournamentId));

        return res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/daily-scores/:tournamentId/:date
 * Get daily startup scores for a specific date
 */
app.get('/api/daily-scores/:tournamentId/:date', (req, res) => {
    try {
        const { tournamentId, date } = req.params;
        const scores = db.getDailyScores(parseInt(tournamentId), date);

        return res.json({
            success: true,
            data: scores.map(s => ({
                startup: s.startup_name,
                points: s.base_points,
                tweetsAnalyzed: s.tweets_analyzed,
                events: s.events_detected || []
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/top-startups/:tournamentId
 * Get top startups by points in a tournament
 */
app.get('/api/top-startups/:tournamentId', (req, res) => {
    try {
        const tournamentId = parseInt(req.params.tournamentId);
        const limit = parseInt(req.query.limit) || 5;
        const startups = db.getTopStartups(tournamentId, limit);

        return res.json({
            success: true,
            data: startups.map(s => ({
                name: s.startup_name,
                points: s.total_points
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/live-feed
 * Get latest live feed events from tweet analysis
 */
app.get('/api/live-feed', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const events = db.getLiveFeed(limit);

        return res.json({
            success: true,
            data: events.map(e => ({
                id: e.id,
                startup: e.startup_name,
                eventType: e.event_type,
                description: e.description,
                points: e.points,
                date: e.date,
                createdAt: e.created_at
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/users/register
 * Register a new user profile
 */
app.post('/api/users/register', (req, res) => {
    try {
        const { address, username, avatar, referrer } = req.body;

        if (!address || !username) {
            return res.status(400).json({
                success: false,
                error: 'Missing address or username'
            });
        }

        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3-20 characters'
            });
        }

        const isNew = !db.isUserRegistered(address);
        db.saveUserProfile(address, username, avatar || null);

        // Also save to players table
        db.savePlayer(address.toLowerCase());

        // Track referral if this is a new user with a referrer
        if (isNew && referrer && referrer.toLowerCase() !== address.toLowerCase()) {
            db.saveReferral(
                referrer.toLowerCase(),
                address.toLowerCase(),
                null,
                '0'
            );
        }

        // Persist immediately so data survives server restarts
        db.saveDatabase();

        return res.json({
            success: true,
            isNew,
            data: {
                address: address.toLowerCase(),
                username,
                avatar: avatar || null
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/users/:address
 * Get user profile
 */
app.get('/api/users/:address', (req, res) => {
    try {
        const address = req.params.address.toLowerCase();
        const profile = db.getUserProfile(address);

        if (!profile) {
            return res.json({
                success: false,
                message: 'User not found'
            });
        }

        return res.json({
            success: true,
            data: {
                address: profile.address,
                username: profile.username,
                avatar: profile.avatar_url,
                createdAt: profile.created_at
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/users/:address
 * Update user profile
 */
app.put('/api/users/:address', (req, res) => {
    try {
        const address = req.params.address.toLowerCase();
        const { username, avatar } = req.body;

        if (!username || username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                error: 'Username must be 3-20 characters'
            });
        }

        if (!db.isUserRegistered(address)) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        db.updateUserProfile(address, username, avatar || null);

        // Persist immediately
        db.saveDatabase();

        return res.json({
            success: true,
            data: {
                address,
                username,
                avatar: avatar || null
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/users/bulk
 * Get multiple user profiles by addresses
 */
app.post('/api/users/bulk', (req, res) => {
    try {
        const { addresses } = req.body;

        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({
                success: false,
                error: 'Missing addresses array'
            });
        }

        const profiles = db.getUserProfiles(addresses);

        return res.json({
            success: true,
            data: profiles.map(p => ({
                address: p.address,
                username: p.username,
                avatar: p.avatar_url
            }))
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/referrals/:address
 * Get referral stats for a user
 */
app.get('/api/referrals/:address', (req, res) => {
    try {
        const address = req.params.address.toLowerCase();
        const stats = db.getReferralStats(address);
        const referrals = db.getReferralsByReferrer(address);

        return res.json({
            success: true,
            data: {
                totalReferrals: stats?.total_referrals || 0,
                totalEarned: stats?.total_earned || 0,
                referrals: referrals.map(r => ({
                    referred: r.referred_address,
                    earned: r.amount_earned,
                    date: r.created_at
                }))
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/referrals/track
 * Track a referral from pack purchase
 */
app.post('/api/referrals/track', (req, res) => {
    try {
        const { referrer, referred, packId, amount } = req.body;

        if (!referrer || !referred) {
            return res.status(400).json({
                success: false,
                error: 'Missing referrer or referred address'
            });
        }

        db.saveReferral(
            referrer.toLowerCase(),
            referred.toLowerCase(),
            packId,
            amount || '0'
        );

        return res.json({
            success: true,
            message: 'Referral tracked'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /api/run-scorer
 * Trigger daily scoring (runs within server process to share DB).
 * Body: { date?: "YYYY-MM-DD" } - optional, defaults to yesterday UTC.
 */
app.post('/api/run-scorer', async (req, res) => {
    try {
        const { runDailyScoring } = await import('./jobs/daily-scorer.js');
        const date = req.body?.date || undefined;
        console.log(`Scorer triggered via API${date ? ` for date ${date}` : ''}`);
        // Run scorer async, respond immediately
        runDailyScoring(date).then(() => {
            db.saveDatabase();
            console.log('Scorer complete, DB saved');
        }).catch(err => {
            console.error('Scorer error:', err.message);
        });
        return res.json({ success: true, message: 'Scorer started', date: date || 'yesterday' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ============= BLOCKCHAIN SYNC =============
const RPC_URL = 'https://node.shadownet.etherlink.com';
const PACK_OPENER_ADDRESS = '0x8A35cbe95CD07321CE4f0C73dC2518AAc5b28554';
const TOURNAMENT_ADDRESS = '0xfF528538033a55C7b9C23608eB3d15e2387E0d61';

async function syncTournamentFromBlockchain() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const packOpener = new ethers.Contract(PACK_OPENER_ADDRESS, [
            'function activeTournamentId() view returns (uint256)',
        ], provider);
        const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, [
            'function getTournament(uint256 id) view returns (tuple(uint256 id, uint256 registrationStart, uint256 startTime, uint256 endTime, uint256 prizePool, uint256 entryCount, uint8 status))',
            'function nextTournamentId() view returns (uint256)',
        ], provider);

        const activeId = Number(await packOpener.activeTournamentId());
        if (activeId === 0) {
            console.log('   No active tournament on chain');
            return;
        }

        const t = await tournament.getTournament(activeId);
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = Number(t.startTime);
        const endTime = Number(t.endTime);
        const registrationStart = Number(t.registrationStart);

        let status = 'upcoming';
        if (currentTime < registrationStart) status = 'upcoming';
        else if (currentTime >= registrationStart && currentTime < startTime) status = 'registration';
        else if (currentTime >= startTime && currentTime < endTime) status = 'active';
        else if (currentTime >= endTime) status = 'ended';

        // Mark any other tournaments as ended (handles contract redeployments)
        db.deactivateOtherTournaments(activeId);

        db.saveTournament({
            id: activeId,
            startTime,
            endTime,
            prizePool: ethers.formatEther(t.prizePool),
            entryCount: Number(t.entryCount),
            status,
        });

        console.log(`   Tournament #${activeId}: ${status}, pool=${ethers.formatEther(t.prizePool)} XTZ, players=${Number(t.entryCount)}`);
    } catch (error) {
        console.error('   Failed to sync tournament:', error.message);
    }
}

// ============= DAILY SCORER SCHEDULER =============

function scheduleDailyScorer() {
    function msUntilMidnightUTC() {
        const now = new Date();
        const nextMidnight = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            0, 0, 10 // 10 seconds past midnight to be safe
        ));
        return nextMidnight.getTime() - now.getTime();
    }

    async function runScorer() {
        try {
            const { runDailyScoring } = await import('./jobs/daily-scorer.js');
            console.log('[CRON] Daily scorer triggered at', new Date().toISOString());
            await runDailyScoring(); // defaults to yesterday
            db.saveDatabase();
            console.log('[CRON] Daily scorer complete');
        } catch (err) {
            console.error('[CRON] Scorer error:', err.message);
        }
    }

    const delay = msUntilMidnightUTC();
    const hours = Math.floor(delay / 3600000);
    const mins = Math.floor((delay % 3600000) / 60000);
    console.log(`Daily scorer scheduled: next run in ${hours}h ${mins}m (00:00 UTC)`);

    // First run at next midnight, then every 24h
    setTimeout(() => {
        runScorer();
        setInterval(runScorer, 24 * 60 * 60 * 1000);
    }, delay);
}

// Start server with database initialization
async function startServer() {
    try {
        // Initialize database
        const rawDb = await db.initDatabase();
        console.log('✅ Database initialized');

        // Run schema to ensure all tables exist
        const schema = readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf-8');
        const statements = schema.split(';').filter(s => s.trim());
        statements.forEach(statement => {
            if (statement.trim()) {
                rawDb.run(statement);
            }
        });
        db.saveDatabase();
        console.log('✅ Schema applied');

        // Sync tournament from blockchain
        console.log('🔗 Syncing tournament from blockchain...');
        await syncTournamentFromBlockchain();
        console.log('✅ Blockchain sync complete');

        // Periodic sync every 60 seconds
        setInterval(syncTournamentFromBlockchain, 60000);

        // Schedule daily scorer at 00:00 UTC
        scheduleDailyScorer();

        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 FantasyYC API Server running on port ${PORT}`);
            console.log(`📊 Endpoints:`);
            console.log(`   GET /api/tournaments/active`);
            console.log(`   GET /api/tournaments/:id`);
            console.log(`   GET /api/leaderboard/:tournamentId`);
            console.log(`   GET /api/player/:address/rank/:tournamentId`);
            console.log(`   GET /api/player/:address/history/:tournamentId`);
            console.log(`   GET /api/player/:address/cards/:tournamentId`);
            console.log(`   GET /api/stats/:tournamentId`);
            console.log(`   GET /api/daily-scores/:tournamentId/:date`);
            console.log(`   GET /api/live-feed`);
            console.log(`   POST /api/users/register`);
            console.log(`   GET /api/users/:address`);
            console.log(`   PUT /api/users/:address`);
            console.log(`   POST /api/users/bulk`);
            console.log(`   GET /api/referrals/:address`);
            console.log(`   POST /api/referrals/track`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

export default app;
