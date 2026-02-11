// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IUnicornX_NFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function batchLock(uint256[] calldata tokenIds) external;
    function batchUnlock(uint256[] calldata tokenIds) external;
    function isLocked(uint256 tokenId) external view returns (bool);
    function getCardInfo(uint256 tokenId) external view returns (
        uint256 startupId,
        uint256 edition,
        uint8 rarity,
        uint256 multiplier,
        bool locked,
        string memory name
    );
}

/**
 * @title TournamentManager
 * @author UnicornX Team
 * @notice Manage weekly tournaments with registration period, NFT freeze, and prize distribution
 * @dev NFTs are frozen (locked) during tournament, users can cancel before start
 */
contract TournamentManager is Ownable2Step, Pausable, ReentrancyGuard {
    
    // ============ Constants ============
    
    /// @notice Number of cards per lineup
    uint256 public constant LINEUP_SIZE = 5;

    /// @notice Hardcoded second admin address
    address public constant SECOND_ADMIN = 0xB36402e87a86206D3a114a98B53f31362291fe1B;
    
    // ============ Enums ============
    
    enum TournamentStatus {
        Created,      // Tournament created, registration open
        Active,       // Tournament started, NFTs frozen
        Finalized,    // Tournament ended, prizes set
        Cancelled     // Tournament cancelled
    }
    
    // ============ Structs ============
    
    struct Tournament {
        uint256 id;
        uint256 registrationStart;  // When registration opens  
        uint256 startTime;          // When tournament starts (no more registration/cancellation)
        uint256 endTime;            // When tournament ends
        uint256 prizePool;
        uint256 entryCount;
        TournamentStatus status;
    }
    
    struct Lineup {
        uint256[5] cardIds;
        address owner;
        uint256 timestamp;
        bool cancelled;
        bool claimed;
    }
    
    // ============ State Variables ============
    
    /// @notice Reference to the NFT contract
    IUnicornX_NFT public nftContract;
    
    /// @notice Reference to the PackOpener contract (for prize pool deposits)
    address public packOpener;
    
    /// @notice Next tournament ID
    uint256 public nextTournamentId;
    
    /// @notice Tournament by ID
    mapping(uint256 => Tournament) public tournaments;
    
    /// @notice Lineups: tournamentId => user => lineup
    mapping(uint256 => mapping(address => Lineup)) public lineups;
    
    /// @notice Prize allocation: tournamentId => user => prize amount
    mapping(uint256 => mapping(address => uint256)) public prizes;
    
    /// @notice Tournament participants: tournamentId => array of addresses
    mapping(uint256 => address[]) public tournamentParticipants;
    
    /// @notice Check if user has entered: tournamentId => user => bool
    mapping(uint256 => mapping(address => bool)) public hasEntered;
    
    /// @notice Startup points per tournament: tournamentId => startupId => points
    mapping(uint256 => mapping(uint256 => uint256)) public tournamentPoints;
    
    /// @notice User scores after calculation: tournamentId => user => score
    mapping(uint256 => mapping(address => uint256)) public userScores;
    
    /// @notice Total score for tournament (sum of all user scores)
    mapping(uint256 => uint256) public totalTournamentScore;
    
    /// @notice Number of startups (1-19)
    uint256 public constant TOTAL_STARTUPS = 19;
    
    // ============ Events ============
    
    event TournamentCreated(
        uint256 indexed tournamentId,
        uint256 registrationStart,
        uint256 startTime,
        uint256 endTime
    );
    
    event TournamentUpdated(
        uint256 indexed tournamentId,
        uint256 newStartTime,
        uint256 newEndTime
    );
    
    event LineupRegistered(
        uint256 indexed tournamentId,
        address indexed user,
        uint256[5] cardIds
    );
    
    event LineupCancelled(
        uint256 indexed tournamentId,
        address indexed user
    );
    
    event TournamentStarted(uint256 indexed tournamentId);
    
    event TournamentFinalized(
        uint256 indexed tournamentId,
        uint256 prizePool,
        uint256 winnersCount
    );
    
    event TournamentCancelled(uint256 indexed tournamentId);
    
    event PrizeClaimed(
        uint256 indexed tournamentId,
        address indexed user,
        uint256 prizeAmount
    );
    
    event NFTsUnfrozen(
        uint256 indexed tournamentId,
        address indexed user,
        uint256[5] cardIds
    );
    
    event PrizePoolIncreased(
        uint256 indexed tournamentId,
        uint256 amount,
        uint256 newTotal
    );
    
    event PackOpenerUpdated(address indexed oldPackOpener, address indexed newPackOpener);
    
    // ============ Errors ============
    
    error TournamentDoesNotExist();
    error TournamentNotInRegistration();
    error TournamentNotActive();
    error TournamentNotFinalized();
    error TournamentAlreadyFinalized();
    error TournamentAlreadyStarted();
    error InvalidTimeRange();
    error AlreadyEntered();
    error NotCardOwner();
    error CardAlreadyLocked();
    error AlreadyClaimed();
    error ArrayLengthMismatch();
    error ZeroAddress();
    error WithdrawFailed();
    error NotEntered();
    error TournamentCancelledError();
    error UnauthorizedCaller();
    error InsufficientPrizePool();
    error CannotCancelAfterStart();
    error LineupAlreadyCancelled();
    error RegistrationNotOpen();
    error NotAdmin();

    // ============ Modifiers ============

    modifier onlyAdmin() {
        if (msg.sender != owner() && msg.sender != SECOND_ADMIN) revert NotAdmin();
        _;
    }

    // ============ Constructor ============
    
    constructor(address _nftContract) Ownable(msg.sender) {
        if (_nftContract == address(0)) revert ZeroAddress();
        
        nftContract = IUnicornX_NFT(_nftContract);
        nextTournamentId = 1;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Create a new tournament
     * @param registrationStart When registration opens
     * @param startTime Tournament start timestamp (registration closes)
     * @param endTime Tournament end timestamp
     * @return tournamentId The ID of the created tournament
     */
    function createTournament(
        uint256 registrationStart,
        uint256 startTime, 
        uint256 endTime
    ) external onlyAdmin returns (uint256 tournamentId) {
        if (registrationStart >= startTime) revert InvalidTimeRange();
        if (startTime >= endTime) revert InvalidTimeRange();
        
        tournamentId = nextTournamentId++;
        
        tournaments[tournamentId] = Tournament({
            id: tournamentId,
            registrationStart: registrationStart,
            startTime: startTime,
            endTime: endTime,
            prizePool: 0,
            entryCount: 0,
            status: TournamentStatus.Created
        });
        
        emit TournamentCreated(tournamentId, registrationStart, startTime, endTime);
        
        return tournamentId;
    }
    
    /**
     * @notice Update tournament times (only before start)
     * @param tournamentId Tournament ID
     * @param newStartTime New start time
     * @param newEndTime New end time
     */
    function updateTournament(
        uint256 tournamentId,
        uint256 newStartTime,
        uint256 newEndTime
    ) external onlyAdmin {
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (block.timestamp >= tournament.startTime) revert TournamentAlreadyStarted();
        if (newStartTime >= newEndTime) revert InvalidTimeRange();
        
        tournament.startTime = newStartTime;
        tournament.endTime = newEndTime;
        
        emit TournamentUpdated(tournamentId, newStartTime, newEndTime);
    }
    
    /**
     * @notice Add funds to tournament prize pool
     * @param tournamentId Tournament ID
     */
    function addToPrizePool(uint256 tournamentId) external payable {
        if (msg.sender != owner() && msg.sender != SECOND_ADMIN && msg.sender != packOpener) revert UnauthorizedCaller();
        
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status == TournamentStatus.Finalized) revert TournamentAlreadyFinalized();
        if (tournament.status == TournamentStatus.Cancelled) revert TournamentCancelledError();
        
        tournament.prizePool += msg.value;
        
        emit PrizePoolIncreased(tournamentId, msg.value, tournament.prizePool);
    }
    
    /**
     * @notice Withdraw from prize pool (owner only)
     */
    function withdrawFromPrizePool(uint256 tournamentId, uint256 amount, address to) 
        external
        onlyAdmin
        nonReentrant
    {
        if (to == address(0)) revert ZeroAddress();
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (amount > tournament.prizePool) revert InsufficientPrizePool();
        
        tournament.prizePool -= amount;
        
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Finalize tournament and set winners
     * @param tournamentId Tournament ID
     * @param winners Array of winner addresses
     * @param amounts Array of prize amounts
     */
    function finalizeTournament(
        uint256 tournamentId,
        address[] calldata winners,
        uint256[] calldata amounts
    ) external onlyAdmin nonReentrant {
        if (winners.length != amounts.length) revert ArrayLengthMismatch();
        
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status == TournamentStatus.Finalized) revert TournamentAlreadyFinalized();
        if (tournament.status == TournamentStatus.Cancelled) revert TournamentCancelledError();
        
        // Set prizes for winners
        for (uint256 i = 0; i < winners.length; i++) {
            if (winners[i] != address(0)) {
                prizes[tournamentId][winners[i]] = amounts[i];
            }
        }
        
        tournament.status = TournamentStatus.Finalized;
        
        // Unfreeze all participants' NFTs
        address[] storage participants = tournamentParticipants[tournamentId];
        for (uint256 i = 0; i < participants.length; i++) {
            _unfreezeLineup(tournamentId, participants[i]);
        }
        
        emit TournamentFinalized(tournamentId, tournament.prizePool, winners.length);
    }
    
    /**
     * @notice Finalize tournament with points-based prize distribution
     * @dev Calculates each user's score = sum(points[startupId] * nftMultiplier) for their 5 cards
     * @dev Prize = (userScore / totalScore) * prizePool
     * @param tournamentId Tournament ID
     * @param points Array of 19 points values for startupIds 1-19 (index 0 = startupId 1)
     */
    function finalizeWithPoints(
        uint256 tournamentId,
        uint256[19] calldata points
    ) external onlyAdmin nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status == TournamentStatus.Finalized) revert TournamentAlreadyFinalized();
        if (tournament.status == TournamentStatus.Cancelled) revert TournamentCancelledError();

        // Store points for each startup (startupId 1-19)
        for (uint256 i = 0; i < TOTAL_STARTUPS; i++) {
            tournamentPoints[tournamentId][i + 1] = points[i];
        }
        
        address[] storage participants = tournamentParticipants[tournamentId];
        uint256 participantCount = participants.length;
        uint256 totalScore = 0;
        
        // Calculate scores for all participants
        for (uint256 i = 0; i < participantCount; i++) {
            address user = participants[i];
            Lineup storage lineup = lineups[tournamentId][user];
            
            // Skip cancelled entries
            if (lineup.cancelled) continue;
            
            uint256 userScore = 0;
            
            // Calculate score for each of 5 cards
            for (uint256 j = 0; j < LINEUP_SIZE; j++) {
                uint256 tokenId = lineup.cardIds[j];
                (uint256 startupId, , , uint256 multiplier, , ) = nftContract.getCardInfo(tokenId);
                
                // score += points[startupId] * multiplier
                uint256 cardPoints = tournamentPoints[tournamentId][startupId];
                unchecked {
                    userScore += cardPoints * multiplier;
                }
            }
            
            userScores[tournamentId][user] = userScore;
            unchecked {
                totalScore += userScore;
            }
        }
        
        totalTournamentScore[tournamentId] = totalScore;
        
        // Calculate proportional prizes
        if (totalScore > 0) {
            uint256 prizePool = tournament.prizePool;
            
            for (uint256 i = 0; i < participantCount; i++) {
                address user = participants[i];
                uint256 score = userScores[tournamentId][user];
                
                if (score > 0) {
                    // prize = (userScore * prizePool) / totalScore
                    uint256 prize = (score * prizePool) / totalScore;
                    prizes[tournamentId][user] = prize;
                }
            }
        }
        
        tournament.status = TournamentStatus.Finalized;
        
        // Unfreeze all participants' NFTs
        for (uint256 i = 0; i < participantCount; i++) {
            _unfreezeLineup(tournamentId, participants[i]);
        }
        
        emit TournamentFinalized(tournamentId, tournament.prizePool, participantCount);
    }

    
    /**
     * @notice Cancel tournament and unfreeze all NFTs
     * @param tournamentId Tournament ID
     */
    function cancelTournament(uint256 tournamentId) external onlyAdmin nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status == TournamentStatus.Finalized) revert TournamentAlreadyFinalized();
        if (tournament.status == TournamentStatus.Cancelled) revert TournamentCancelledError();
        
        tournament.status = TournamentStatus.Cancelled;
        
        // Unfreeze all participants' NFTs
        address[] storage participants = tournamentParticipants[tournamentId];
        for (uint256 i = 0; i < participants.length; i++) {
            _unfreezeLineup(tournamentId, participants[i]);
        }
        
        emit TournamentCancelled(tournamentId);
    }
    
    /**
     * @notice Set PackOpener contract address
     */
    function setPackOpener(address newPackOpener) external onlyAdmin {
        address oldPackOpener = packOpener;
        packOpener = newPackOpener;
        emit PackOpenerUpdated(oldPackOpener, newPackOpener);
    }
    
    /**
     * @notice Emergency withdraw
     */
    function emergencyWithdraw(uint256 amount, address to) external onlyAdmin nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Pause/unpause contract
     */
    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }
    
    // ============ User Functions ============
    
    /**
     * @notice Register lineup for tournament (during registration period)
     * @param tournamentId Tournament ID
     * @param cardIds Array of 5 card token IDs
     */
    function enterTournament(uint256 tournamentId, uint256[5] calldata cardIds) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Tournament storage tournament = tournaments[tournamentId];
        
        // Check tournament state
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status == TournamentStatus.Finalized) revert TournamentAlreadyFinalized();
        if (tournament.status == TournamentStatus.Cancelled) revert TournamentCancelledError();
        if (block.timestamp < tournament.registrationStart) revert RegistrationNotOpen();
        if (block.timestamp >= tournament.endTime) revert TournamentAlreadyStarted();
        if (hasEntered[tournamentId][msg.sender]) revert AlreadyEntered();
        
        // Verify ownership and not already locked
        for (uint256 i = 0; i < LINEUP_SIZE; i++) {
            if (nftContract.ownerOf(cardIds[i]) != msg.sender) revert NotCardOwner();
            if (nftContract.isLocked(cardIds[i])) revert CardAlreadyLocked();
        }
        
        // Freeze (lock) cards
        uint256[] memory tokenIds = new uint256[](LINEUP_SIZE);
        for (uint256 i = 0; i < LINEUP_SIZE; i++) {
            tokenIds[i] = cardIds[i];
        }
        nftContract.batchLock(tokenIds);
        
        // Store lineup
        lineups[tournamentId][msg.sender] = Lineup({
            cardIds: cardIds,
            owner: msg.sender,
            timestamp: block.timestamp,
            cancelled: false,
            claimed: false
        });
        
        hasEntered[tournamentId][msg.sender] = true;
        tournamentParticipants[tournamentId].push(msg.sender);
        tournament.entryCount++;
        
        emit LineupRegistered(tournamentId, msg.sender, cardIds);
    }
    
    /**
     * @notice Cancel entry (only before tournament starts)
     * @param tournamentId Tournament ID
     */
    function cancelEntry(uint256 tournamentId) external nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        Lineup storage lineup = lineups[tournamentId][msg.sender];
        
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (!hasEntered[tournamentId][msg.sender]) revert NotEntered();
        if (lineup.cancelled) revert LineupAlreadyCancelled();
        if (block.timestamp >= tournament.startTime) revert CannotCancelAfterStart();
        
        lineup.cancelled = true;
        tournament.entryCount--;
        
        // Unfreeze (unlock) cards
        uint256[] memory tokenIds = new uint256[](LINEUP_SIZE);
        for (uint256 i = 0; i < LINEUP_SIZE; i++) {
            tokenIds[i] = lineup.cardIds[i];
        }
        nftContract.batchUnlock(tokenIds);
        
        emit LineupCancelled(tournamentId, msg.sender);
    }
    
    /**
     * @notice Claim prize after tournament is finalized
     * @param tournamentId Tournament ID
     */
    function claimPrize(uint256 tournamentId) external nonReentrant {
        Tournament storage tournament = tournaments[tournamentId];
        Lineup storage lineup = lineups[tournamentId][msg.sender];
        
        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.Finalized) revert TournamentNotFinalized();
        if (!hasEntered[tournamentId][msg.sender]) revert NotEntered();
        if (lineup.claimed) revert AlreadyClaimed();
        if (lineup.cancelled) revert LineupAlreadyCancelled();
        
        lineup.claimed = true;
        
        // Send prize if any
        uint256 prizeAmount = prizes[tournamentId][msg.sender];
        if (prizeAmount > 0) {
            (bool success, ) = msg.sender.call{value: prizeAmount}("");
            if (!success) revert WithdrawFailed();
            emit PrizeClaimed(tournamentId, msg.sender, prizeAmount);
        }
    }
    
    // ============ Internal Functions ============
    
    /**
     * @dev Unfreeze a user's lineup NFTs
     */
    function _unfreezeLineup(uint256 tournamentId, address user) internal {
        Lineup storage lineup = lineups[tournamentId][user];
        
        if (lineup.cancelled) return; // Already unfrozen when cancelled
        
        uint256[] memory tokenIds = new uint256[](LINEUP_SIZE);
        for (uint256 i = 0; i < LINEUP_SIZE; i++) {
            tokenIds[i] = lineup.cardIds[i];
        }
        
        try nftContract.batchUnlock(tokenIds) {
            emit NFTsUnfrozen(tournamentId, user, lineup.cardIds);
        } catch {}
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get tournament details
     */
    function getTournament(uint256 tournamentId) external view returns (Tournament memory) {
        return tournaments[tournamentId];
    }
    
    /**
     * @notice Get user's lineup for a tournament
     */
    function getUserLineup(uint256 tournamentId, address user) external view returns (
        uint256[5] memory cardIds,
        address owner,
        uint256 timestamp,
        bool cancelled,
        bool claimed
    ) {
        Lineup storage lineup = lineups[tournamentId][user];
        return (lineup.cardIds, lineup.owner, lineup.timestamp, lineup.cancelled, lineup.claimed);
    }
    
    /**
     * @notice Get all participants in a tournament
     */
    function getTournamentParticipants(uint256 tournamentId) external view returns (address[] memory) {
        return tournamentParticipants[tournamentId];
    }
    
    /**
     * @notice Get user's prize for a tournament
     */
    function getUserPrize(uint256 tournamentId, address user) external view returns (uint256) {
        return prizes[tournamentId][user];
    }
    
    /**
     * @notice Get user's score and prize info for a tournament
     */
    function getUserScoreInfo(uint256 tournamentId, address user) external view returns (
        uint256 score,
        uint256 prize,
        uint256 totalScore
    ) {
        return (
            userScores[tournamentId][user],
            prizes[tournamentId][user],
            totalTournamentScore[tournamentId]
        );
    }
    
    /**
     * @notice Get all tournament points for startups 1-19
     */
    function getTournamentPoints(uint256 tournamentId) external view returns (uint256[19] memory points) {
        for (uint256 i = 0; i < TOTAL_STARTUPS; i++) {
            points[i] = tournamentPoints[tournamentId][i + 1];
        }
        return points;
    }
    
    /**
     * @notice Get active entry count (excluding cancelled)
     */
    function getActiveEntryCount(uint256 tournamentId) external view returns (uint256) {
        return tournaments[tournamentId].entryCount;
    }
    
    /**
     * @notice Check if user can register for tournament
     */
    function canRegister(uint256 tournamentId, address user) external view returns (bool) {
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) return false;
        if (tournament.status != TournamentStatus.Created) return false;
        if (block.timestamp < tournament.registrationStart) return false;
        if (block.timestamp >= tournament.endTime) return false;
        if (hasEntered[tournamentId][user]) return false;
        return true;
    }
    
    /**
     * @notice Check if user can cancel entry
     */
    function canCancelEntry(uint256 tournamentId, address user) external view returns (bool) {
        Tournament storage tournament = tournaments[tournamentId];
        Lineup storage lineup = lineups[tournamentId][user];
        if (tournament.id == 0) return false;
        if (!hasEntered[tournamentId][user]) return false;
        if (lineup.cancelled) return false;
        if (block.timestamp >= tournament.startTime) return false;
        return true;
    }
    
    /**
     * @notice Get tournament phase
     */
    function getTournamentPhase(uint256 tournamentId) external view returns (string memory) {
        Tournament storage tournament = tournaments[tournamentId];
        if (tournament.id == 0) return "NotFound";
        if (tournament.status == TournamentStatus.Cancelled) return "Cancelled";
        if (tournament.status == TournamentStatus.Finalized) return "Finalized";
        if (block.timestamp < tournament.registrationStart) return "Upcoming";
        if (block.timestamp < tournament.startTime) return "Registration";
        if (block.timestamp < tournament.endTime) return "Active";
        return "Ended";
    }
    
    // ============ Receive ============
    
    receive() external payable {}
}
