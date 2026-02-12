// Contract addresses and ABIs for UnicornX
import { ethers } from 'ethers';

// ============ Network Configuration ============
export const CHAIN_ID = 127823;
export const CHAIN_NAME = 'Etherlink Shadownet Testnet';
export const RPC_URL = 'https://node.shadownet.etherlink.com';
export const EXPLORER_URL = 'https://shadownet.explorer.etherlink.com';
export const METADATA_API = '';

// ============ Contract Addresses ============
export const CONTRACTS = {
    UnicornX_NFT: '0x35066391f772dcb7C13A0a94E721d2A91F85FBC3',
    PackOpener: '0x27f3d2aD14Db8FFc643f9b9ff620c6BcA45359D8',
    TournamentManager: '0x8f8622FcbcF3Ed3279b9252DBB491377c0f237d0',
    MarketplaceV2: '0x82412944850d0219503a2Ca894f6AB47BC292A4e',
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
    'function pendingPrizePool() view returns (uint256)',
    'function getReferrer(address user) view returns (address)',
    'function getReferralStats(address referrer) view returns (uint256 count, uint256 totalEarned)',
    'function referralEarnings(address referrer) view returns (uint256)',
    'function referralCount(address referrer) view returns (uint256)',
    // Write functions - referrer is passed directly in buy functions
    'function buyPack(address referrer) payable returns (uint256)',
    'function buyAndOpenPack(address referrer) payable returns (uint256[5], uint256[5])',
    'function openPack(uint256 packId) returns (uint256[5], uint256[5])',
    // Admin functions
    'function withdraw()',
    'function setPackPrice(uint256 newPrice)',
    'function setActiveTournament(uint256 tournamentId)',
    'function forwardPendingFunds()',
    'function pause()',
    'function unpause()',
    // Events
    'event PackPurchased(address indexed buyer, uint256 indexed packId, uint256 price, uint256 timestamp)',
    'event PackOpened(address indexed opener, uint256 indexed packId, uint256[5] cardIds, uint256[5] startupIds)',
    'event ReferralRegistered(address indexed user, address indexed referrer)',
    'event ReferralRewardPaid(address indexed referrer, address indexed buyer, uint256 amount)',
    'event FundsDistributed(uint256 prizePoolAmount, uint256 platformAmount, uint256 referralAmount)',
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
    'function getUserScoreInfo(uint256 tournamentId, address user) view returns (uint256 score, uint256 prize, uint256 totalScore)',
    'function getTournamentPoints(uint256 tournamentId) view returns (uint256[19])',
    'function totalTournamentScore(uint256 tournamentId) view returns (uint256)',
    'function userScores(uint256 tournamentId, address user) view returns (uint256)',
    // Write functions
    'function enterTournament(uint256 tournamentId, uint256[5] cardIds)',
    'function cancelEntry(uint256 tournamentId)',
    'function claimPrize(uint256 tournamentId)',
    // Admin functions
    'function createTournament(uint256 registrationStart, uint256 startTime, uint256 endTime) returns (uint256)',
    'function finalizeTournament(uint256 tournamentId, address[] winners, uint256[] amounts)',
    'function finalizeWithPoints(uint256 tournamentId, uint256[19] points)',
    'function cancelTournament(uint256 tournamentId)',
    'function withdrawFromPrizePool(uint256 tournamentId, uint256 amount, address to)',
    'function emergencyWithdraw(uint256 amount, address to)',
    'function pause()',
    'function unpause()',
    // Events
    'event TournamentCreated(uint256 indexed tournamentId, uint256 registrationStart, uint256 startTime, uint256 endTime)',
    'event LineupRegistered(uint256 indexed tournamentId, address indexed user, uint256[5] cardIds)',
    'event LineupCancelled(uint256 indexed tournamentId, address indexed user)',
];

// Old MARKETPLACE_ABI removed - using MarketplaceV2 exclusively

