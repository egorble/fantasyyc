import React, { useState, useEffect } from 'react';
import { Search, ArrowUpDown, ShoppingCart, Loader2 } from 'lucide-react';
import { useMarketplace, MarketListing } from '../hooks/useMarketplace';
import { useNFT } from '../hooks/useNFT';
import { useWalletContext } from '../context/WalletContext';
import { ethers } from 'ethers';
import { getProvider, formatXTZ } from '../lib/contracts';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
    'Common': 'bg-gray-800 text-gray-300 border-white/20',
    'Rare': 'bg-green-600 text-white border-green-500',
    'Epic': 'bg-violet-600 text-white border-violet-500',
    'EpicRare': 'bg-purple-600 text-white border-purple-500',
    'Legendary': 'bg-orange-500 text-white border-orange-400',
};

const Marketplace: React.FC = () => {
    const { getActiveListings, buyCard, isLoading, error } = useMarketplace();
    const { getCardInfo } = useNFT();
    const { address, isConnected } = useWalletContext();

    const [listings, setListings] = useState<(MarketListing & { cardName?: string; cardImage?: string; rarity?: string; multiplier?: number })[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'recent'>('recent');
    const [rarityFilter, setRarityFilter] = useState<string>('All');
    const [buyingId, setBuyingId] = useState<number | null>(null);
    const [loadingListings, setLoadingListings] = useState(true);

    const tabs = ['All', 'Common', 'Rare', 'Epic', 'Legendary'];

    // Load listings on mount
    useEffect(() => {
        loadListings();
    }, []);

    const loadListings = async () => {
        setLoadingListings(true);
        try {
            const rawListings = await getActiveListings();

            // Fetch card metadata for each listing
            const listingsWithMetadata = await Promise.all(
                rawListings.map(async (listing) => {
                    try {
                        const cardInfo = await getCardInfo(listing.tokenId);
                        return {
                            ...listing,
                            cardName: cardInfo?.name || `Card #${listing.tokenId}`,
                            cardImage: cardInfo?.image || '/placeholder-card.png',
                            rarity: cardInfo?.rarity || 'Common',
                            multiplier: cardInfo?.multiplier || 1,
                        };
                    } catch {
                        return {
                            ...listing,
                            cardName: `Card #${listing.tokenId}`,
                            cardImage: '/placeholder-card.png',
                            rarity: 'Common',
                            multiplier: 1,
                        };
                    }
                })
            );

            setListings(listingsWithMetadata);
        } catch (e) {
            console.error('Failed to load listings:', e);
        }
        setLoadingListings(false);
    };

    // Handle buy
    const handleBuy = async (listing: MarketListing) => {
        if (!isConnected) {
            alert('Please connect your wallet first');
            return;
        }
        if (listing.seller.toLowerCase() === address?.toLowerCase()) {
            alert("You can't buy your own listing");
            return;
        }

        setBuyingId(listing.listingId);
        try {
            const provider = getProvider();
            const signer = await (provider as ethers.BrowserProvider).getSigner();
            const result = await buyCard(signer, listing.listingId, listing.price);

            if (result.success) {
                // Reload listings after purchase
                await loadListings();
                alert('Purchase successful! The card is now in your portfolio.');
            } else {
                alert(`Failed: ${result.error}`);
            }
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        }
        setBuyingId(null);
    };

    // Filter and sort listings
    const filteredListings = listings
        .filter(l => {
            if (rarityFilter !== 'All' && l.rarity !== rarityFilter) return false;
            if (searchQuery && !l.cardName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'price_asc') return Number(a.price - b.price);
            if (sortBy === 'price_desc') return Number(b.price - a.price);
            return b.listedAt - a.listedAt; // recent first
        });

    return (
        <div className="animate-[fadeIn_0.3s_ease-out]">

            {/* Header & Controls */}
            <div className="flex flex-col space-y-6 mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-yc-text-primary dark:text-white uppercase tracking-tight">Marketplace</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Buy and sell NFT cards from the community.
                        {listings.length > 0 && <span className="text-yc-orange ml-2">{listings.length} active listings</span>}
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">

                    {/* Rarity tabs */}
                    <div className="flex items-center space-x-2 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-hide -mx-4 px-4 xl:mx-0 xl:px-0">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setRarityFilter(tab)}
                                className={`
                                    whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 transform active:scale-95
                                    ${rarityFilter === tab
                                        ? 'bg-black dark:bg-white text-yc-orange shadow-lg shadow-yc-orange/10 scale-105'
                                        : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Search & Sort */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">

                        {/* Search */}
                        <div className="relative w-full sm:w-auto sm:flex-1 xl:flex-none xl:w-64 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-yc-orange transition-colors" />
                            <input
                                type="text"
                                placeholder="Search cards..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-full pl-10 pr-4 py-2.5 text-sm font-medium text-yc-text-primary dark:text-white focus:outline-none focus:border-yc-orange focus:ring-1 focus:ring-yc-orange transition-all placeholder-gray-400 shadow-sm"
                            />
                        </div>

                        {/* Sort */}
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm font-bold text-yc-text-primary dark:text-white hover:border-yc-orange transition-all shadow-sm cursor-pointer"
                        >
                            <option value="recent">Recently Listed</option>
                            <option value="price_asc">Price: Low to High</option>
                            <option value="price_desc">Price: High to Low</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Loading state */}
            {loadingListings && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-yc-orange animate-spin mb-4" />
                    <p className="text-gray-400">Loading listings...</p>
                </div>
            )}

            {/* Empty state */}
            {!loadingListings && filteredListings.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-[#121212] rounded-xl border border-[#2A2A2A]">
                    <ShoppingCart className="w-16 h-16 text-gray-600 mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No listings found</h3>
                    <p className="text-gray-400 text-center max-w-md">
                        {listings.length === 0
                            ? "There are no cards listed for sale yet. Be the first to list!"
                            : "No cards match your current filters. Try adjusting your search."}
                    </p>
                </div>
            )}

            {/* Listings Grid */}
            {!loadingListings && filteredListings.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                    {filteredListings.map((listing) => (
                        <div
                            key={listing.listingId}
                            className="bg-[#121212] border border-[#2A2A2A] rounded-xl overflow-hidden hover:border-yc-orange/50 transition-all duration-300 group"
                        >
                            {/* Card Image */}
                            <div className="relative h-56 overflow-hidden">
                                <img
                                    src={listing.cardImage}
                                    alt={listing.cardName}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                {/* Rarity badge */}
                                <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded border backdrop-blur-md ${RARITY_COLORS[listing.rarity || 'Common']}`}>
                                    {listing.rarity}
                                </div>
                                {/* Multiplier */}
                                <div className="absolute top-2 right-2 bg-black/80 text-yc-green px-2 py-0.5 text-xs font-bold rounded">
                                    {listing.multiplier}x
                                </div>
                            </div>

                            {/* Card Info */}
                            <div className="p-4">
                                <h3 className="text-white font-bold text-lg mb-1 truncate">{listing.cardName}</h3>
                                <p className="text-gray-500 text-xs mb-3">
                                    Token #{listing.tokenId} · Seller: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                                </p>

                                {/* Price & Buy */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-400 text-xs">Price</p>
                                        <p className="text-white font-bold text-lg">{listing.priceFormatted} XTZ</p>
                                    </div>
                                    <button
                                        onClick={() => handleBuy(listing)}
                                        disabled={buyingId === listing.listingId || !isConnected}
                                        className={`
                                            px-4 py-2 rounded-lg font-bold text-sm transition-all
                                            ${buyingId === listing.listingId
                                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                : listing.seller.toLowerCase() === address?.toLowerCase()
                                                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                                    : 'bg-yc-orange text-white hover:bg-yc-orange/80 active:scale-95'}
                                        `}
                                    >
                                        {buyingId === listing.listingId ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : listing.seller.toLowerCase() === address?.toLowerCase() ? (
                                            'Your Card'
                                        ) : (
                                            'Buy Now'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Marketplace;