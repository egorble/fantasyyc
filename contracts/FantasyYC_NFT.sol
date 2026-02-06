// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FantasyYC_NFT
 * @author Fantasy YC Team
 * @notice Main ERC-721 NFT contract for Fantasy YC startup cards
 * @dev Implements 19 startup cards with 5 rarity tiers, lock mechanism for tournaments
 */
contract FantasyYC_NFT is ERC721, ERC721Enumerable, Ownable2Step, Pausable, ReentrancyGuard {
    
    // ============ Constants ============
    
    /// @notice Maximum supply of NFTs
    uint256 public constant MAX_SUPPLY = 10000;
    
    /// @notice Total number of startup types
    uint256 public constant TOTAL_STARTUPS = 19;
    
    // ============ Rarity Enums ============
    
    enum Rarity {
        Common,      // 1x multiplier
        Rare,        // 3x multiplier
        Epic,        // 5x multiplier
        EpicRare,    // 8x multiplier
        Legendary    // 10x multiplier
    }
    
    // ============ Structs ============
    
    struct StartupInfo {
        string name;
        Rarity rarity;
        uint256 multiplier;
    }
    
    struct CardInfo {
        uint256 startupId;
        uint256 edition;
        Rarity rarity;
        uint256 multiplier;
        bool isLocked;
        string name;
    }
    
    // ============ State Variables ============
    
    /// @notice Base URI for token metadata
    string public baseURI;
    
    /// @notice Next token ID to mint
    uint256 private _nextTokenId;
    
    /// @notice Maps tokenId to startupId (1-19)
    mapping(uint256 => uint256) public tokenToStartup;
    
    /// @notice Maps tokenId to edition number within that startup
    mapping(uint256 => uint256) public tokenToEdition;
    
    /// @notice Maps tokenId to lock status (locked in tournament)
    mapping(uint256 => bool) public isLocked;
    
    /// @notice Tracks mint count per startup type
    mapping(uint256 => uint256) public startupMintCount;
    
    /// @notice Authorized addresses that can mint (PackOpener)
    mapping(address => bool) public authorizedMinters;
    
    /// @notice Authorized addresses that can lock/unlock (TournamentManager)
    mapping(address => bool) public authorizedLockers;
    
    /// @notice Startup information by ID (1-19)
    mapping(uint256 => StartupInfo) public startups;
    
    // ============ Events ============
    
    event CardMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed startupId,
        uint256 edition
    );
    
    event CardLocked(uint256 indexed tokenId, address indexed locker);
    event CardUnlocked(uint256 indexed tokenId, address indexed unlocker);
    event CardsLockedBatch(uint256[] tokenIds, address indexed locker);
    event CardsUnlockedBatch(uint256[] tokenIds, address indexed unlocker);
    event AuthorizedMinterSet(address indexed minter, bool authorized);
    event AuthorizedLockerSet(address indexed locker, bool authorized);
    event BaseURIUpdated(string newBaseURI);
    event CardsMerged(
        address indexed owner,
        uint256[3] burnedTokenIds,
        uint256 indexed newTokenId,
        Rarity fromRarity,
        Rarity toRarity
    );
    
    // ============ Errors ============
    
    error MaxSupplyReached();
    error InvalidStartupId();
    error NotAuthorizedMinter();
    error NotAuthorizedLocker();
    error CardIsLocked();
    error CardNotLocked();
    error ZeroAddress();
    error ArrayLengthMismatch();
    error NotCardOwner();
    error CannotMergeLegendary();
    error RarityMismatch();
    
    // ============ Modifiers ============
    
    modifier onlyAuthorizedMinter() {
        if (!authorizedMinters[msg.sender]) revert NotAuthorizedMinter();
        _;
    }
    
    modifier onlyAuthorizedLocker() {
        if (!authorizedLockers[msg.sender]) revert NotAuthorizedLocker();
        _;
    }
    
    // ============ Constructor ============
    
    /**
     * @notice Initializes the Fantasy YC NFT contract
     * @param initialOwner The initial owner of the contract
     */
    constructor(address initialOwner) 
        ERC721("Fantasy YC", "FYC") 
        Ownable(initialOwner) 
    {
        if (initialOwner == address(0)) revert ZeroAddress();
        
        // Dynamic metadata API - localhost for testing, update for production
        // Backend generates metadata dynamically for each tokenId
        baseURI = "http://localhost:3001/metadata/";
        _nextTokenId = 1;
        
        _initializeStartups();
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Initialize all 19 startup types with their rarity and multipliers
     */
    function _initializeStartups() private {
        // Legendary (10x multiplier) - IDs 1-4
        startups[1] = StartupInfo("Manus", Rarity.Legendary, 10);
        startups[2] = StartupInfo("Lovable", Rarity.Legendary, 10);
        startups[3] = StartupInfo("Cursor", Rarity.Legendary, 10);
        startups[4] = StartupInfo("Anthropic", Rarity.Legendary, 10);
        
        // Epic Rare (8x multiplier) - ID 5
        startups[5] = StartupInfo("OpenAI", Rarity.EpicRare, 8);
        
        // Epic (5x multiplier) - IDs 6-9
        startups[6] = StartupInfo("Browser Use", Rarity.Epic, 5);
        startups[7] = StartupInfo("Dedalus Labs", Rarity.Epic, 5);
        startups[8] = StartupInfo("Autumn", Rarity.Epic, 5);
        startups[9] = StartupInfo("Axiom", Rarity.Epic, 5);
        
        // Rare (3x multiplier) - IDs 10-14
        startups[10] = StartupInfo("Multifactor", Rarity.Rare, 3);
        startups[11] = StartupInfo("Dome", Rarity.Rare, 3);
        startups[12] = StartupInfo("GrazeMate", Rarity.Rare, 3);
        startups[13] = StartupInfo("Tornyol Systems", Rarity.Rare, 3);
        startups[14] = StartupInfo("Axiom", Rarity.Rare, 3);
        
        // Common (1x multiplier) - IDs 15-19
        startups[15] = StartupInfo("Pocket", Rarity.Common, 1);
        startups[16] = StartupInfo("Caretta", Rarity.Common, 1);
        startups[17] = StartupInfo("AxionOrbital Space", Rarity.Common, 1);
        startups[18] = StartupInfo("Freeport Markets", Rarity.Common, 1);
        startups[19] = StartupInfo("Ruvo", Rarity.Common, 1);
    }
    
    /**
     * @dev Internal mint function
     * @param to Address to mint to
     * @param startupId Startup ID (1-19)
     * @return tokenId The minted token ID
     */
    function _mintCard(address to, uint256 startupId) private returns (uint256) {
        if (totalSupply() >= MAX_SUPPLY) revert MaxSupplyReached();
        if (startupId < 1 || startupId > TOTAL_STARTUPS) revert InvalidStartupId();
        
        uint256 tokenId = _nextTokenId++;
        
        // Track startup and edition
        startupMintCount[startupId]++;
        tokenToStartup[tokenId] = startupId;
        tokenToEdition[tokenId] = startupMintCount[startupId];
        
        _safeMint(to, tokenId);
        
        emit CardMinted(to, tokenId, startupId, tokenToEdition[tokenId]);
        
        return tokenId;
    }
    
    // ============ External Minting Functions ============
    
    /**
     * @notice Mint a single card
     * @param to Address to mint to
     * @param startupId Startup ID (1-19)
     * @return tokenId The minted token ID
     */
    function mint(address to, uint256 startupId) 
        external 
        onlyAuthorizedMinter 
        whenNotPaused 
        returns (uint256) 
    {
        if (to == address(0)) revert ZeroAddress();
        return _mintCard(to, startupId);
    }
    
    /**
     * @notice Batch mint 5 cards for pack opening
     * @param to Address to mint to
     * @param startupIds Array of 5 startup IDs
     * @return tokenIds Array of minted token IDs
     */
    function batchMint(address to, uint256[5] calldata startupIds) 
        external 
        onlyAuthorizedMinter 
        whenNotPaused 
        returns (uint256[5] memory tokenIds) 
    {
        if (to == address(0)) revert ZeroAddress();
        if (totalSupply() + 5 > MAX_SUPPLY) revert MaxSupplyReached();
        
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = _mintCard(to, startupIds[i]);
        }
        
        return tokenIds;
    }
    
    // ============ Lock/Unlock Functions ============
    
    /**
     * @notice Lock a card for tournament entry
     * @param tokenId Token ID to lock
     */
    function lockCard(uint256 tokenId) external onlyAuthorizedLocker {
        if (isLocked[tokenId]) revert CardIsLocked();
        isLocked[tokenId] = true;
        emit CardLocked(tokenId, msg.sender);
    }
    
    /**
     * @notice Unlock a card after tournament
     * @param tokenId Token ID to unlock
     */
    function unlockCard(uint256 tokenId) external onlyAuthorizedLocker {
        if (!isLocked[tokenId]) revert CardNotLocked();
        isLocked[tokenId] = false;
        emit CardUnlocked(tokenId, msg.sender);
    }
    
    /**
     * @notice Batch lock multiple cards
     * @param tokenIds Array of token IDs to lock
     */
    function batchLock(uint256[] calldata tokenIds) external onlyAuthorizedLocker {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (!isLocked[tokenIds[i]]) {
                isLocked[tokenIds[i]] = true;
            }
        }
        emit CardsLockedBatch(tokenIds, msg.sender);
    }
    
    /**
     * @notice Batch unlock multiple cards
     * @param tokenIds Array of token IDs to unlock
     */
    function batchUnlock(uint256[] calldata tokenIds) external onlyAuthorizedLocker {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (isLocked[tokenIds[i]]) {
                isLocked[tokenIds[i]] = false;
            }
        }
        emit CardsUnlockedBatch(tokenIds, msg.sender);
    }
    
    // ============ Merge Functions ============
    
    /**
     * @notice Merge 3 cards of same rarity into 1 card of higher rarity
     * @param tokenIds Array of exactly 3 token IDs to merge
     * @return newTokenId The newly minted higher-rarity token
     */
    function mergeCards(uint256[3] calldata tokenIds) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 newTokenId) 
    {
        // Verify ownership and not locked
        for (uint256 i = 0; i < 3; i++) {
            if (ownerOf(tokenIds[i]) != msg.sender) revert NotCardOwner();
            if (isLocked[tokenIds[i]]) revert CardIsLocked();
        }
        
        // Get rarity of first card
        uint256 startupId0 = tokenToStartup[tokenIds[0]];
        Rarity fromRarity = startups[startupId0].rarity;
        
        // Verify all 3 cards have same rarity
        for (uint256 i = 1; i < 3; i++) {
            uint256 sid = tokenToStartup[tokenIds[i]];
            if (startups[sid].rarity != fromRarity) revert RarityMismatch();
        }
        
        // Cannot merge Legendary cards
        if (fromRarity == Rarity.Legendary) revert CannotMergeLegendary();
        
        // Calculate next rarity tier
        Rarity toRarity = Rarity(uint8(fromRarity) + 1);
        
        // Get random startup of higher rarity
        uint256 newStartupId = _getRandomStartupByRarity(toRarity, tokenIds[0]);
        
        // Burn all 3 cards
        for (uint256 i = 0; i < 3; i++) {
            _burn(tokenIds[i]);
        }
        
        // Mint new higher-rarity card
        newTokenId = _mintCard(msg.sender, newStartupId);
        
        emit CardsMerged(msg.sender, tokenIds, newTokenId, fromRarity, toRarity);
        
        return newTokenId;
    }
    
    /**
     * @dev Get a random startup ID within a specific rarity tier
     * @param rarity Target rarity tier
     * @param seed Additional randomness seed
     * @return startupId Random startup ID of the specified rarity
     */
    function _getRandomStartupByRarity(Rarity rarity, uint256 seed) internal view returns (uint256) {
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.prevrandao,
            block.timestamp,
            msg.sender,
            seed
        )));
        
        if (rarity == Rarity.Common) {
            // IDs 15-19 (5 options)
            return 15 + (random % 5);
        } else if (rarity == Rarity.Rare) {
            // IDs 10-14 (5 options)
            return 10 + (random % 5);
        } else if (rarity == Rarity.Epic) {
            // IDs 6-9 (4 options)
            return 6 + (random % 4);
        } else if (rarity == Rarity.EpicRare) {
            // ID 5 (only 1 option)
            return 5;
        } else {
            // Legendary: IDs 1-4 (4 options)
            return 1 + (random % 4);
        }
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get complete card information
     * @param tokenId Token ID to query
     * @return info CardInfo struct with all card details
     */
    function getCardInfo(uint256 tokenId) external view returns (CardInfo memory info) {
        uint256 startupId = tokenToStartup[tokenId];
        StartupInfo memory startup = startups[startupId];
        
        info = CardInfo({
            startupId: startupId,
            edition: tokenToEdition[tokenId],
            rarity: startup.rarity,
            multiplier: startup.multiplier,
            isLocked: isLocked[tokenId],
            name: startup.name
        });
    }
    
    /**
     * @notice Get startup information
     * @param startupId Startup ID (1-19)
     * @return StartupInfo struct
     */
    function getStartupInfo(uint256 startupId) external view returns (StartupInfo memory) {
        if (startupId < 1 || startupId > TOTAL_STARTUPS) revert InvalidStartupId();
        return startups[startupId];
    }
    
    /**
     * @notice Get all token IDs owned by an address
     * @param owner Address to query
     * @return tokenIds Array of owned token IDs
     */
    function getOwnedTokens(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        for (uint256 i = 0; i < balance; i++) {
            tokenIds[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return tokenIds;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set authorized minter status
     * @param minter Address to authorize/deauthorize
     * @param authorized Whether to authorize or deauthorize
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        authorizedMinters[minter] = authorized;
        emit AuthorizedMinterSet(minter, authorized);
    }
    
    /**
     * @notice Set authorized locker status
     * @param locker Address to authorize/deauthorize
     * @param authorized Whether to authorize or deauthorize
     */
    function setAuthorizedLocker(address locker, bool authorized) external onlyOwner {
        if (locker == address(0)) revert ZeroAddress();
        authorizedLockers[locker] = authorized;
        emit AuthorizedLockerSet(locker, authorized);
    }
    
    /**
     * @notice Update base URI for metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
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
    
    // ============ Overrides ============
    
    /**
     * @dev Returns the base URI for token metadata
     */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
    
    /**
     * @notice Returns the token URI for a given token ID
     * @dev Returns baseURI + tokenId (no .json suffix)
     *      Backend API dynamically generates metadata
     *      Example: https://api.fantasyyc.app/metadata/3421
     * @param tokenId Token ID
     * @return Token URI string
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        
        string memory base = _baseURI();
        return bytes(base).length > 0 
            ? string(abi.encodePacked(base, _toString(tokenId)))
            : "";
    }
    
    /**
     * @dev Convert uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @dev Hook called before any token transfer
     * Prevents transfer of locked cards
     */
    function _update(address to, uint256 tokenId, address auth) 
        internal 
        override(ERC721, ERC721Enumerable) 
        returns (address) 
    {
        // Check if card is locked (but allow minting - from address is zero)
        address from = _ownerOf(tokenId);
        if (from != address(0) && isLocked[tokenId]) {
            revert CardIsLocked();
        }
        
        return super._update(to, tokenId, auth);
    }
    
    /**
     * @dev Override required by Solidity for ERC721Enumerable
     */
    function _increaseBalance(address account, uint128 value) 
        internal 
        override(ERC721, ERC721Enumerable) 
    {
        super._increaseBalance(account, value);
    }
    
    /**
     * @dev Override required by Solidity
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC721Enumerable) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