export const MARKETPLACE_V2_ABI = [
    // ===== Listings =====
    'function listCard(uint256 tokenId, uint256 price) returns (uint256)',
    'function buyCard(uint256 listingId) payable',
    'function cancelListing(uint256 listingId)',
    'function getActiveListings() view returns (tuple(uint256 listingId, address seller, uint256 tokenId, uint256 price, uint256 listedAt, bool active)[])',
    'function getListing(uint256 listingId) view returns (tuple(uint256 listingId, address seller, uint256 tokenId, uint256 price, uint256 listedAt, bool active))',
    'function isTokenListed(uint256 tokenId) view returns (bool)',

    // ===== Bids =====
    'function placeBid(uint256 tokenId, uint256 expiration) payable returns (uint256)',
    'function cancelBid(uint256 bidId)',
    'function acceptBid(uint256 bidId)',
    'function getActiveBidsForToken(uint256 tokenId) view returns (tuple(uint256 bidId, address bidder, uint256 tokenId, uint256 amount, uint256 expiration, bool active)[])',
    'function getUserBids(address user) view returns (tuple(uint256 bidId, address bidder, uint256 tokenId, uint256 amount, uint256 expiration, bool active)[])',

    // ===== Auctions =====
    'function createAuction(uint256 tokenId, uint256 startPrice, uint256 reservePrice, uint256 duration) returns (uint256)',
    'function bidOnAuction(uint256 auctionId) payable',
    'function finalizeAuction(uint256 auctionId)',
    'function cancelAuction(uint256 auctionId)',
    'function getActiveAuctions() view returns (tuple(uint256 auctionId, address seller, uint256 tokenId, uint256 startPrice, uint256 reservePrice, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, uint8 status)[])',
    'function getAuction(uint256 auctionId) view returns (tuple(uint256 auctionId, address seller, uint256 tokenId, uint256 startPrice, uint256 reservePrice, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, uint8 status))',

    // ===== History & Stats =====
    'function getTokenSaleHistory(uint256 tokenId) view returns (tuple(uint256 saleId, uint256 tokenId, address seller, address buyer, uint256 price, uint256 timestamp, uint8 saleType)[])',
    'function getTokenStats(uint256 tokenId) view returns (tuple(uint256 lastSalePrice, uint256 totalVolume, uint256 salesCount, uint256 highestSale, uint256 lowestSale))',
    'function getGlobalStats() view returns (uint256 _totalVolume, uint256 _totalSales, uint256 _activeListings, uint256 _activeAuctions)',

    // Events
    'event CardListed(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 price)',
    'event CardSold(uint256 indexed listingId, address indexed seller, address indexed buyer, uint256 tokenId, uint256 price)',
    'event ListingCancelled(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId)',
    'event BidPlaced(uint256 indexed bidId, address indexed bidder, uint256 indexed tokenId, uint256 amount)',
    'event BidCancelled(uint256 indexed bidId, address indexed bidder, uint256 indexed tokenId)',
    'event BidAccepted(uint256 indexed bidId, address indexed seller, address indexed bidder, uint256 tokenId, uint256 amount)',
    'event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 indexed tokenId, uint256 startPrice, uint256 reservePrice, uint256 endTime)',
    'event AuctionBid(uint256 indexed auctionId, address indexed bidder, uint256 amount)',
    'event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 finalPrice)',
    'event AuctionCancelled(uint256 indexed auctionId, address indexed seller, uint256 indexed tokenId)',
];

// ============ Startup Data (matches contract) ============
export const STARTUPS: Record<number, { name: string; rarity: string; multiplier: number }> = {
    // Legendary (10x multiplier) - IDs 1-5
    1: { name: 'Openclaw', rarity: 'Legendary', multiplier: 10 },
    2: { name: 'Lovable', rarity: 'Legendary', multiplier: 10 },
    3: { name: 'Cursor', rarity: 'Legendary', multiplier: 10 },
    4: { name: 'OpenAI', rarity: 'Legendary', multiplier: 10 },
    5: { name: 'Anthropic', rarity: 'Legendary', multiplier: 10 },

    // Epic (5x multiplier) - IDs 6-8
    6: { name: 'Browser Use', rarity: 'Epic', multiplier: 5 },
    7: { name: 'Dedalus Labs', rarity: 'Epic', multiplier: 5 },
    8: { name: 'Autumn', rarity: 'Epic', multiplier: 5 },

    // Rare (3x multiplier) - IDs 9-13
    9: { name: 'Axiom', rarity: 'Rare', multiplier: 3 },
    10: { name: 'Multifactor', rarity: 'Rare', multiplier: 3 },
    11: { name: 'Dome', rarity: 'Rare', multiplier: 3 },
    12: { name: 'GrazeMate', rarity: 'Rare', multiplier: 3 },
    13: { name: 'Tornyol Systems', rarity: 'Rare', multiplier: 3 },

    // Common (1x multiplier) - IDs 14-19
    14: { name: 'Pocket', rarity: 'Common', multiplier: 1 },
    15: { name: 'Caretta', rarity: 'Common', multiplier: 1 },
    16: { name: 'AxionOrbital Space', rarity: 'Common', multiplier: 1 },
    17: { name: 'Freeport Markets', rarity: 'Common', multiplier: 1 },
    18: { name: 'Ruvo', rarity: 'Common', multiplier: 1 },
    19: { name: 'Lightberry', rarity: 'Common', multiplier: 1 },
};

// ============ Provider ============
export function getProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
        return new ethers.BrowserProvider(window.ethereum as unknown as ethers.Eip1193Provider);
    }
    return new ethers.JsonRpcProvider(RPC_URL);
}

// ============ Contract Instances ============
export function getNFTContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.UnicornX_NFT, NFT_ABI, provider);
}

export function getPackOpenerContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.PackOpener, PACK_OPENER_ABI, provider);
}

export function getTournamentContract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.TournamentManager, TOURNAMENT_ABI, provider);
}

// Old getMarketplaceContract removed - using getMarketplaceV2Contract exclusively

export function getMarketplaceV2Contract(signerOrProvider?: ethers.Signer | ethers.Provider) {
    const provider = signerOrProvider || getProvider();
    return new ethers.Contract(CONTRACTS.MarketplaceV2, MARKETPLACE_V2_ABI, provider);
}

// ============ Utils ============
export function formatXTZ(wei: bigint): string {
    return ethers.formatEther(wei);
}

export function parseXTZ(xtz: string): bigint {
    return ethers.parseEther(xtz);
}
