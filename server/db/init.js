import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'fantasyyc.db'));

// Read and execute schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');

// Split by semicolon and execute each statement
const statements = schema.split(';').filter(s => s.trim());
statements.forEach(statement => {
    if (statement.trim()) {
        db.exec(statement);
    }
});

console.log('✅ Database initialized successfully!');
console.log('📁 Database location:', join(__dirname, 'fantasyyc.db'));

db.close();
