/**
 * FantasyYC Server Configuration
 * Single source of truth for all contract addresses and chain config.
 * Both server/index.js and server/jobs/daily-scorer.js import from here.
 * When contracts are redeployed, update ONLY this file and restart the server.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load admin key from scripts/.env (for tournament finalization)
function loadAdminKey() {
    if (process.env.ADMIN_PRIVATE_KEY) return process.env.ADMIN_PRIVATE_KEY;
    const envPath = join(__dirname, '..', 'scripts', '.env');
    if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        const match = content.match(/PRIVATE_KEY=(.+)/);
        if (match) return match[1].trim();
    }
    return null;
}

export const ADMIN_PRIVATE_KEY = loadAdminKey();

// Load admin API key (for HTTP endpoint auth, separate from blockchain signing key)
function loadAdminApiKey() {
    if (process.env.ADMIN_API_KEY) return process.env.ADMIN_API_KEY;
    const envPath = join(__dirname, '..', 'scripts', '.env');
    if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        const match = content.match(/ADMIN_API_KEY=(.+)/);
        if (match) return match[1].trim();
    }
    return null;
}

export const ADMIN_API_KEY = loadAdminApiKey();

// Load all security env vars from scripts/.env into process.env
function loadEnvVars() {
    const envPath = join(__dirname, '..', 'scripts', '.env');
    if (!existsSync(envPath)) return;
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const eq = line.indexOf('=');
        if (eq <= 0) continue;
        const key = line.substring(0, eq).trim();
        const val = line.substring(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}
loadEnvVars();

// MegaETH chain configuration
export const CHAIN = {
    RPC_URL: 'https://mainnet.megaeth.com/rpc',
    CHAIN_ID: 4326,
    EXPLORER: 'https://megaeth.blockscout.com',
    SERVER_PORT: 3003,
};

export const CONTRACTS = {
    UnicornX_NFT: '0x45E817D93915D484bac01d27E26d19F30715B6Bc',
    PackOpener: '0x8146c0f42824566373f146A200DE85c40d561b9e',
    TournamentManager: '0xbccAFD09B909bb2Ca87F10067cBCF10212C562B3',
    MarketplaceV2: '0x04Cd3Ce1639b9b2Ca63dbd9bE6ec3a4B5f4Dd161',
};

export const NETWORK_NAME = 'megaeth';

// DB filename
export const DB_FILENAME = 'fantasyyc.db';

// For backward compat with daily-scorer (single network now)
export const CHAIN_CONFIGS = { megaeth: CHAIN };
export const CONTRACT_CONFIGS = { megaeth: CONTRACTS };

/** All supported network IDs */
export const ALL_NETWORKS = ['megaeth'];

/** Get absolute DB path for a given network */
export function dbPathForNetwork(networkName) {
    return join(__dirname, 'db', 'fantasyyc.db');
}

/** Get schema.sql path */
export function schemaPath() {
    return join(__dirname, 'db', 'schema.sql');
}
