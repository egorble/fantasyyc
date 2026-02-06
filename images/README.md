# Fantasy YC Smart Contracts

Fantasy YC NFT project on Etherlink blockchain - collect YC startup cards, open packs, enter tournaments.

## Overview

- **Total Supply**: 10,000 NFTs maximum
- **Card Types**: 19 YC startups with 5 rarity tiers
- **Pack Price**: 5 XTZ (5 random cards)
- **Tournament Bond**: 0.5 XTZ

## Contracts

| Contract | Purpose |
|----------|---------|
| `FantasyYC_NFT.sol` | ERC-721 NFT with startup cards, lock mechanism |
| `PackOpener.sol` | Pack purchases, random card generation |
| `TournamentManager.sol` | Tournament entries, prize distribution |

## Network Configuration

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| **Shadownet Testnet** | 127823 | https://node.shadownet.etherlink.com |
| Etherlink Mainnet | 42793 | https://node.mainnet.etherlink.com |

**Testnet Faucet**: https://shadownet.faucet.etherlink.com/

**Explorer**: https://shadownet.explorer.etherlink.com

## Quick Start

```bash
# Install dependencies
npm install

# Compile contracts with solc
npm run compile

# Deploy to Shadownet testnet
PRIVATE_KEY=0x... npm run deploy:testnet

# Deploy to mainnet
PRIVATE_KEY=0x... npm run deploy:mainnet
```

## Rarity Distribution

| Rarity | Multiplier | Cards | Pack Chance |
|--------|-----------|-------|-------------|
| Legendary | 10x | Manus, Lovable, Cursor, Anthropic | ~2% |
| Epic Rare | 8x | OpenAI | ~0.5% |
| Epic | 5x | Browser Use, Dedalus Labs, Autumn, Axiom | ~2.5% |
| Rare | 3x | Multifactor, Dome, GrazeMate, Tornyol, Axiom | 25% |
| Common | 1x | Pocket, Caretta, AxionOrbital, Freeport, Ruvo | 70% |

## Contract Interaction

```javascript
const { ethers } = require("ethers");

// Connect to Shadownet
const provider = new ethers.JsonRpcProvider("https://node.shadownet.etherlink.com");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Buy and open pack
const packOpener = new ethers.Contract(PACK_OPENER_ADDRESS, abi, wallet);
const tx = await packOpener.buyAndOpenPack({ value: ethers.parseEther("5") });

// Enter tournament with 5 cards
const tournament = new ethers.Contract(TOURNAMENT_ADDRESS, abi, wallet);
await tournament.enterTournament(tournamentId, [1,2,3,4,5], { 
    value: ethers.parseEther("0.5") 
});
```

## Project Structure

```
fantasyyc/
├── contracts/
│   ├── FantasyYC_NFT.sol
│   ├── PackOpener.sol
│   └── TournamentManager.sol
├── scripts/
│   ├── compile.js
│   └── deploy.js
├── build/                 # Generated after compilation
└── package.json
```

## Security

- OpenZeppelin v5.0.0 contracts
- Ownable2Step for ownership transfers
- ReentrancyGuard on fund transfers
- Pausable for emergency stops

## License

MIT
