import React, { useState, useMemo, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import HeroBanner from './components/HeroBanner';
import StartupCard from './components/StartupCard';
import LiveFeed from './components/LiveFeed';
import PackOpeningModal from './components/PackOpeningModal';
import Marketplace from './components/Marketplace';
import Portfolio from './components/Portfolio';
import Leagues from './components/Leagues';
import Analytics from './components/Analytics';
import AdminPanel from './components/AdminPanel';
import CardDetailModal, { CardDetailData } from './components/CardDetailModal';
import { NavSection, UserProfile, Startup, Rarity, CardData } from './types';
import { Filter, Search, Wallet, Menu, Loader2 } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';
import { WalletProvider, useWalletContext } from './context/WalletContext';
import { formatXTZ, CHAIN_NAME } from './lib/contracts';
import { isAdmin } from './hooks/useAdmin';
import { ethers } from 'ethers';
import { useMarketplaceV2, Listing } from './hooks/useMarketplaceV2';
import { useNFT } from './hooks/useNFT';

// Inner component that uses wallet context
const AppContent: React.FC = () => {
    const [activeSection, setActiveSection] = useState<NavSection>(NavSection.HOME);
    const [isPackModalOpen, setIsPackModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [dashboardSelectedStartup, setDashboardSelectedStartup] = useState<CardDetailData | null>(null);
    const [dashboardSelectedCard, setDashboardSelectedCard] = useState<CardData | null>(null);

    // Dashboard filters and sort
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'price' | 'rarity' | 'recent'>('recent');

    // Marketplace & NFT listings for dashboard
    const [dashboardListings, setDashboardListings] = useState<Array<{ listing: Listing; card: CardData }>>([]);
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);

    // Wallet hook
    const {
        isConnected,
        address,
        balance,
        isCorrectChain,
        connect,
        switchChain,
        formatAddress,
        isConnecting
    } = useWalletContext();

    // Marketplace hook
    const { getActiveListings } = useMarketplaceV2();

    // NFT hook
    const { getCardMetadata } = useNFT();

    // Dynamic user from wallet
    const user: UserProfile = {
        name: isConnected ? formatAddress(address!) : 'Not Connected',
        handle: isConnected ? `@${address?.slice(2, 8)}` : '@connect',
        balanceXTZ: isConnected ? Number(ethers.formatEther(balance)) : 0,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
        address: address || undefined,
    };

    // Load dashboard listings with NFT metadata
    useEffect(() => {
        const loadDashboardData = async () => {
            setIsLoadingDashboard(true);
            try {
                const listings = await getActiveListings();

                // Fetch metadata for each listing
                const listingsWithCards = await Promise.all(
                    listings.map(async (listing) => {
                        const card = await getCardMetadata(Number(listing.tokenId));
                        return card ? { listing, card } : null;
                    })
                );

                // Filter out null values (failed metadata fetches)
                const validListings = listingsWithCards.filter((item): item is { listing: Listing; card: CardData } => item !== null);
                setDashboardListings(validListings);
            } catch (err) {
                console.error('Failed to load dashboard data:', err);
            } finally {
                setIsLoadingDashboard(false);
            }
        };

        loadDashboardData();
    }, [getActiveListings, getCardMetadata]);

    // Filter and sort dashboard listings
    const filteredAndSortedListings = useMemo(() => {
        let filtered = dashboardListings;

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(({ card }) =>
                card.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply category filter
        if (activeFilter !== 'all') {
            filtered = filtered.filter(({ card }) => {
                switch (activeFilter) {
                    case 'legendary':
                        return card.rarity === Rarity.LEGENDARY;
                    case 'epic':
                        return card.rarity === Rarity.EPIC || card.rarity === Rarity.EPIC_RARE;
                    case 'rare':
                        return card.rarity === Rarity.RARE;
                    case 'common':
                        return card.rarity === Rarity.COMMON;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return Number(b.listing.price - a.listing.price);
                case 'rarity': {
                    const rarityOrder = {
                        [Rarity.LEGENDARY]: 5,
                        [Rarity.EPIC_RARE]: 4,
                        [Rarity.EPIC]: 3,
                        [Rarity.RARE]: 2,
                        [Rarity.COMMON]: 1,
                    };
                    return rarityOrder[b.card.rarity] - rarityOrder[a.card.rarity];
                }
                case 'recent':
                default:
                    return Number(b.listing.listedAt - a.listing.listedAt);
            }
        });

        return sorted;
    }, [dashboardListings, searchQuery, activeFilter, sortBy]);

    const handleSectionChange = (section: NavSection) => {
        setActiveSection(section);
        setIsMobileMenuOpen(false);
    };

    const handleWalletClick = async () => {
        if (!isConnected) {
            await connect();
        } else if (!isCorrectChain) {
            await switchChain();
        }
    };

    const renderContent = () => {
        switch (activeSection) {
            case NavSection.MARKETPLACE:
                return <Marketplace />;
            case NavSection.PORTFOLIO:
                return <Portfolio onBuyPack={() => setIsPackModalOpen(true)} />;
            case NavSection.LEAGUES:
                return <Leagues />;
            case NavSection.ANALYTICS:
                return <Analytics />;
            case NavSection.ADMIN:
                return <AdminPanel />;
            case NavSection.HOME:
            default:
                return (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                        <div className="mb-6 md:mb-10">
                            <HeroBanner />
                        </div>

                        <LiveFeed />

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 md:gap-6">
                            <div className="w-full md:w-auto">
                                <div className="flex items-center flex-wrap gap-2">
                                    {['all', 'legendary', 'epic', 'rare', 'common'].map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setActiveFilter(filter)}
                                            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 transform active:scale-95 ${activeFilter === filter
                                                ? 'bg-yc-orange text-white shadow-lg shadow-yc-orange/30 scale-105'
                                                : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                        >
                                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center space-x-3 self-end md:self-auto">
                                <span className="text-xs font-bold text-gray-400 uppercase">Sort by:</span>
                                <div className="relative group">
                                    <button className="flex items-center text-sm font-bold text-yc-text-primary dark:text-white hover:text-yc-orange transition-colors">
                                        {sortBy === 'price' ? 'Price' : sortBy === 'rarity' ? 'Rarity' : 'Recent'}
                                        <Filter className="w-3 h-3 ml-1 text-gray-400 group-hover:text-yc-orange transition-colors" />
                                    </button>
                                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-[#09090b] border border-gray-200 dark:border-[#27272a] rounded-lg shadow-lg py-2 min-w-[120px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        <button
                                            onClick={() => setSortBy('recent')}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#18181b] text-gray-900 dark:text-white"
                                        >
                                            Recent
                                        </button>
                                        <button
                                            onClick={() => setSortBy('price')}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#18181b] text-gray-900 dark:text-white"
                                        >
                                            Price
                                        </button>
                                        <button
                                            onClick={() => setSortBy('rarity')}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-[#18181b] text-gray-900 dark:text-white"
                                        >
                                            Rarity
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isLoadingDashboard ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-yc-orange" />
                                <span className="ml-3 text-lg font-bold text-gray-400">Loading marketplace...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                                {filteredAndSortedListings.length > 0 ? (
                                    filteredAndSortedListings.map(({ listing, card }) => {
                                        // Convert CardData to Startup format for StartupCard component
                                        const startupData: Startup = {
                                            id: card.tokenId.toString(),
                                            name: card.name,
                                            batch: `Edition ${card.edition}`,
                                            description: card.description || `${card.rarity} rarity NFT card with ${card.multiplier}x multiplier`,
                                            value: Number(ethers.formatEther(listing.price)),
                                            change: card.multiplier * 10, // Use multiplier for change percentage
                                            logo: card.image,
                                            coverImage: card.image,
                                            stage: card.rarity,
                                            score: card.multiplier * 10,
                                            trend: [0, 0, 0, 0, 0, Number(ethers.formatEther(listing.price))],
                                        };

                                        return (
                                            <StartupCard
                                                key={`${listing.listingId}-${card.tokenId}`}
                                                startup={startupData}
                                                onClick={() => {
                                                    setDashboardSelectedCard(card);
                                                    setDashboardSelectedStartup({
                                                        id: card.tokenId.toString(),
                                                        image: card.image,
                                                        name: card.name,
                                                        value: Number(ethers.formatEther(listing.price)),
                                                        rarity: card.rarity,
                                                        multiplier: `${card.multiplier}x`,
                                                        batch: `Edition ${card.edition}`,
                                                        stage: card.rarity
                                                    });
                                                }}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-20">
                                        <p className="text-xl font-bold text-gray-400">
                                            {searchQuery ? `No NFTs found matching "${searchQuery}"` : 'No NFTs listed on marketplace'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#050505] text-yc-text-primary dark:text-white font-sans selection:bg-yc-orange selection:text-white transition-colors duration-300">

            {/* Mobile Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm animate-[fadeIn_0.2s]"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar Navigation */}
            <Sidebar
                activeSection={activeSection}
                setActiveSection={handleSectionChange}
                user={user}
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
            />

            {/* Main Content Area */}
            <main className="w-full md:pl-72 xl:pr-80 min-h-screen transition-all duration-300">
                <div className="w-full mx-auto p-4 md:p-6">

                    {/* Top Bar */}
                    <div className="flex items-center justify-between mb-6 md:mb-8 sticky top-0 bg-white/95 dark:bg-[#050505]/95 backdrop-blur-lg z-30 py-3 md:py-4 -mt-4 border-b border-gray-100 dark:border-gray-900 md:border-transparent">

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="mr-3 md:hidden text-gray-500 hover:text-yc-orange p-1"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-gray-100 dark:bg-[#121212] border-none rounded-2xl pl-10 md:pl-12 pr-4 py-2.5 md:py-3.5 text-sm font-medium text-yc-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-yc-orange/20 transition-all placeholder-gray-400"
                            />
                        </div>

                        <div className="flex items-center space-x-3 md:space-x-6 ml-3 md:ml-6">
                            {/* Balance Display */}
                            {isConnected && (
                                <>
                                    <div className="text-right hidden lg:block">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Balance</p>
                                        <p className="text-lg font-black font-mono flex items-center">
                                            <span className="text-yc-orange text-sm mr-2">◈</span>
                                            {Number(ethers.formatEther(balance)).toFixed(2)} XTZ
                                        </p>
                                    </div>

                                    <div className="text-right hidden lg:block border-l border-gray-200 dark:border-gray-800 pl-6">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Network</p>
                                        <p className={`text-sm font-bold ${isCorrectChain ? 'text-yc-green' : 'text-yc-orange'}`}>
                                            {isCorrectChain ? 'Etherlink' : 'Wrong Chain'}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Wallet Button */}
                            <button
                                onClick={handleWalletClick}
                                disabled={isConnecting}
                                className={`
                        flex items-center p-2 md:px-6 md:py-3 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95
                        ${isConnected
                                        ? isCorrectChain
                                            ? 'bg-yc-green/20 text-yc-green border border-yc-green/30 hover:bg-yc-green/30'
                                            : 'bg-yc-orange hover:bg-orange-600 text-white shadow-orange-500/20'
                                        : 'bg-yc-orange hover:bg-orange-600 text-white shadow-orange-500/20'
                                    }
                      `}
                            >
                                <Wallet className="w-4 h-4 md:mr-2" />
                                <span className="hidden md:inline">
                                    {isConnecting ? 'Connecting...' :
                                        isConnected ? (isCorrectChain ? formatAddress(address!) : 'Switch Network') :
                                            'Connect'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Content */}
                    {renderContent()}

                </div>
            </main>

            {/* Right Widget Panel */}
            <RightPanel onOpenPack={() => setIsPackModalOpen(true)} />

            {/* Pack Opening Modal */}
            <PackOpeningModal
                isOpen={isPackModalOpen}
                onClose={() => setIsPackModalOpen(false)}
            />

            {/* Card Details Modal */}
            <CardDetailModal
                data={dashboardSelectedStartup}
                cardData={dashboardSelectedCard}
                onClose={() => {
                    setDashboardSelectedStartup(null);
                    setDashboardSelectedCard(null);
                }}
            />

        </div>
    );
};

// Main App with providers
const App: React.FC = () => {
    return (
        <ThemeProvider>
            <WalletProvider>
                <AppContent />
            </WalletProvider>
        </ThemeProvider>
    );
};

export default App;