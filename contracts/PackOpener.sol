// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUnicornX_NFT {
    function batchMint(address to, uint256[5] calldata startupIds) external returns (uint256[5] memory);
    function totalSupply() external view returns (uint256);
}

interface ITournamentManager {
    function addToPrizePool(uint256 tournamentId) external payable;
}

/**
 * @title PackOpener
 * @author UnicornX Team
 * @notice Pack purchases with referral system
 * @dev Distribution:
 *   - With referrer: 10% referrer, 10% platform, 80% tournament
 *   - Without referrer: 10% platform, 90% tournament
 *   - If no active tournament: funds held in pendingPrizePool until tournament starts
 */
contract PackOpener is Ownable2Step, Pausable, ReentrancyGuard {

    // ============ Constants ============

    uint256 public constant PACK_PRICE = 5 ether;
    uint256 public constant MAX_PACKS = 10000;
    uint256 public constant CARDS_PER_PACK = 5;

    // Distribution percentages
    uint256 public constant REFERRAL_PERCENT = 10;
    uint256 public constant PLATFORM_PERCENT = 10;
    // Tournament gets remainder (80% with referral, 90% without)

    // Rarity Distribution
    uint256 private constant COMMON_THRESHOLD = 70;
    uint256 private constant RARE_THRESHOLD = 95;

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

    IUnicornX_NFT public nftContract;
    uint256 public packsSold;
    address public treasury;
    ITournamentManager public tournamentManager;
    uint256 public activeTournamentId;
    uint256 public currentPackPrice;

    /// @notice Pending prize pool funds when no tournament is active
    uint256 public pendingPrizePool;

    /// @notice Referrer mapping: user -> their referrer
    mapping(address => address) public referrers;

    /// @notice Referral earnings: referrer -> total earned
    mapping(address => uint256) public referralEarnings;

    /// @notice Number of referrals per referrer
    mapping(address => uint256) public referralCount;

    // ============ Structs ============

    struct PackPurchase {
        address buyer;
        uint256 purchaseTime;
        bool opened;
        uint256[5] cardIds;
    }

    // ============ Mappings ============

    mapping(uint256 => PackPurchase) public packs;
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

    event ReferralRegistered(address indexed user, address indexed referrer);
    event ReferralRewardPaid(address indexed referrer, address indexed buyer, uint256 amount);
    event FundsDistributed(uint256 prizePoolAmount, uint256 platformAmount, uint256 referralAmount);
    event PendingFundsForwarded(uint256 tournamentId, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PackPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event TournamentManagerUpdated(address indexed oldTM, address indexed newTM);
    event ActiveTournamentUpdated(uint256 oldId, uint256 newId);

    // ============ Errors ============

    error InsufficientPayment();
    error MaxPacksReached();
    error PackAlreadyOpened();
    error NotPackOwner();
    error PackDoesNotExist();
    error ZeroAddress();
    error WithdrawFailed();
    error InvalidPrice();
    error CannotReferSelf();
    error AlreadyHasReferrer();

    // ============ Constructor ============

    constructor(
        address _nftContract,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_nftContract == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (initialOwner == address(0)) revert ZeroAddress();

        nftContract = IUnicornX_NFT(_nftContract);
        treasury = _treasury;
        currentPackPrice = PACK_PRICE;
    }

    // ============ Referral Functions ============

    /**
     * @notice Register a referrer for the caller
     * @param referrer Address of the person who referred
     */
    function setReferrer(address referrer) external {
        if (referrer == msg.sender) revert CannotReferSelf();
        if (referrer == address(0)) revert ZeroAddress();
        if (referrers[msg.sender] != address(0)) revert AlreadyHasReferrer();

        referrers[msg.sender] = referrer;
        referralCount[referrer]++;

        emit ReferralRegistered(msg.sender, referrer);
    }

    /**
     * @notice Get referrer for a user
     */
    function getReferrer(address user) external view returns (address) {
        return referrers[user];
    }

    /**
     * @notice Get referral stats for a referrer
     */
    function getReferralStats(address referrer) external view returns (
        uint256 count,
        uint256 totalEarned
    ) {
        return (referralCount[referrer], referralEarnings[referrer]);
    }

    // ============ Pack Purchase Functions ============

    /**
     * @notice Purchase a pack (checks for referrer automatically)
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

        _distributeFunds(currentPackPrice, msg.sender);

        // Refund excess
        if (msg.value > currentPackPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - currentPackPrice}("");
            if (!refundSuccess) revert WithdrawFailed();
        }

        emit PackPurchased(msg.sender, packId, currentPackPrice, block.timestamp);
        return packId;
    }

    /**
     * @notice Purchase and immediately open a pack
     */
    function buyAndOpenPack() external payable whenNotPaused nonReentrant returns (
        uint256[5] memory cardIds,
        uint256[5] memory startupIds
    ) {
        if (msg.value < currentPackPrice) revert InsufficientPayment();
        if (packsSold >= MAX_PACKS) revert MaxPacksReached();

        uint256 packId = packsSold + 1;
        packsSold++;

        startupIds = _generateRandomCards(packId);
        cardIds = nftContract.batchMint(msg.sender, startupIds);

        packs[packId] = PackPurchase({
            buyer: msg.sender,
            purchaseTime: block.timestamp,
            opened: true,
            cardIds: cardIds
        });

        userPacks[msg.sender].push(packId);

        _distributeFunds(currentPackPrice, msg.sender);

        // Refund excess
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
     */
    function openPack(uint256 packId) external whenNotPaused nonReentrant returns (
        uint256[5] memory cardIds,
        uint256[5] memory startupIds
    ) {
        PackPurchase storage pack = packs[packId];

        if (pack.buyer == address(0)) revert PackDoesNotExist();
        if (pack.buyer != msg.sender) revert NotPackOwner();
        if (pack.opened) revert PackAlreadyOpened();

        startupIds = _generateRandomCards(packId);
        cardIds = nftContract.batchMint(msg.sender, startupIds);

        pack.opened = true;
        pack.cardIds = cardIds;

        emit PackOpened(msg.sender, packId, cardIds, startupIds);
        return (cardIds, startupIds);
    }

    // ============ Internal Functions ============

    function _generateRandomCards(uint256 packId) internal view returns (uint256[5] memory startupIds) {
        for (uint256 i = 0; i < CARDS_PER_PACK; i++) {
            uint256 seed = uint256(keccak256(abi.encodePacked(
                block.prevrandao,
                block.timestamp,
                msg.sender,
                packId,
                i
            )));

            uint256 rarityRoll = seed % 100;
            startupIds[i] = _pickStartupByRarity(rarityRoll, seed);
        }
        return startupIds;
    }

    function _pickStartupByRarity(uint256 rarityRoll, uint256 seed) internal pure returns (uint256 startupId) {
        if (rarityRoll < COMMON_THRESHOLD) {
            startupId = COMMON_START + (seed / 100 % 5);
        } else if (rarityRoll < RARE_THRESHOLD) {
            startupId = RARE_START + (seed / 100 % 5);
        } else {
            uint256 epicRoll = (seed / 10000) % 100;
            if (epicRoll < 40) {
                startupId = LEGENDARY_START + (seed / 1000000 % 4);
            } else if (epicRoll < 50) {
                startupId = EPIC_RARE_ID;
            } else {
                startupId = EPIC_START + (seed / 1000000 % 4);
            }
        }
        return startupId;
    }

    /**
     * @dev Distribute pack payment: referral + platform + tournament
     */
    function _distributeFunds(uint256 amount, address buyer) internal {
        address referrer = referrers[buyer];
        uint256 referralShare = 0;
        uint256 platformShare = (amount * PLATFORM_PERCENT) / 100;
        uint256 tournamentShare;

        if (referrer != address(0)) {
            // Has referrer: 10% referrer, 10% platform, 80% tournament
            referralShare = (amount * REFERRAL_PERCENT) / 100;
            tournamentShare = amount - platformShare - referralShare;

            // Pay referrer
            (bool refSuccess, ) = referrer.call{value: referralShare}("");
            if (refSuccess) {
                referralEarnings[referrer] += referralShare;
                emit ReferralRewardPaid(referrer, buyer, referralShare);
            } else {
                // If referral payment fails, add to tournament pool
                tournamentShare += referralShare;
                referralShare = 0;
            }
        } else {
            // No referrer: 10% platform, 90% tournament
            tournamentShare = amount - platformShare;
        }

        // Platform share stays in contract for treasury withdrawal

        // Tournament share: send to active tournament or hold as pending
        if (address(tournamentManager) != address(0) && activeTournamentId > 0) {
            try tournamentManager.addToPrizePool{value: tournamentShare}(activeTournamentId) {
                // Success
            } catch {
                // If transfer fails, hold as pending
                pendingPrizePool += tournamentShare;
            }
        } else {
            // No active tournament - hold funds
            pendingPrizePool += tournamentShare;
        }

        emit FundsDistributed(tournamentShare, platformShare, referralShare);
    }

    // ============ View Functions ============

    function getPacksRemaining() external view returns (uint256) {
        return MAX_PACKS - packsSold;
    }

    function getUserPacks(address user) external view returns (uint256[] memory) {
        return userPacks[user];
    }

    function getPackInfo(uint256 packId) external view returns (
        address buyer,
        uint256 purchaseTime,
        bool opened,
        uint256[5] memory cardIds
    ) {
        PackPurchase storage pack = packs[packId];
        return (pack.buyer, pack.purchaseTime, pack.opened, pack.cardIds);
    }

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
     * @notice Forward pending prize pool to active tournament
     */
    function forwardPendingFunds() external onlyOwner nonReentrant {
        require(address(tournamentManager) != address(0), "No tournament manager");
        require(activeTournamentId > 0, "No active tournament");
        require(pendingPrizePool > 0, "No pending funds");

        uint256 amount = pendingPrizePool;
        pendingPrizePool = 0;

        tournamentManager.addToPrizePool{value: amount}(activeTournamentId);
        emit PendingFundsForwarded(activeTournamentId, amount);
    }

    function withdraw() external onlyOwner nonReentrant {
        // Only withdraw platform fees (not pending prize pool)
        uint256 platformBalance = address(this).balance - pendingPrizePool;
        if (platformBalance == 0) revert WithdrawFailed();

        (bool success, ) = treasury.call{value: platformBalance}("");
        if (!success) revert WithdrawFailed();

        emit FundsWithdrawn(treasury, platformBalance);
    }

    function setPackPrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) revert InvalidPrice();
        uint256 oldPrice = currentPackPrice;
        currentPackPrice = newPrice;
        emit PackPriceUpdated(oldPrice, newPrice);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setNftContract(address newNftContract) external onlyOwner {
        if (newNftContract == address(0)) revert ZeroAddress();
        nftContract = IUnicornX_NFT(newNftContract);
    }

    function setTournamentManager(address newTournamentManager) external onlyOwner {
        address oldTM = address(tournamentManager);
        tournamentManager = ITournamentManager(newTournamentManager);
        emit TournamentManagerUpdated(oldTM, newTournamentManager);
    }

    /**
     * @notice Set active tournament. Auto-forwards pending funds if any.
     */
    function setActiveTournament(uint256 tournamentId) external onlyOwner {
        uint256 oldId = activeTournamentId;
        activeTournamentId = tournamentId;
        emit ActiveTournamentUpdated(oldId, tournamentId);

        // Auto-forward pending funds to new tournament
        if (tournamentId > 0 && pendingPrizePool > 0 && address(tournamentManager) != address(0)) {
            uint256 amount = pendingPrizePool;
            pendingPrizePool = 0;
            try tournamentManager.addToPrizePool{value: amount}(tournamentId) {
                emit PendingFundsForwarded(tournamentId, amount);
            } catch {
                pendingPrizePool = amount; // Revert if fails
            }
        }
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    receive() external payable {}
}
