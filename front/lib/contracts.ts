// Contract addresses and ABIs for Fantasy YC
import { ethers } from 'ethers';

// ============ Network Configuration ============
export const CHAIN_ID = 127823;
export const CHAIN_NAME = 'Etherlink Shadownet Testnet';
export const RPC_URL = 'https://node.shadownet.etherlink.com';
export const EXPLORER_URL = 'https://shadownet.explorer.etherlink.com';
export const METADATA_API = 'http://localhost:3001';

// ============ Contract Addresses ============
export const CONTRACTS = {
    NFT: '0xdF5c40E244d30C8C1A90CFC76d96129839BB3613',
    PackOpener: '0x02483f5CD96CfcA9834EeF591EfF6d1860a2dC10',
    TournamentManager: '0x999bc7Bc4AAce9bDcAe5BbC5721c6c4d602CCe97',
    Marketplace: '', // TODO: Deploy and update this address
} as const;

// ============ ABIs (minimal for frontend) ============
export const NFT_ABI = [
    // Read functions
    'function ownerOf(uint256 tokenId) view returns (address)',
    'function balanceOf(address owner) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function tokenToStartup(uint256 tokenId) view returns (uint256)',
    'function tokenToEdition(uint256 tokenId) view returns (uint256)',
    'function isLocked(uint256 tokenId) view returns (bool)',
    'function startupMintCount(uint256 startupId) view returns (uint256)',
    'function getCardInfo(uint256 tokenId) view returns (tuple(uint256 startupId, uint256 edition, uint8 rarity, uint256 multiplier, bool isLocked, string name))',
    'function getOwnedTokens(address owner) view returns (uint256[])',
    'function startups(uint256 id) view returns (tuple(string name, uint8 rarity, uint256 multiplier))',
    // Write functions
    'function mergeCards(uint256[3] tokenIds) returns (uint256)',
    'function approve(address to, uint256 tokenId)',
    'function setApprovalForAll(address operator, bool approved)',
    // Events
    'event CardMinted(address indexed to, uint256 indexed tokenId, uint256 indexed startupId, uint256 edition)',
    'event CardsMerged(address indexed owner, uint256[3] burnedTokenIds, uint256 indexed newTokenId, uint8 fromRarity, uint8 toRarity)',
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const PACK_OPENER_ABI = [
    // Read functions
    'function currentPackPrice() view returns (uint256)',
    'function packsSold() view returns (uint256)',
    'function MAX_PACKS() view returns (uint256)',
    'function getUserPacks(address user) view returns (uint256[])',
    'function getPackInfo(uint256 packId) view returns (tuple(address buyer, uint256 purchaseTime, bool opened, uint256[5] cardIds))',
    'function getUnopenedPackCount(address user) view returns (uint256)',
    'function activeTournamentId() view returns (uint256)',
    // Write functions
    'function buyPack() payable returns (uint256)',
    'function buyAndOpenPack() payable returns (uint256[5], uint256[5])',
    'function openPack(uint256 packId) returns (uint256[5], uint256[5])',
    // Admin functions
    'function withdraw()',
    'function setPackPrice(uint256 newPrice)',
    'function setActiveTournament(uint256 tournamentId)',
    'function pause()',
    'function unpause()',
    // Events
    'event PackPurchased(address indexed buyer, uint256 indexed packId, uint256 price, uint256 timestamp)',
    'event PackOpened(address indexed opener, uint256 indexed packId, uint256[5] cardIds, uint256[5] startupIds)',
];

export const TOURNAMENT_ABI = [
    // Read functions
    'function getTournament(uint256 tournamentId) view returns (tuple(uint256 id, uint256 registrationStart, uint256 startTime, uint256 endTime, uint256 prizePool, uint256 entryCount, uint8 status))',
    'function getUserLineup(uint256 tournamentId, address user) view returns (tuple(uint256[5] cardIds, address owner, uint256 timestamp, bool cancelled, bool claimed))',
    'function getTournamentParticipants(uint256 tournamentId) view returns (address[])',
    'function canRegister(uint256 tournamentId) view returns (bool)',
    'function canCancelEntry(uint256 tournamentId, address user) view returns (bool)',
    'function hasEntered(uint256 tournamentId, address user) view returns (bool)',
    'function getTournamentPhase(uint256 tournamentId) view returns (string)',
    'function getActiveEntryCount(uint256 tournamentId) view returns (uint256)',
    'function nextTournamentId() view returns (uint256)',
    // Write functions
    'function enterTournament(uint256 tournamentId, uint256[5] cardIds)',
    'function cancelEntry(uint256 tournamentId)',
    'function claimPrize(uint256 tournamentId)',
    // Admin functions
    'function createTournament(uint256 registrationStart, uint256 startTime, uint256 endTime) returns (uint256)',
    'function finalizeTournament(uint256 tournamentId, address[] winners, uint256[] amounts)',
    'function cancelTournament(uint256 tournamentId)',
    'function emergencyWithdraw(uint256 amount, address to)',
    'function pause()',
    'function unpause()',
    // Events
    'event TournamentCreated(uint256 indexed tournamentId, uint256 registrationStart, uint256 startTime, uint256 endTime)',
    'event LineupRegistered(uint256 indexed tournamentId, address indexed user, uint256[5] cardIds)',
    'event LineupCancelled(uint256 indexed tournamentId, address indexed user)',
];

export const MARKETPLACE_ABI = [
    // Read functions
    'function getActiveListings() view returns (tuple(uint256 listingId, address seller, uint256 tokenId, uint256 price, uint256 listedAt, bool active)[])',
    'function getActiveListingCount() view returns (uint256)',
    'function getListing(uint256 listingId) view returns (tuple(uint256 listingId, address seller, uint256 tokenId, uint256 price, uint256 listedAt, bool active))',
    'function isTokenListed(uint256 tokenId) view returns (bool)',
    'function getListingsBySeller(address seller) view returns (tuple(uint256 listingId, address seller, uint256 tokenId, uint256 price, uint256 listedAt, bool active)[])',
    'function tokenToListing(uint256 tokenId) view returns (uint256)',
    'function marketplaceFee() view returns (uint256)',
    // Write functions
    'function listCard(uint256 tokenId, uint256 price) returns (uint256)',
    'function buyCard(uint256 listingId) payable',
    'function cancelListing(uint256 listingId)',
    // Events
    'event CardListed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price)',
    'event CardSold(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 tokenId, uint256 price)',
    'event ListingCancelled(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId)',
];

// ============ Startup Data (matches contract) ============
export const STARTUPS: Record<number, { name: string; rarity: string; multiplier: number }> = {
    1: { name: 'Manus', rarity: 'Legendary', multiplier: 10 },
    2: { name: 'Lovable', rarity: 'Legendary', multiplier: 10 },
    3: { name: 'Cursor', rarity: 'Legendary', multiplier: 10 },
    4: { name: 'Anthropic', rarity: 'Legendary', multiplier: 10 },
    5: { name: 'OpenAI', rarity: 'EpicRare', multiplier: 8 },
    6: { name: 'Browser Use', rarity: 'Epic', multiplier: 5 },
    7: { name: 'Dedalus Labs', rarity: 'Epic', multiplier: 5 },
    8: { name: 'Autumn', rarity: 'Epic', multiplier: 5 },
    9: { name: 'Axiom', rarity: 'Epic', multiplier: 5 },
    10: { name: 'Multifactor', rarity: 'Rare', multiplier: 3 },
    11: { name: 'Dome', rarity: 'Rare', multiplier: 3 },
    12: { name: 'GrazeMate', rarity: 'Rare', multiplier: 3 },
    13: { name: 'Tornyol Systems', rarity: 'Rare', multiplier: 3 },
    14: { name: 'Axiom', rarity: 'Rare', multiplier: 3 },
    15: { name: 'Pocket', rarity: 'Common', multiplier: 1 },
    16: { name: 'Caretta', rarity: 'Common', multiplier: 1 },
    17: { name: 'AxionOrbital Space', rarity: 'Common', multiplier: 1 },
    18: { name: 'Freeport Markets', rarity: 'Common', multiplier: 1 },
    19: { name: 'Ruvo', rarity: 'Common', multiplier: 1 },
};

// ============ Provider ============
export function getProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum);
    }
    return new ethers.JsonRpcProvider(RPC_URL);
}

// ============ Contract Instances ============
export function getNFTContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.NFT, NFT_ABI, provider);
}

export function getPackOpenerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.PackOpener, PACK_OPENER_ABI, provider);
}

export function getTournamentContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.TournamentManager, TOURNAMENT_ABI, provider);
}

export function getMarketplaceContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.Marketplace, MARKETPLACE_ABI, provider);
}

// ============ Utils ============
export function formatXTZ(wei: bigint): string {
    return ethers.formatEther(wei);
}

export function parseXTZ(xtz: string): bigint {
    return ethers.parseEther(xtz);
}
