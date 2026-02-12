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

export const CHAIN = {
    RPC_URL: 'https://node.shadownet.etherlink.com',
    CHAIN_ID: 127823,
    EXPLORER: 'https://shadownet.explorer.etherlink.com',
};

export const CONTRACTS = {
    UnicornX_NFT: '0x612ca7a970547087d2a4871eb313BEfd674073D8',
    PackOpener: '0xc408b65F312d5F4eb7688d621187F76e2C2A5f96',
    TournamentManager: '0xdDAC8b96506E46123878e84d456f8Db1DCFd1092',
    MarketplaceV2: '0x9D6226c1B76a43cAe3A85eED549eae46f4eA28b3',
};
