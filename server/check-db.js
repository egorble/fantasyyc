import * as db from './db/database.js';

async function checkDatabase() {
    await db.initDatabase();

    const tournaments = db.getAllTournaments();
    console.log('Tournaments:', tournaments);

    const leaderboard = db.getLeaderboard(1);
    console.log('Leaderboard:', leaderboard);

    process.exit(0);
}

checkDatabase();
