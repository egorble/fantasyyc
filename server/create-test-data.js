/**
 * Create test leaderboard data for demo
 */

import * as db from './db/database.js';

async function createTestData() {
    console.log('📊 Creating test leaderboard data...');

    // Initialize database
    await db.initDatabase();

    // Save tournament #1
    db.saveTournament({
        id: 1,
        startTime: Math.floor(Date.now() / 1000) - 86400, // Started yesterday
        endTime: Math.floor(Date.now() / 1000) + 86400 * 6, // Ends in 6 days
        prizePool: '1000',
        entryCount: 1,
        status: 'active'
    });

    console.log('✅ Tournament #1 saved');

    // Create test player
    const testPlayer = '0x233c8c54f25734b744e522bdc1eed9cbc8c97d0c';

    db.savePlayer(testPlayer);
    db.saveTournamentEntry(1, testPlayer);

    console.log('✅ Test player added');

    // Add test score
    db.updateLeaderboard(1, testPlayer, 1250.5);

    console.log('✅ Leaderboard updated');

    // Save test daily scores
    const today = new Date().toISOString().split('T')[0];

    db.saveDailyScore(1, 'OpenAI', today, 500, 10, [
        { type: 'funding', amount: '$100M', points: 500 }
    ]);

    db.saveDailyScore(1, 'Stripe', today, 300, 8, [
        { type: 'partnership', partner: 'Google', points: 300 }
    ]);

    console.log('✅ Daily scores saved');

    // Get and display leaderboard
    const leaderboard = db.getLeaderboard(1);
    console.log('\n📊 Current Leaderboard:');
    console.table(leaderboard);

    console.log('\n🎉 Test data created successfully!');
    console.log('👉 Now check the frontend at http://localhost:5173');

    process.exit(0);
}

createTestData().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
});
