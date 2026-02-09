/**
 * Integration Test Script
 * Tests the complete flow: Blockchain → Backend → Database
 */

import { ethers } from 'ethers';
import * as db from './db/database.js';

// ANSI colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

async function testDatabaseConnection() {
    log.test('Testing database connection...');
    try {
        const tournaments = db.getAllTournaments();
        log.success(`Database connected. Found ${tournaments.length} tournaments`);
        return true;
    } catch (error) {
        log.error(`Database error: ${error.message}`);
        return false;
    }
}

async function testBlockchainConnection() {
    log.test('Testing blockchain connection...');
    try {
        const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        const network = await provider.getNetwork();
        const blockNumber = await provider.getBlockNumber();
        log.success(`Connected to chain ID ${network.chainId}, block #${blockNumber}`);
        return true;
    } catch (error) {
        log.error(`Blockchain connection failed: ${error.message}`);
        log.warn('Make sure Hardhat node is running: npx hardhat node');
        return false;
    }
}

async function testTournamentData() {
    log.test('Testing tournament data...');
    try {
        const tournaments = db.getAllTournaments();

        if (tournaments.length === 0) {
            log.warn('No tournaments found in database');
            log.info('Create a tournament on blockchain first');
            return false;
        }

        const tournament = tournaments[0];
        log.success(`Found tournament #${tournament.blockchain_id}`);
        log.info(`  Status: ${tournament.status}`);
        log.info(`  Prize Pool: ${tournament.prize_pool}`);
        log.info(`  Entries: ${tournament.entry_count}`);

        return true;
    } catch (error) {
        log.error(`Tournament test failed: ${error.message}`);
        return false;
    }
}

async function testLeaderboardData() {
    log.test('Testing leaderboard data...');
    try {
        const tournaments = db.getAllTournaments();

        if (tournaments.length === 0) {
            log.warn('No tournaments to test leaderboard');
            return false;
        }

        const tournamentId = tournaments[0].blockchain_id;
        const leaderboard = db.getLeaderboard(tournamentId, 10);

        if (leaderboard.length === 0) {
            log.warn('No leaderboard entries found');
            log.info('Run daily scorer to generate data: npm run score');
            return false;
        }

        log.success(`Found ${leaderboard.length} leaderboard entries`);

        // Show top 3
        log.info('Top 3 players:');
        leaderboard.slice(0, 3).forEach(player => {
            log.info(`  #${player.rank}: ${player.player_address} - ${player.total_score.toFixed(2)} pts`);
        });

        return true;
    } catch (error) {
        log.error(`Leaderboard test failed: ${error.message}`);
        return false;
    }
}

async function testDailyScores() {
    log.test('Testing daily scores data...');
    try {
        const tournaments = db.getAllTournaments();

        if (tournaments.length === 0) {
            log.warn('No tournaments to test scores');
            return false;
        }

        const tournamentId = tournaments[0].blockchain_id;
        const today = new Date().toISOString().split('T')[0];
        const scores = db.getDailyScores(tournamentId, today);

        if (scores.length === 0) {
            log.warn(`No daily scores found for ${today}`);
            log.info('Run daily scorer to generate data: npm run score');
            return false;
        }

        log.success(`Found ${scores.length} startup scores for today`);

        // Show top 3 startups by points
        const topStartups = scores
            .sort((a, b) => b.base_points - a.base_points)
            .slice(0, 3);

        log.info('Top 3 startups today:');
        topStartups.forEach(startup => {
            log.info(`  ${startup.startup_name}: ${startup.base_points.toFixed(2)} pts (${startup.tweets_analyzed} tweets)`);
        });

        return true;
    } catch (error) {
        log.error(`Daily scores test failed: ${error.message}`);
        return false;
    }
}

async function testAPIServer() {
    log.test('Testing API server...');
    try {
        const response = await fetch('http://localhost:3001/api/tournaments/active');

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            log.success('API server is running and responding');
            log.info(`Active tournament: ${data.data ? `#${data.data.blockchain_id}` : 'None'}`);
            return true;
        } else {
            log.warn('API responded but with error');
            return false;
        }
    } catch (error) {
        log.error(`API server test failed: ${error.message}`);
        log.warn('Make sure server is running: npm start');
        return false;
    }
}

async function testTwitterAPI() {
    log.test('Testing Twitter API connection...');
    try {
        const API_KEY = 'new1_d1be13bf77c84f1886c5a79cdb692816';
        const testHandle = 'OpenAI';

        const response = await fetch(
            `https://api.twitterapi.io/twitter/user/last_tweets?username=${testHandle}&count=1`,
            {
                headers: {
                    'x-api-key': API_KEY,
                    'accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.data?.tweets && data.data.tweets.length > 0) {
            log.success('Twitter API is working');
            log.info(`Test tweet from @${testHandle}: "${data.data.tweets[0].text.slice(0, 50)}..."`);
            return true;
        } else {
            log.warn('Twitter API responded but no tweets found');
            return false;
        }
    } catch (error) {
        log.error(`Twitter API test failed: ${error.message}`);
        return false;
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('  FantasyYC Integration Test Suite');
    console.log('='.repeat(60) + '\n');

    const results = {
        database: await testDatabaseConnection(),
        blockchain: await testBlockchainConnection(),
        tournament: await testTournamentData(),
        leaderboard: await testLeaderboardData(),
        dailyScores: await testDailyScores(),
        apiServer: await testAPIServer(),
        twitterAPI: await testTwitterAPI()
    };

    console.log('\n' + '='.repeat(60));
    console.log('  Test Results Summary');
    console.log('='.repeat(60) + '\n');

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;

    Object.entries(results).forEach(([test, passed]) => {
        const status = passed ? `${colors.green}PASS` : `${colors.red}FAIL`;
        console.log(`${status}${colors.reset} - ${test}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log(`  Overall: ${passed}/${total} tests passed`);
    console.log('='.repeat(60) + '\n');

    if (passed === total) {
        log.success('🎉 All systems operational! Integration is working perfectly.');
    } else {
        log.warn('⚠️  Some tests failed. Check the output above for details.');
        console.log('\nQuick fixes:');
        if (!results.database) console.log('  → Run: npm run init-db');
        if (!results.blockchain) console.log('  → Run: npx hardhat node (in contracts folder)');
        if (!results.apiServer) console.log('  → Run: npm start (in server folder)');
        if (!results.tournament || !results.leaderboard || !results.dailyScores) {
            console.log('  → Run: npm run score (to generate data)');
        }
    }

    console.log('');
}

// Run tests
runAllTests().catch(error => {
    log.error(`Test suite failed: ${error.message}`);
    process.exit(1);
});
