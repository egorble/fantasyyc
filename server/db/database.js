/**
 * Database module using sql.js (pure JavaScript, no Python needed)
 */

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'fantasyyc.db');

let SQL;
let db;

/**
 * Initialize database connection
 */
export async function initDatabase(forceReload = false) {
    if (db && !forceReload) return db;

    if (!SQL) {
        SQL = await initSqlJs();
    }

    // Load existing database or create new one
    if (existsSync(DB_PATH)) {
        const buffer = readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
        console.log('✅ Database loaded from file');
    } else {
        db = new SQL.Database();
        console.log('✅ New database created');
    }

    return db;
}

/**
 * Save database to disk
 */
function saveDatabase() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
}

/**
 * Execute a query that doesn't return data (INSERT, UPDATE, DELETE)
 */
function exec(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    db.run(sql, params);
    saveDatabase();
}

/**
 * Execute a query that returns a single row
 */
function get(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
}

/**
 * Execute a query that returns multiple rows
 */
function all(sql, params = []) {
    if (!db) throw new Error('Database not initialized');
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

// ============ Tournament Functions ============

export function saveTournament(tournament) {
    const sql = `
        INSERT OR REPLACE INTO tournaments
        (blockchain_id, start_time, end_time, prize_pool, entry_count, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    exec(sql, [
        tournament.id,
        tournament.startTime,
        tournament.endTime,
        tournament.prizePool,
        tournament.entryCount,
        tournament.status
    ]);
}

export function getTournament(blockchainId) {
    return get('SELECT * FROM tournaments WHERE blockchain_id = ?', [blockchainId]);
}

export function getAllTournaments() {
    return all('SELECT * FROM tournaments ORDER BY blockchain_id DESC');
}

export function getActiveTournament() {
    return get(`
        SELECT * FROM tournaments
        WHERE status = 'active'
        ORDER BY blockchain_id DESC
        LIMIT 1
    `);
}

export function updateTournamentStatus(blockchainId, status) {
    exec('UPDATE tournaments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE blockchain_id = ?',
        [status, blockchainId]);
}

export function updateTournamentEntryCount(blockchainId, count) {
    exec('UPDATE tournaments SET entry_count = ?, updated_at = CURRENT_TIMESTAMP WHERE blockchain_id = ?',
        [count, blockchainId]);
}

// ============ Player Functions ============

export function savePlayer(address) {
    exec('INSERT OR IGNORE INTO players (address) VALUES (?)', [address]);
}

export function getPlayer(address) {
    return get('SELECT * FROM players WHERE address = ?', [address]);
}

// ============ Tournament Entry Functions ============

export function saveTournamentEntry(tournamentId, playerAddress) {
    exec('INSERT OR IGNORE INTO tournament_entries (tournament_id, player_address) VALUES (?, ?)',
        [tournamentId, playerAddress]);
}

export function getTournamentEntries(tournamentId) {
    return all('SELECT * FROM tournament_entries WHERE tournament_id = ?', [tournamentId]);
}

export function hasPlayerEntered(tournamentId, playerAddress) {
    const result = get(
        'SELECT COUNT(*) as count FROM tournament_entries WHERE tournament_id = ? AND player_address = ?',
        [tournamentId, playerAddress]
    );
    return result.count > 0;
}

// ============ Tournament Cards Functions ============

export function savePlayerCards(tournamentId, playerAddress, cards) {
    // First delete existing cards for this player in this tournament
    exec('DELETE FROM tournament_cards WHERE tournament_id = ? AND player_address = ?',
        [tournamentId, playerAddress]);

    // Insert new cards
    for (const card of cards) {
        exec(`
            INSERT INTO tournament_cards
            (tournament_id, player_address, token_id, startup_name, rarity, multiplier)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [tournamentId, playerAddress, card.tokenId, card.name, card.rarity, card.multiplier]);
    }
}

export function getPlayerCards(tournamentId, playerAddress) {
    return all(`
        SELECT * FROM tournament_cards
        WHERE tournament_id = ? AND player_address = ?
    `, [tournamentId, playerAddress]);
}

export function getAllTournamentCards(tournamentId) {
    return all('SELECT * FROM tournament_cards WHERE tournament_id = ?', [tournamentId]);
}

