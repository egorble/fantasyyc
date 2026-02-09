// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Marketplace
 * @author Fantasy YC Team
 * @notice NFT Marketplace for FantasyYC cards
 * @dev Supports listing, buying, cancelling with royalty & freeze check
 */
contract Marketplace is Ownable2Step, Pausable, ReentrancyGuard {
    
    // ============ Structs ============
    
    struct Listing {
        uint256 listingId;
        address seller;
        uint256 tokenId;
        uint256 price;
        uint256 listedAt;
        bool active;
    }
    
    // ============ State Variables ============
    
    /// @notice The FantasyYC NFT contract
    IERC721 public immutable nftContract;
    
    /// @notice Interface to check if token is locked
    IFantasyYC_NFT public immutable fantasyNFT;
    
    /// @notice Marketplace fee in basis points (e.g., 250 = 2.5%)
    uint256 public marketplaceFee = 0; // Start with 0% fee
    
    /// @notice Fee recipient
    address public feeRecipient;
    
    /// @notice Next listing ID
    uint256 private _nextListingId = 1;
    
    /// @notice All listings by ID
    mapping(uint256 => Listing) public listings;
    
    /// @notice Token ID to active listing ID (0 = not listed)
    mapping(uint256 => uint256) public tokenToListing;
    
    /// @notice User's active listing IDs
    mapping(address => uint256[]) private _userListings;
    
    /// @notice Array of all active listing IDs for enumeration
    uint256[] private _activeListingIds;
    
    /// @notice Index in _activeListingIds array
    mapping(uint256 => uint256) private _listingIndex;
    
    // ============ Events ============
    
    event CardListed(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 price
    );
    
    event CardSold(
        uint256 indexed listingId,
        address indexed seller,
        address indexed buyer,
        uint256 tokenId,
        uint256 price
    );
    
    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller,
        uint256 indexed tokenId
    );
    
    event MarketplaceFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    
    // ============ Errors ============
    
    error NotTokenOwner();
    error TokenIsLocked();
    error NotListingSeller();
    error ListingNotActive();
    error InsufficientPayment();
    error ZeroPrice();
    error TokenAlreadyListed();
    error TransferFailed();
    error InvalidFee();
    
    // ============ Constructor ============
    
    constructor(address _nftContract, address initialOwner) Ownable(initialOwner) {
        nftContract = IERC721(_nftContract);
        fantasyNFT = IFantasyYC_NFT(_nftContract);
        feeRecipient = initialOwner;
    }
    
    // ============ External Functions ============
    
    /**
     * @notice List a card for sale
     * @param tokenId The NFT token ID to list
     * @param price The listing price in wei
     */
    function listCard(uint256 tokenId, uint256 price) external whenNotPaused nonReentrant returns (uint256) {
        if (price == 0) revert ZeroPrice();
        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (fantasyNFT.isLocked(tokenId)) revert TokenIsLocked();
        if (tokenToListing[tokenId] != 0) revert TokenAlreadyListed();
        
        // Transfer NFT to marketplace (escrow)
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        
        // Create listing
        uint256 listingId = _nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            listedAt: block.timestamp,
            active: true
        });
        
        // Track listing
        tokenToListing[tokenId] = listingId;
        _userListings[msg.sender].push(listingId);
        _activeListingIds.push(listingId);
        _listingIndex[listingId] = _activeListingIds.length - 1;
        
        emit CardListed(listingId, msg.sender, tokenId, price);
        
        return listingId;
    }
    
    /**
     * @notice Buy a listed card
     * @param listingId The listing ID to purchase
     */
    function buyCard(uint256 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (msg.value < listing.price) revert InsufficientPayment();
        
        uint256 tokenId = listing.tokenId;
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Mark as inactive before transfers (CEI pattern)
        listing.active = false;
        tokenToListing[tokenId] = 0;
        _removeFromActiveListings(listingId);
        
        // Calculate fees
        uint256 royaltyAmount = 0;
        address royaltyReceiver;
        
        // Get royalty info from NFT contract (ERC-2981)
        try ERC2981(address(nftContract)).royaltyInfo(tokenId, price) returns (address receiver, uint256 amount) {
            royaltyReceiver = receiver;
            royaltyAmount = amount;
        } catch {}
        
        uint256 marketplaceFeeAmount = (price * marketplaceFee) / 10000;
        uint256 sellerProceeds = price - royaltyAmount - marketplaceFeeAmount;
        
        // Transfer NFT to buyer
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        // Transfer payments
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltySuccess, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            if (!royaltySuccess) revert TransferFailed();
        }
        
        if (marketplaceFeeAmount > 0 && feeRecipient != address(0)) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: marketplaceFeeAmount}("");
            if (!feeSuccess) revert TransferFailed();
        }
        
        (bool sellerSuccess, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerSuccess) revert TransferFailed();
        
        // Refund excess payment
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            if (!refundSuccess) revert TransferFailed();
        }
        
        emit CardSold(listingId, seller, msg.sender, tokenId, price);
    }
    
    /**
     * @notice Cancel a listing and return NFT to seller
     * @param listingId The listing ID to cancel
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        if (!listing.active) revert ListingNotActive();
        if (listing.seller != msg.sender) revert NotListingSeller();
        
        uint256 tokenId = listing.tokenId;
        
        // Mark as inactive
        listing.active = false;
        tokenToListing[tokenId] = 0;
        _removeFromActiveListings(listingId);
        
        // Return NFT to seller
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        
        emit ListingCancelled(listingId, msg.sender, tokenId);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all active listings
     */
    function getActiveListings() external view returns (Listing[] memory) {
        uint256 count = _activeListingIds.length;
        Listing[] memory result = new Listing[](count);
        
        for (uint256 i = 0; i < count; i++) {
            result[i] = listings[_activeListingIds[i]];
        }
        
        return result;
    }
    
    /**
     * @notice Get number of active listings
     */
    function getActiveListingCount() external view returns (uint256) {
        return _activeListingIds.length;
    }
    
    /**
     * @notice Get listing by ID
     */
    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
    
    /**
     * @notice Check if a token is listed
     */
    function isTokenListed(uint256 tokenId) external view returns (bool) {
        return tokenToListing[tokenId] != 0;
    }
    
    /**
     * @notice Get listings by seller
     */
    function getListingsBySeller(address seller) external view returns (Listing[] memory) {
        uint256[] memory ids = _userListings[seller];
        
        // Count active listings
        uint256 activeCount = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (listings[ids[i]].active) {
                activeCount++;
            }
        }
        
        // Build result array
        Listing[] memory result = new Listing[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (listings[ids[i]].active) {
                result[idx++] = listings[ids[i]];
            }
        }
        
        return result;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update marketplace fee (max 5%)
     */
    function setMarketplaceFee(uint256 newFee) external onlyOwner {
        if (newFee > 500) revert InvalidFee(); // Max 5%
        emit MarketplaceFeeUpdated(marketplaceFee, newFee);
        marketplaceFee = newFee;
    }
    
    /**
     * @notice Update fee recipient
     */
    function setFeeRecipient(address newRecipient) external onlyOwner {
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }
    
    /**
     * @notice Pause marketplace
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause marketplace
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============ Internal Functions ============
    
    function _removeFromActiveListings(uint256 listingId) internal {
        uint256 index = _listingIndex[listingId];
        uint256 lastIndex = _activeListingIds.length - 1;
        
        if (index != lastIndex) {
            uint256 lastId = _activeListingIds[lastIndex];
            _activeListingIds[index] = lastId;
            _listingIndex[lastId] = index;
        }
        
        _activeListingIds.pop();
        delete _listingIndex[listingId];
    }
}

// Interface for FantasyYC_NFT lock check
interface IFantasyYC_NFT {
    function isLocked(uint256 tokenId) external view returns (bool);
}
