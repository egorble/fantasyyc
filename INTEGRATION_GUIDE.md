# FantasyYC - Complete Integration Guide

## System Architecture

```
Smart Contracts (Blockchain)
    ↓
Backend Server (Express + SQLite)
    ↓
Frontend (React + TypeScript)
```

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd server

# Install dependencies
npm install

# Initialize database
npm run init-db

# Start API server (runs on http://localhost:3001)
npm start
```

### 2. Run Daily Scorer (Manual Test)

```bash
cd server
npm run score
```

This will:
- Fetch active tournament from blockchain
- Get all participant addresses and their cards
- Fetch latest tweets for all 19 startups
- Calculate scores with rarity multipliers
- Update leaderboard in database

**Expected output:** Processing all 19 startups takes ~95 seconds due to rate limiting.

### 3. Frontend Integration

The frontend is already integrated! The `Leagues.tsx` component now uses:

- `useLeaderboard(tournamentId, limit)` - Real-time leaderboard with auto-refresh (30s)
- `usePlayerRank(tournamentId, address)` - Player's current rank and score
- `useDailyScores(tournamentId, date)` - Historical daily scores
- `useTournamentStats(tournamentId)` - Tournament statistics

## 📊 Backend API Endpoints

All endpoints are prefixed with `/api`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tournaments/active` | GET | Get currently active tournament |
| `/leaderboard/:tournamentId?limit=100` | GET | Get leaderboard for tournament |
| `/player/:address/rank/:tournamentId` | GET | Get specific player's rank |
| `/player/:address/cards/:tournamentId` | GET | Get player's tournament cards |
| `/daily-scores/:tournamentId/:date` | GET | Get scores for specific date |
| `/stats/:tournamentId` | GET | Get tournament statistics |
| `/tournaments` | GET | List all tournaments |
| `/tournaments/:id` | GET | Get specific tournament details |

## 🎮 How It Works

### Tournament Flow

1. **Tournament Created** (on blockchain)
   - Backend syncs tournament data to SQLite

2. **Players Enter** (on blockchain)
   - Players lock 5 NFT cards
   - Backend tracks all participants and their cards

3. **Daily Scoring** (automated job)
   ```
   For each active tournament:
     → Fetch all participants
     → For each participant:
       → Get their 5 locked cards
       → Fetch Twitter data for those startups
       → Calculate points with rarity multipliers
     → Update leaderboard
   ```

4. **Frontend Display**
   - Auto-refreshes leaderboard every 30 seconds
   - Shows live rankings and scores
   - Highlights current user's position

### Scoring System

**Base Points** (from Twitter events):
- Funding: +500 points
- Partnership: +300 points
- Product Launch: +250 points
- Revenue Milestone: +400 points
- Acquisition: +2000 points
- And more...

**Rarity Multipliers**:
- Common: 1x
- Rare: 2x
- Epic: 3x
- EpicRare: 4x
- Legendary: 5x

**Final Score** = Σ (Base Points × Rarity Multiplier) for all 5 cards

## ⚙️ Configuration

### Contract Addresses

Update in `server/jobs/daily-scorer.js`:

```javascript
const PACK_OPENER_ADDRESS = 'your_pack_opener_address';
const CARDS_NFT_ADDRESS = 'your_cards_nft_address';
const TOURNAMENT_MANAGER_ADDRESS = 'your_tournament_manager_address';
```

### Database Location

SQLite database: `server/db/fantasyyc.db`

### API Configuration

- **Port**: 3001 (configurable in `server/index.js`)
- **CORS**: Enabled for `http://localhost:5173` (Vite dev server)
- **Rate Limiting**: 1 request per 5 seconds for Twitter API

## 🔄 Automation Setup

### Option 1: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task → "FantasyYC Daily Scorer"
3. Trigger: Daily at 00:00
4. Action: Start a program
   - Program: `node`
   - Arguments: `C:\path\to\fantasyyc\server\jobs\daily-scorer.js`
   - Start in: `C:\path\to\fantasyyc\server`

### Option 2: Node-cron (in server)

Add to `server/index.js`:

```javascript
import cron from 'node-cron';

// Run every day at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily scorer...');
    await import('./jobs/daily-scorer.js');
});
```

## 🧪 Testing

### Test Backend Independently

```bash
# Check if server is running
curl http://localhost:3001/api/tournaments/active

# Get leaderboard (replace 1 with tournament ID)
curl http://localhost:3001/api/leaderboard/1?limit=10

# Get player rank
curl http://localhost:3001/api/player/0x123.../rank/1
```

### Test Full Integration

1. Start backend: `cd server && npm start`
2. Start frontend: `cd front && npm run dev`
3. Connect wallet in frontend
4. Navigate to Leagues tab
5. Leaderboard should display real data with auto-refresh

## 📦 Dependencies

### Backend
- `express` - Web server
- `cors` - Cross-origin requests
- `better-sqlite3` - SQLite database
- `ethers` - Blockchain interaction

### Frontend
- Already configured in `front/hooks/useLeaderboard.ts`
- No additional dependencies needed

## 🐛 Troubleshooting

### "Cannot connect to database"
- Ensure you ran `npm run init-db` first
- Check file permissions on `server/db/fantasyyc.db`

### "Tournament not found"
- Verify a tournament exists on blockchain
- Check contract addresses are correct
- Ensure blockchain RPC URL is accessible

### "Network error" in frontend
- Ensure backend server is running on port 3001
- Check CORS configuration matches frontend URL
- Verify API_BASE_URL in `useLeaderboard.ts`

### "Rate limit exceeded" (Twitter API)
- Free tier: 1 request per 5 seconds
- Script already implements delay
- If still failing, increase delay in `daily-scorer.js`

## 📈 Monitoring

The backend logs all important events:

```bash
✅ Processing tournament #1
📊 Found 25 participants
🃏 Player 0x123... has 5 cards
🐦 Fetching tweets for @OpenAI, @stripe, @vercel...
💾 Updated leaderboard: 25 entries
```

## 🔐 Security Notes

- **API Key**: Twitter API key is hardcoded for testing. Move to `.env` in production
- **Database**: SQLite is fine for testing. Consider PostgreSQL for production
- **Rate Limiting**: Implement API rate limiting in production
- **Validation**: Add input validation for all API endpoints

## 🎯 Next Steps

1. ✅ Backend infrastructure complete
2. ✅ Frontend integration complete
3. ⏳ Set up automated daily scoring
4. ⏳ Deploy to production
5. ⏳ Add monitoring and alerts
6. ⏳ Implement caching layer for better performance

## 📞 Support

For issues or questions:
- Check server logs: `server/index.js` console output
- Check database: Use SQLite browser to inspect `fantasyyc.db`
- Verify blockchain data: Use block explorer
