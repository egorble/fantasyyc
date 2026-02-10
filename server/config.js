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

export const CHAIN = {
    RPC_URL: 'https://node.shadownet.etherlink.com',
    CHAIN_ID: 127823,
    EXPLORER: 'https://shadownet.explorer.etherlink.com',
};

export const CONTRACTS = {
    UnicornX_NFT: '0xD3C4633257733dA9597b193cDaAA06bCBCbA0BF0',
    PackOpener: '0x8A35cbe95CD07321CE4f0C73dC2518AAc5b28554',
    TournamentManager: '0xfF528538033a55C7b9C23608eB3d15e2387E0d61',
    MarketplaceV2: '0xEca397fB26dbBf5A6FaB976028E7D6B37961a8Bd',
};
