/**
 * Tournament Finalizer
 * Runs when tournament ends - collects final scores and calls finalizeWithPoints on blockchain
 */

import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Blockchain configuration
const RPC_URL = 'https://node.shadownet.etherlink.com';
const PACK_OPENER_ADDRESS = '0x638B92a58a8317e5f47247B5bD47cb16faA87eD9';
const TOURNAMENT_ADDRESS = '0x6036a89aE64cd3A1404E0e093A80622E949942d0';

// Private key for admin (should be in .env in production)
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY || 'YOUR_ADMIN_PRIVATE_KEY';

// ABIs
const packOpenerABI = ['function activeTournamentId() view returns (uint256)'];
const tournamentABI = [
    'function getTournament(uint256 tournamentId) view returns (tuple(uint256 id, uint256 registrationStart, uint256 startTime, uint256 endTime, uint256 prizePool, uint256 entryCount, uint8 status))',
    'function finalizeWithPoints(uint256 tournamentId, uint256[19] points)',
    'function getTournamentParticipants(uint256 tournamentId) view returns (address[])'
];

// 19 startups mapping (index 0 = startupId 1)
const STARTUP_IDS = {
    'OpenAI': 1,
    'Anthropic': 2,
    'Stripe': 3,
    'Rippling': 4,
    'Deel': 5,
    'Brex': 6,
    'Mercury': 7,
    'Ramp': 8,
    'Retool': 9,
    'Vercel': 10,
    'Linear': 11,
    'Notion': 12,
    'Figma': 13,
    'Airtable': 14,
    'Superhuman': 15,
    'Scale AI': 16,
    'Instacart': 17,
    'DoorDash': 18,
    'Coinbase': 19
};

/**
 * Aggregate total points for each startup across all days
 */
function aggregateStartupPoints(tournamentId) {
    const points = new Array(19).fill(0);

    // Get all daily scores for this tournament
    const dailyScores = db.getAggregatedStartupScores(tournamentId);

    console.log(`\n📊 Aggregated Scores:`);

    dailyScores.forEach(score => {
        const startupId = STARTUP_IDS[score.startup_name];
        if (startupId) {
            // Points are stored at index startupId - 1
            points[startupId - 1] = Math.floor(score.total_points);
            console.log(`   ${score.startup_name} (ID ${startupId}): ${points[startupId - 1]} pts`);
        }
    });

    return points;
}

/**
 * Check if tournament has ended and needs finalization
 */
async function checkAndFinalizeTournament() {
    console.log('🏁 Tournament Finalizer Started');
    console.log('━'.repeat(60));

    await db.initDatabase();

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const packOpener = new ethers.Contract(PACK_OPENER_ADDRESS, packOpenerABI, provider);
    const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, tournamentABI, provider);

    // Get active tournament ID
    const tournamentId = await packOpener.activeTournamentId();

    if (tournamentId == 0) {
        console.log('❌ No active tournament');
        return;
    }

    console.log(`\n✅ Found tournament #${tournamentId}`);

    // Get tournament details
    const tournamentData = await tournament.getTournament(tournamentId);
    const currentTime = Math.floor(Date.now() / 1000);
    const endTime = Number(tournamentData.endTime);
    const status = Number(tournamentData.status);

    console.log(`   End time: ${new Date(endTime * 1000).toISOString()}`);
    console.log(`   Current time: ${new Date(currentTime * 1000).toISOString()}`);
    console.log(`   Status: ${status} (0=Upcoming, 1=Registration, 2=Active, 3=Ended, 4=Finalized)`);

    // Check if tournament has ended but not finalized
    if (currentTime < endTime) {
        console.log('\n⏳ Tournament still active');
        return;
    }

    if (status === 4) {
        console.log('\n✅ Tournament already finalized');
        return;
    }

    console.log('\n🎯 Tournament ended! Preparing finalization...');

    // Aggregate points for all 19 startups
    const points = aggregateStartupPoints(tournamentId);

    console.log('\n📝 Points array for blockchain:');
    console.log(points);

    // Check if we have admin key
    if (!ADMIN_PRIVATE_KEY || ADMIN_PRIVATE_KEY === 'YOUR_ADMIN_PRIVATE_KEY') {
        console.log('\n⚠️  ADMIN_PRIVATE_KEY not configured!');
        console.log('   Set ADMIN_PRIVATE_KEY environment variable to finalize on blockchain');
        console.log('\n✅ Points calculated and saved to database');

        // Update tournament status in DB
        db.updateTournamentStatus(tournamentId, 'ended');
        return;
    }

    // Finalize on blockchain
    console.log('\n🔗 Finalizing tournament on blockchain...');

    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const tournamentWithSigner = tournament.connect(wallet);

    try {
        const tx = await tournamentWithSigner.finalizeWithPoints(tournamentId, points);
        console.log(`   Transaction sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`   ✅ Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

        // Update database
        db.updateTournamentStatus(tournamentId, 'finalized');

        console.log('\n🎉 Tournament finalized successfully!');
        console.log('   Players can now claim their prizes');

    } catch (error) {
        console.error('\n❌ Error finalizing tournament:', error.message);
        throw error;
    }
}

// Run finalization
checkAndFinalizeTournament().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
