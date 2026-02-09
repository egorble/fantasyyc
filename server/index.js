/**
 * FantasyYC API Server
 * Provides leaderboard and tournament data to frontend
 */

import express from 'express';
import cors from 'cors';
import * as db from './db/database.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
        const tournament = db.getTournamentById(parseInt(req.params.id));

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

        return res.json({
            success: true,
            data: leaderboard.map(entry => ({
                rank: entry.rank,
                address: entry.player_address,
                score: entry.total_score,
                lastUpdated: entry.last_updated
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

        return res.json({
            success: true,
            data: {
                rank: rank.rank,
                score: rank.total_score,
                address: rank.player_address
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
                breakdown: JSON.parse(h.breakdown || '{}')
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
                events: JSON.parse(s.events_detected || '[]')
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
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Start server
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
});

export default app;