// ============ Daily Scores Functions ============

export function saveDailyScore(tournamentId, startupName, date, basePoints, tweetsAnalyzed, events) {
    const eventsJson = JSON.stringify(events);
    exec(`
        INSERT OR REPLACE INTO daily_scores
        (tournament_id, startup_name, date, base_points, tweets_analyzed, events_detected)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [tournamentId, startupName, date, basePoints, tweetsAnalyzed, eventsJson]);
}

export function getDailyScores(tournamentId, date) {
    const rows = all(`
        SELECT * FROM daily_scores
        WHERE tournament_id = ? AND date = ?
    `, [tournamentId, date]);

    return rows.map(row => ({
        ...row,
        events_detected: row.events_detected ? JSON.parse(row.events_detected) : []
    }));
}

export function getStartupScoreHistory(tournamentId, startupName) {
    return all(`
        SELECT * FROM daily_scores
        WHERE tournament_id = ? AND startup_name = ?
        ORDER BY date DESC
    `, [tournamentId, startupName]);
}

// ============ Leaderboard Functions ============

export function updateLeaderboard(tournamentId, playerAddress, totalScore) {
    exec(`
        INSERT OR REPLACE INTO leaderboard
        (tournament_id, player_address, total_score, last_updated)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [tournamentId, playerAddress, totalScore]);

    // Update ranks
    updateRanks(tournamentId);
}

function updateRanks(tournamentId) {
    // Get all players sorted by score
    const players = all(`
        SELECT player_address, total_score
        FROM leaderboard
        WHERE tournament_id = ?
        ORDER BY total_score DESC
    `, [tournamentId]);

    // Update each player's rank
    players.forEach((player, index) => {
        exec(
            'UPDATE leaderboard SET rank = ? WHERE tournament_id = ? AND player_address = ?',
            [index + 1, tournamentId, player.player_address]
        );
    });
}

export function getLeaderboard(tournamentId, limit = 100) {
    const rows = all(`
        SELECT
            rank,
            player_address,
            total_score,
            last_updated
        FROM leaderboard
        WHERE tournament_id = ?
        ORDER BY total_score DESC
        LIMIT ?
    `, [tournamentId, limit]);

    // Map to expected format
    return rows.map(row => ({
        rank: row.rank,
        address: row.player_address,
        score: row.total_score,
        lastUpdated: row.last_updated
    }));
}

export function getPlayerRank(tournamentId, playerAddress) {
    const row = get(`
        SELECT rank, total_score, player_address
        FROM leaderboard
        WHERE tournament_id = ? AND player_address = ?
    `, [tournamentId, playerAddress]);

    if (!row) return null;

    // Map to expected format
    return {
        rank: row.rank,
        score: row.total_score,
        address: row.player_address
    };
}

export function getTournamentStats(tournamentId) {
    return get(`
        SELECT
            COUNT(*) as total_players,
            AVG(total_score) as avg_score,
            MAX(total_score) as max_score,
            MIN(total_score) as min_score
        FROM leaderboard
        WHERE tournament_id = ?
    `, [tournamentId]);
}

// ============ Score History Functions ============

export function saveScoreHistory(tournamentId, playerAddress, date, pointsEarned, breakdown) {
    const breakdownJson = JSON.stringify(breakdown);
    exec(`
        INSERT INTO score_history
        (tournament_id, player_address, date, points_earned, breakdown)
        VALUES (?, ?, ?, ?, ?)
    `, [tournamentId, playerAddress, date, pointsEarned, breakdownJson]);
}

export function getPlayerScoreHistory(tournamentId, playerAddress) {
    const rows = all(`
        SELECT * FROM score_history
        WHERE tournament_id = ? AND player_address = ?
        ORDER BY date DESC
    `, [tournamentId, playerAddress]);

    return rows.map(row => ({
        ...row,
        breakdown: row.breakdown ? JSON.parse(row.breakdown) : {}
    }));
}

// Auto-save database every 5 seconds if there were changes
setInterval(() => {
    if (db) {
        saveDatabase();
    }
}, 5000);

// Save on exit
process.on('exit', saveDatabase);
process.on('SIGINT', () => {
    saveDatabase();
    process.exit();
});
