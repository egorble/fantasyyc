import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializeDatabase() {
    console.log('🔧 Initializing database...');

    // Initialize database connection
    const db = await initDatabase();

    // Read and execute schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

    // Split by semicolon and execute each statement
    const statements = schema.split(';').filter(s => s.trim());
    statements.forEach(statement => {
        if (statement.trim()) {
            db.run(statement);
        }
    });

    // Save database
    const data = db.export();
    const buffer = Buffer.from(data);
    const { writeFileSync } = await import('fs');
    writeFileSync(join(__dirname, 'fantasyyc.db'), buffer);

    // Add demo data for testing
    const demoData = [
        // Insert tournament
        `INSERT OR REPLACE INTO tournaments (blockchain_id, start_time, end_time, prize_pool, entry_count, status)
         VALUES (1, ${Math.floor(Date.now() / 1000) - 86400}, ${Math.floor(Date.now() / 1000) + 518400}, '1000', 1, 'active')`,

        // Insert player
        `INSERT OR IGNORE INTO players (address) VALUES ('0x233c8c54f25734b744e522bdc1eed9cbc8c97d0c')`,

        // Insert tournament entry
        `INSERT OR IGNORE INTO tournament_entries (tournament_id, player_address)
         VALUES (1, '0x233c8c54f25734b744e522bdc1eed9cbc8c97d0c')`,

        // Insert leaderboard entry
        `INSERT OR REPLACE INTO leaderboard (tournament_id, player_address, total_score, rank, last_updated)
         VALUES (1, '0x233c8c54f25734b744e522bdc1eed9cbc8c97d0c', 1250.5, 1, CURRENT_TIMESTAMP)`
    ];

    demoData.forEach(sql => {
        db.run(sql);
    });

    // Save database again with demo data
    const finalData = db.export();
    const finalBuffer = Buffer.from(finalData);
    writeFileSync(join(__dirname, 'fantasyyc.db'), finalBuffer);

    console.log('✅ Database initialized successfully!');
    console.log('✅ Demo data added');
    console.log('📁 Database location:', join(__dirname, 'fantasyyc.db'));

    process.exit(0);
}

initializeDatabase().catch(error => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
});
