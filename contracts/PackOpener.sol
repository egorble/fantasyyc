// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IFantasyYC_NFT {
    function batchMint(address to, uint256[5] calldata startupIds) external returns (uint256[5] memory);
    function totalSupply() external view returns (uint256);
}

interface ITournamentManager {
    function addToPrizePool(uint256 tournamentId) external payable;
}

/**
 * @title PackOpener
 * @author Fantasy YC Team
 * @notice Handle pack purchases and random card generation for Fantasy YC
 * @dev Uses on-chain randomness (prevrandao) for card generation
 */
contract PackOpener is Ownable2Step, Pausable, ReentrancyGuard {
    
    // ============ Constants ============
    
    /// @notice Price per pack in XTZ (5 XTZ)
    uint256 public constant PACK_PRICE = 5 ether;
    
    /// @notice Maximum number of packs available
    uint256 public constant MAX_PACKS = 10000;
    
    /// @notice Cards per pack
    uint256 public constant CARDS_PER_PACK = 5;
    
    // Rarity Distribution (cumulative percentages)
    uint256 private constant COMMON_THRESHOLD = 70;   // 0-69: Common (70%)
    uint256 private constant RARE_THRESHOLD = 95;     // 70-94: Rare (25%)
    // 95-99: Epic/Epic Rare/Legendary (5%)
    
    // Startup ID ranges by rarity
    uint256 private constant LEGENDARY_START = 1;
    uint256 private constant LEGENDARY_END = 4;
    uint256 private constant EPIC_RARE_ID = 5;
    uint256 private constant EPIC_START = 6;
    uint256 private constant EPIC_END = 9;
    uint256 private constant RARE_START = 10;
    uint256 private constant RARE_END = 14;
    uint256 private constant COMMON_START = 15;
    uint256 private constant COMMON_END = 19;
    
    // ============ State Variables ============
    
    /// @notice Reference to the NFT contract
    IFantasyYC_NFT public nftContract;
    
    /// @notice Number of packs sold
    uint256 public packsSold;
    
    /// @notice Treasury address for receiving funds
    address public treasury;
    
    /// @notice Reference to the TournamentManager contract
    ITournamentManager public tournamentManager;
    
    /// @notice Active tournament ID for prize pool distribution
    uint256 public activeTournamentId;
    
    /// @notice Pack price (can be changed by admin)
    uint256 public currentPackPrice;
    
    /// @notice Prize pool share percentage (90%)
    uint256 public constant PRIZE_POOL_PERCENT = 90;
    
    /// @notice Treasury share percentage (10%)
    uint256 public constant TREASURY_PERCENT = 10;
    
    // ============ Structs ============
    
    struct PackPurchase {
        address buyer;
        uint256 purchaseTime;
        bool opened;
        uint256[5] cardIds;
    }
    
    // ============ Mappings ============
    
    /// @notice Pack purchases by pack ID
    mapping(uint256 => PackPurchase) public packs;
    
    /// @notice User's pack IDs
    mapping(address => uint256[]) public userPacks;
    
    // ============ Events ============
    
    event PackPurchased(
        address indexed buyer,
        uint256 indexed packId,
        uint256 price,
        uint256 timestamp
    );
    
    event PackOpened(
        address indexed owner,
        uint256 indexed packId,
        uint256[5] cardIds,
        uint256[5] startupIds
    );
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PackPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event TournamentManagerUpdated(address indexed oldTM, address indexed newTM);
    event ActiveTournamentUpdated(uint256 oldId, uint256 newId);
    event FundsDistributed(uint256 prizePoolAmount, uint256 treasuryAmount);
    
    // ============ Errors ============
    
    error InsufficientPayment();
    error MaxPacksReached();
    error PackAlreadyOpened();
    error NotPackOwner();
    error PackDoesNotExist();
    error ZeroAddress();
    error WithdrawFailed();
    error InvalidPrice();
    
    // ============ Constructor ============
    
    /**
     * @notice Initialize the PackOpener contract
     * @param _nftContract Address of the FantasyYC_NFT contract
     * @param _treasury Address to receive pack sale funds
     * @param initialOwner Initial owner of the contract
     */
    constructor(
        address _nftContract,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_nftContract == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();
        
        nftContract = IFantasyYC_NFT(_nftContract);
        treasury = _treasury;
        currentPackPrice = PACK_PRICE;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice Purchase a pack
     * @return packId The ID of the purchased pack
     */
    function buyPack() external payable whenNotPaused nonReentrant returns (uint256 packId) {
        if (msg.value < currentPackPrice) revert InsufficientPayment();
        if (packsSold >= MAX_PACKS) revert MaxPacksReached();
        
        packId = packsSold + 1;
        packsSold++;
        
        packs[packId] = PackPurchase({
            buyer: msg.sender,
            purchaseTime: block.timestamp,
            opened: false,
            cardIds: [uint256(0), uint256(0), uint256(0), uint256(0), uint256(0)]
        });
        
        userPacks[msg.sender].push(packId);
        
        // Distribute funds: 90% to prize pool, 10% to contract (treasury)
        _distributeFunds(currentPackPrice);
        
        // Refund excess payment
        if (msg.value > currentPackPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - currentPackPrice}("");
            if (!refundSuccess) revert WithdrawFailed();
        }
        
        emit PackPurchased(msg.sender, packId, currentPackPrice, block.timestamp);
        
        return packId;
    }
    
    /**
     * @notice Purchase and immediately open a pack
     * @return cardIds The token IDs of the minted cards
     * @return startupIds The startup IDs of the minted cards
     */
    function buyAndOpenPack() external payable whenNotPaused nonReentrant returns (
        uint256[5] memory cardIds,
        uint256[5] memory startupIds
    ) {
        if (msg.value < currentPackPrice) revert InsufficientPayment();
        if (packsSold >= MAX_PACKS) revert MaxPacksReached();
        
        uint256 packId = packsSold + 1;
        packsSold++;
        
        // Generate random startup IDs
        startupIds = _generateRandomCards(packId);
        
        // Mint the cards
        cardIds = nftContract.batchMint(msg.sender, startupIds);
        
        // Store pack info
        packs[packId] = PackPurchase({
            buyer: msg.sender,
            purchaseTime: block.timestamp,
            opened: true,
            cardIds: cardIds
        });
        
        userPacks[msg.sender].push(packId);
        
        // Distribute funds: 90% to prize pool, 10% to contract (treasury)
        _distributeFunds(currentPackPrice);
        
        // Refund excess payment
        if (msg.value > currentPackPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - currentPackPrice}("");
            if (!refundSuccess) revert WithdrawFailed();
        }
        
        emit PackPurchased(msg.sender, packId, currentPackPrice, block.timestamp);
        emit PackOpened(msg.sender, packId, cardIds, startupIds);
        
        return (cardIds, startupIds);
    }
    
    /**
     * @notice Open a previously purchased pack
     * @param packId The ID of the pack to open
     * @return cardIds The token IDs of the minted cards
     * @return startupIds The startup IDs of the minted cards
     */
    function openPack(uint256 packId) external whenNotPaused nonReentrant returns (
        uint256[5] memory cardIds,
        uint256[5] memory startupIds
    ) {
        PackPurchase storage pack = packs[packId];
        
        if (pack.buyer == address(0)) revert PackDoesNotExist();
        if (pack.buyer != msg.sender) revert NotPackOwner();
        if (pack.opened) revert PackAlreadyOpened();
        
        // Generate random startup IDs
        startupIds = _generateRandomCards(packId);
        
        // Mint the cards
        cardIds = nftContract.batchMint(msg.sender, startupIds);
        
        // Update pack info
        pack.opened = true;
        pack.cardIds = cardIds;
        
        emit PackOpened(msg.sender, packId, cardIds, startupIds);
        
        return (cardIds, startupIds);
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Generate 5 random startup IDs for a pack
     * @param packId Pack ID for randomness seed
     * @return startupIds Array of 5 startup IDs
     */
    function _generateRandomCards(uint256 packId) internal view returns (uint256[5] memory startupIds) {
        for (uint256 i = 0; i < CARDS_PER_PACK; i++) {
            // Generate unique seed for each card
            uint256 seed = uint256(keccak256(abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                packId,
                i
            )));
            
            // Determine rarity
            uint256 rarityRoll = seed % 100;
            
            // Pick startup based on rarity
            startupIds[i] = _pickStartupByRarity(rarityRoll, seed);
        }
        
        return startupIds;
    }
    
    /**
     * @dev Pick a startup ID based on rarity roll
     * @param rarityRoll Value 0-99 determining rarity
     * @param seed Random seed for selection within rarity tier
     * @return startupId The selected startup ID (1-19)
     */
    function _pickStartupByRarity(uint256 rarityRoll, uint256 seed) internal pure returns (uint256 startupId) {
        if (rarityRoll < COMMON_THRESHOLD) {
            // Common: IDs 15-19 (5 startups)
            startupId = COMMON_START + (seed / 100 % 5);
        } else if (rarityRoll < RARE_THRESHOLD) {
            // Rare: IDs 10-14 (5 startups)
            startupId = RARE_START + (seed / 100 % 5);
        } else {
            // Epic tier (5%): IDs 1-9
            // Sub-distribute: Legendary 40%, Epic Rare 10%, Epic 50%
            uint256 epicRoll = (seed / 10000) % 100;
            
            if (epicRoll < 40) {
                // Legendary: IDs 1-4
                startupId = LEGENDARY_START + (seed / 1000000 % 4);
            } else if (epicRoll < 50) {
                // Epic Rare: ID 5 (OpenAI)
                startupId = EPIC_RARE_ID;
            } else {
                // Epic: IDs 6-9
                startupId = EPIC_START + (seed / 1000000 % 4);
            }
        }
        
        return startupId;
    }
    
    /**
     * @dev Distribute pack payment between prize pool and treasury
     * @param amount Total payment amount
     */
    function _distributeFunds(uint256 amount) internal {
        // Calculate shares
        uint256 prizePoolShare = (amount * PRIZE_POOL_PERCENT) / 100;
        uint256 treasuryShare = amount - prizePoolShare; // Remainder to avoid rounding issues
        
        // Send 90% to prize pool if tournament is active
        if (address(tournamentManager) != address(0) && activeTournamentId > 0) {
            try tournamentManager.addToPrizePool{value: prizePoolShare}(activeTournamentId) {
                // Success - prizePoolShare sent to tournament
            } catch {
                // If prize pool transfer fails, keep funds in contract
                // Treasury will be able to withdraw all
            }
        }
        // 10% (treasuryShare) stays in contract for treasury withdrawal
        
        emit FundsDistributed(prizePoolShare, treasuryShare);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get remaining packs available
     * @return Number of packs remaining
     */
    function getPacksRemaining() external view returns (uint256) {
        return MAX_PACKS - packsSold;
    }
    
    /**
     * @notice Get user's pack IDs
     * @param user User address
     * @return Array of pack IDs owned by user
     */
    function getUserPacks(address user) external view returns (uint256[] memory) {
        return userPacks[user];
    }
    
    /**
     * @notice Get pack details
     * @param packId Pack ID to query
     * @return buyer Pack buyer address
     * @return purchaseTime When pack was purchased
     * @return opened Whether pack has been opened
     * @return cardIds Token IDs if opened, zeros otherwise
     */
    function getPackInfo(uint256 packId) external view returns (
        address buyer,
        uint256 purchaseTime,
        bool opened,
        uint256[5] memory cardIds
    ) {
        PackPurchase storage pack = packs[packId];
        return (pack.buyer, pack.purchaseTime, pack.opened, pack.cardIds);
    }
    
    /**
     * @notice Get user's unopened pack count
     * @param user User address
     * @return count Number of unopened packs
     */
    function getUnopenedPackCount(address user) external view returns (uint256 count) {
        uint256[] storage packIds = userPacks[user];
        for (uint256 i = 0; i < packIds.length; i++) {
            if (!packs[packIds[i]].opened) {
                count++;
            }
        }
        return count;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Withdraw contract funds to treasury
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        
        (bool success, ) = treasury.call{value: balance}("");
        if (!success) revert WithdrawFailed();
        
        emit FundsWithdrawn(treasury, balance);
    }
    
    /**
     * @notice Update pack price
     * @param newPrice New price in wei
     */
    function setPackPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        
        uint256 oldPrice = currentPackPrice;
        currentPackPrice = newPrice;
        
        emit PackPriceUpdated(oldPrice, newPrice);
    }
    
    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        
        address oldTreasury = treasury;
        treasury = newTreasury;
        
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /**
     * @notice Update NFT contract reference
     * @param newNftContract New NFT contract address
     */
    function setNftContract(address newNftContract) external onlyOwner {
        if (newNftContract == address(0)) revert ZeroAddress();
        nftContract = IFantasyYC_NFT(newNftContract);
    }
    
    /**
     * @notice Update TournamentManager contract reference
     * @param newTournamentManager New TournamentManager contract address
     */
    function setTournamentManager(address newTournamentManager) external onlyOwner {
        address oldTM = address(tournamentManager);
        tournamentManager = ITournamentManager(newTournamentManager);
        emit TournamentManagerUpdated(oldTM, newTournamentManager);
    }
    
    /**
     * @notice Set active tournament for prize pool distribution
     * @param tournamentId Tournament ID to receive pack sale funds
     */
    function setActiveTournament(uint256 tournamentId) external onlyOwner {
        uint256 oldId = activeTournamentId;
        activeTournamentId = tournamentId;
        emit ActiveTournamentUpdated(oldId, tournamentId);
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Receive Function ============
    
    /// @notice Allow contract to receive XTZ
    receive() external payable {}
}
