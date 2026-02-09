import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { CardData, Rarity } from '../types';
import CardDetailModal, { CardDetailData } from './CardDetailModal';
import { Wallet, ArrowUpRight, TrendingUp, Plus, ShoppingCart, Layers, Zap, X, Check, RefreshCw, Tag, Loader2, Gavel, Clock, Activity, DollarSign, History } from 'lucide-react';
import { useWalletContext } from '../context/WalletContext';
import { useNFT } from '../hooks/useNFT';
import { useMarketplaceV2 } from '../hooks/useMarketplaceV2';
import { usePollingData } from '../hooks/usePollingData';
import { formatXTZ } from '../lib/contracts';
import gsap from 'gsap';

interface PortfolioProps {
    onBuyPack: () => void;
}

const Portfolio: React.FC<PortfolioProps> = ({ onBuyPack }) => {
    const [myCards, setMyCards] = useState<CardData[]>([]);
    const [isMergeMode, setIsMergeMode] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
    const [mergeStatus, setMergeStatus] = useState<'idle' | 'confirming' | 'processing' | 'success'>('idle');
    const [newlyForgedCard, setNewlyForgedCard] = useState<CardData | null>(null);
    const [viewingCard, setViewingCard] = useState<CardDetailData | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mergeError, setMergeError] = useState<string | null>(null);
    const [pendingNewTokenId, setPendingNewTokenId] = useState<number | null>(null);

    // Sell modal state
    const [sellModalOpen, setSellModalOpen] = useState(false);
    const [cardToSell, setCardToSell] = useState<CardData | null>(null);
    const [sellMode, setSellMode] = useState<'fixed' | 'auction'>('fixed');
    const [sellPrice, setSellPrice] = useState('');
    const [auctionStartPrice, setAuctionStartPrice] = useState('');
    const [auctionReservePrice, setAuctionReservePrice] = useState('');
    const [auctionDuration, setAuctionDuration] = useState('24'); // hours
    const [isSelling, setIsSelling] = useState(false);

    // NFT Stats Modal state
    const [statsModalOpen, setStatsModalOpen] = useState(false);
    const [statsCard, setStatsCard] = useState<CardData | null>(null);
    const [statsTab, setStatsTab] = useState<'bids' | 'sales' | 'stats'>('bids');
    const [cardBids, setCardBids] = useState<any[]>([]);
    const [cardSales, setCardSales] = useState<any[]>([]);
    const [cardStats, setCardStats] = useState<any | null>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Refs for animation
    const fusionContainerRef = useRef<HTMLDivElement>(null);
    const fusionCardsRef = useRef<HTMLDivElement[]>([]);
    const coreRef = useRef<HTMLDivElement>(null);
    const flashRef = useRef<HTMLDivElement>(null);
    const animationRanRef = useRef(false); // Prevent animation from running twice

    // Hooks
    const { isConnected, address, getSigner, connect } = useWalletContext();
    const { getCards, getCardInfo, mergeCards, isLoading } = useNFT();
    const { listCard, createAuction, getBidsForToken, getTokenStats, getTokenSaleHistory, loading: marketplaceLoading } = useMarketplaceV2();

    // Auto-refresh cards with polling (disabled when not connected)
    const {
        data: polledCards,
        isLoading: pollingLoading,
        refresh: refreshCards
    } = usePollingData<CardData[]>(
        async () => {
            if (!address) return [];
            return await getCards(address);
        },
        {
            cacheKey: `portfolio:cards:${address || 'none'}`,
            interval: 30000, // 30 seconds
            enabled: isConnected && !!address
        }
    );

    // Update myCards when polled data changes
    useEffect(() => {
        if (polledCards) {
            setMyCards(polledCards);
            setIsRefreshing(false);
        }
    }, [polledCards]);

    // Load cards when address changes
    useEffect(() => {
        if (isConnected && address) {
            setIsRefreshing(true);
            refreshCards();
        } else {
            setMyCards([]);
        }
    }, [isConnected, address]);

    const loadCards = async () => {
        if (!address) return;
        setIsRefreshing(true);
        await refreshCards();
    };

    const totalValue = myCards.reduce((acc, card) => acc + card.multiplier, 0);

    // Toggle Selection
    const toggleCardSelection = (tokenId: number) => {
        if (!isMergeMode) return;

        const card = myCards.find(c => c.tokenId === tokenId);
        if (!card || card.isLocked) return; // Can't select locked cards

        if (selectedCardIds.includes(tokenId)) {
            setSelectedCardIds(prev => prev.filter(id => id !== tokenId));
        } else {
            if (selectedCardIds.length < 3) {
                // Check rarity matches
                if (selectedCardIds.length > 0) {
                    const firstCard = myCards.find(c => c.tokenId === selectedCardIds[0]);
                    if (firstCard && firstCard.rarity !== card.rarity) {
                        return; // Must be same rarity
                    }
                }
                setSelectedCardIds(prev => [...prev, tokenId]);
            }
        }
    };

    // Handle Card Click
    const handleCardClick = (card: CardData) => {
        if (isMergeMode) {
            toggleCardSelection(card.tokenId);
        } else {
            setViewingCard({
                id: card.tokenId.toString(),
                name: card.name,
                image: card.image,
                value: card.multiplier.toString(),
                rarity: card.rarity,
                multiplier: `${card.multiplier}x`,
                batch: 'W24',
                stage: card.isLocked ? 'Locked' : 'Available'
            });
        }
    };

    // Execute Merge - transaction first, animation after success
    const handleForge = async () => {
        if (selectedCardIds.length !== 3) return;

        console.log('🔥 Starting merge transaction...');
        setMergeStatus('confirming'); // Waiting for wallet signature
        setMergeError(null);
        animationRanRef.current = false; // Reset animation flag

        const signer = await getSigner();
        if (!signer) {
            setMergeStatus('idle');
            setMergeError('Could not get wallet signer');
            return;
        }

        // Execute transaction and WAIT for it to complete
        const result = await mergeCards(signer, selectedCardIds as [number, number, number]);

        if (result.success && result.newTokenId) {
            console.log('✅ Merge transaction successful! Token ID:', result.newTokenId);
            // ONLY NOW start the animation
            setPendingNewTokenId(result.newTokenId);
            setMergeStatus('processing'); // This triggers the animation
        } else {
            console.log('❌ Merge failed:', result.error);
            // Decode common errors
            let errorMsg = result.error || 'Merge failed';
            if (errorMsg.includes('0x7c0aec15')) {
                errorMsg = 'Cards must be the same rarity to merge';
            } else if (errorMsg.includes('NotCardOwner')) {
                errorMsg = 'You do not own all selected cards';
            } else if (errorMsg.includes('CannotMergeLegendary')) {
                errorMsg = 'Cannot merge Legendary cards';
            } else if (errorMsg.includes('CardIsLocked')) {
                errorMsg = 'One or more cards are locked in tournament';
            }
            setMergeError(errorMsg);
            setMergeStatus('idle');
            setSelectedCardIds([]);
        }
    };

    // GSAP Animation Effect - only runs ONCE when processing (after transaction success)
    useLayoutEffect(() => {
        if (mergeStatus === 'processing' && fusionContainerRef.current && pendingNewTokenId && !animationRanRef.current) {
            animationRanRef.current = true; // Mark animation as started

            const ctx = gsap.context(() => {
                const tl = gsap.timeline();

                gsap.set(fusionCardsRef.current, { scale: 0, opacity: 0 });
                gsap.set(coreRef.current, { scale: 0, opacity: 0 });
                gsap.set(flashRef.current, { opacity: 0 });

                tl.to(fusionCardsRef.current, {
                    scale: 1,
                    opacity: 1,
                    duration: 0.5,
                    stagger: 0.1,
                    ease: "back.out(1.7)"
                })
                    .to(coreRef.current, {
                        scale: 1,
                        opacity: 1,
                        duration: 0.5,
                        ease: "power2.out"
                    }, "-=0.3")
                    .to(fusionCardsRef.current, {
                        rotation: 360,
                        duration: 2,
                        ease: "power1.in",
                        scale: 0.5,
                        opacity: 0.8
                    }, "orbit")
                    .to(fusionCardsRef.current, {
                        x: 0,
                        y: 0,
                        duration: 1.5,
                        ease: "expo.in",
                        delay: 0.5
                    }, "orbit")
                    .to(coreRef.current, {
                        scale: 3,
                        duration: 1.5,
                        ease: "expo.in",
                        boxShadow: "0 0 100px 50px rgba(242,101,34, 0.8)"
                    }, "orbit+=0.5")
                    .to(flashRef.current, {
                        opacity: 1,
                        duration: 0.1,
                        ease: "power4.in"
                    })
                    .set([fusionCardsRef.current, coreRef.current], { opacity: 0 })
                    .to(flashRef.current, {
                        opacity: 0,
                        duration: 0.8,
                        ease: "power2.out"
                    });

            }, fusionContainerRef);

            // After animation completes, finalize the merge
            const animationDuration = 3500; // ~3.5s for full animation
            const timer = setTimeout(() => {
                finalizeMerge(pendingNewTokenId);
                setPendingNewTokenId(null);
            }, animationDuration);

            return () => {
                clearTimeout(timer);
            };
        }
    }, [mergeStatus, pendingNewTokenId]);

    const finalizeMerge = async (newTokenId: number) => {
        // First, fetch the new card metadata directly
        const newCard = await getCardInfo(newTokenId);

        // Then reload all cards
        if (address) {
            const cards = await getCards(address);
            setMyCards(cards);
        }

        if (newCard) {
            setNewlyForgedCard(newCard);
        }

        setMergeStatus('success');
        setSelectedCardIds([]);
    };

    const closeSuccessModal = () => {
        setMergeStatus('idle');
        setNewlyForgedCard(null);
        setIsMergeMode(false);
    };

    const selectedCardsData = myCards.filter(c => selectedCardIds.includes(c.tokenId));

    // Get available cards for merge (same rarity as first selected, not locked)
    const getAvailableForMerge = (card: CardData): boolean => {
        if (card.isLocked) return false;
        if (selectedCardIds.length === 0) return true;
        const firstCard = myCards.find(c => c.tokenId === selectedCardIds[0]);
        return firstCard ? firstCard.rarity === card.rarity : true;
    };

    // Open sell modal for a card
    const openSellModal = (card: CardData) => {
        if (card.isLocked) {
            alert('This card is locked and cannot be sold.');
            return;
        }
        setCardToSell(card);
        setSellPrice('');
        setAuctionStartPrice('');
        setAuctionReservePrice('');
        setAuctionDuration('24');
        setSellMode('fixed');
        setSellModalOpen(true);
    };

    // Handle listing a card for sale (fixed price)
    const handleSellCard = async () => {
        if (!cardToSell || !sellPrice || parseFloat(sellPrice) <= 0) {
            alert('Please enter a valid price');
            return;
        }

        setIsSelling(true);
        try {
            const signer = await getSigner();
            if (!signer) {
                alert('Please connect your wallet');
                setIsSelling(false);
                return;
            }

            await listCard(BigInt(cardToSell.tokenId), sellPrice);

            alert(`Card listed for ${sellPrice} XTZ!`);
            setSellModalOpen(false);
            setCardToSell(null);
            setSellPrice('');
            await loadCards();
        } catch (e: any) {
            alert(`Failed to list: ${e.message}`);
        }
        setIsSelling(false);
    };

    // Handle creating an auction
    const handleCreateAuction = async () => {
        if (!cardToSell) return;
        if (!auctionStartPrice || parseFloat(auctionStartPrice) <= 0) {
            alert('Please enter a valid start price');
            return;
        }

        const reservePrice = auctionReservePrice || auctionStartPrice;
        const durationHours = parseFloat(auctionDuration);
        const durationDays = durationHours / 24; // Convert hours to days

        setIsSelling(true);
        try {
            const signer = await getSigner();
            if (!signer) {
                alert('Please connect your wallet');
                setIsSelling(false);
                return;
            }

            await createAuction(
                BigInt(cardToSell.tokenId),
                auctionStartPrice,
                reservePrice,
                durationDays
            );

            alert(`Auction created! Starting at ${auctionStartPrice} XTZ for ${auctionDuration} hours.`);
            setSellModalOpen(false);
            setCardToSell(null);
            await loadCards();
        } catch (e: any) {
            alert(`Failed to create auction: ${e.message}`);
        }
        setIsSelling(false);
    };

    // Open NFT Stats modal
    const openStatsModal = async (card: CardData) => {
        setStatsCard(card);
        setStatsModalOpen(true);
        setLoadingStats(true);
        setStatsTab('bids');
        setCardBids([]);
        setCardSales([]);
        setCardStats(null);

        try {
            const [bids, sales, stats] = await Promise.all([
                getBidsForToken(BigInt(card.tokenId)),
                getTokenSaleHistory(BigInt(card.tokenId)),
                getTokenStats(BigInt(card.tokenId))
            ]);
            setCardBids(bids || []);
            setCardSales(sales || []);
            setCardStats(stats);
        } catch (e) {
            console.error('Error loading stats:', e);
        }
        setLoadingStats(false);
    };

    return (
        <div className="animate-[fadeInUp_0.5s_ease-out] relative min-h-[80vh]">

            {/* Not Connected State */}
            {!isConnected && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Wallet className="w-16 h-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-bold text-gray-400 mb-2">Connect Your Wallet</h3>
                    <p className="text-gray-500 mb-6">Connect to view your NFT portfolio</p>
                    <button
                        onClick={connect}
                        className="bg-yc-orange hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold"
                    >
                        Connect Wallet
                    </button>
                </div>
            )}

            {isConnected && (
                <>
                    {/* Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="col-span-2 p-6 bg-gradient-to-r from-yc-orange to-red-600 rounded-2xl text-white shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-white/80 text-sm font-bold uppercase tracking-widest mb-1">Total Cards</p>
                                <h2 className="text-4xl font-black font-mono">{myCards.length}</h2>
                                <div className="flex items-center mt-2 text-sm font-bold bg-white/20 w-fit px-2 py-1 rounded backdrop-blur-sm">
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                    Total Multiplier: {totalValue}x
                                </div>
                            </div>
                            <Wallet className="absolute right-[-20px] bottom-[-40px] w-64 h-64 text-white/10 rotate-[-15deg]" />
                        </div>

                        {/* Buy Pack Card */}
                        <div
                            onClick={onBuyPack}
                            className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-2xl p-6 flex flex-col justify-between cursor-pointer group hover:border-yc-orange transition-all relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-yc-orange/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div>
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-yc-orange/10 rounded-lg text-yc-orange">
                                        <ShoppingCart className="w-6 h-6" />
                                    </div>
                                    <span className="bg-black dark:bg-white text-white dark:text-black text-xs font-bold px-2 py-1 rounded">5 XTZ</span>
                                </div>
                                <h3 className="text-xl font-bold text-yc-text-primary dark:text-white mt-4 group-hover:text-yc-orange transition-colors">Buy Starter Pack</h3>
                                <p className="text-sm text-gray-500 mt-1">Contains 5 random startup cards.</p>
                            </div>
                            <div className="flex items-center text-sm font-bold text-yc-text-primary dark:text-white mt-4">
                                Mint Now <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {/* Assets Header & Controls */}
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-yc-text-primary dark:text-white flex items-center">
                            <span className="w-2 h-6 bg-yc-green rounded-sm mr-3"></span>
                            Your Assets ({myCards.length})
                            <button
                                onClick={loadCards}
                                disabled={isRefreshing}
                                className="ml-3 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </h3>

                        <button
                            onClick={() => {
                                setIsMergeMode(!isMergeMode);
                                setSelectedCardIds([]);
                                setViewingCard(null);
                            }}
                            className={`
                        flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all border
                        ${isMergeMode
                                    ? 'bg-yc-orange text-white border-yc-orange shadow-[0_0_15px_rgba(242,101,34,0.4)]'
                                    : 'bg-white dark:bg-[#121212] text-gray-500 hover:text-yc-text-primary dark:hover:text-white border-gray-200 dark:border-[#2A2A2A]'}
                    `}
                        >
                            {isMergeMode ? <X className="w-4 h-4 mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
                            {isMergeMode ? 'Cancel Merge' : 'Merge Cards'}
                        </button>
                    </div>

                    {/* Merge Instructions */}
                    {isMergeMode && (
                        <div className="mb-6 p-4 bg-yc-orange/10 border border-yc-orange/30 rounded-xl flex items-center animate-[fadeIn_0.3s]">
                            <div className="bg-yc-orange text-white p-2 rounded-lg mr-3">
                                <Zap className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                                <h4 className="text-yc-text-primary dark:text-white font-bold text-sm">Fusion Reactor Online</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Select <span className="text-yc-orange font-bold">3 cards of same rarity</span> to burn and forge 1 higher rarity card.</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && myCards.length === 0 && (
                        <div className="text-center py-20">
                            <RefreshCw className="w-8 h-8 text-yc-orange animate-spin mx-auto mb-4" />
                            <p className="text-gray-500">Loading your cards...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && myCards.length === 0 && (
                        <div className="text-center py-20">
                            <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-gray-400 mb-2">No Cards Yet</h3>
                            <p className="text-gray-500 mb-6">Buy a pack to get started!</p>
                            <button
                                onClick={onBuyPack}
                                className="bg-yc-orange hover:bg-orange-600 text-white px-8 py-3 rounded-xl font-bold"
                            >
                                Buy First Pack
                            </button>
                        </div>
                    )}

                    {/* Grid */}
                    {myCards.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-24">
                            {myCards.map((card) => {
                                const isSelected = selectedCardIds.includes(card.tokenId);
                                const isDimmed = isMergeMode && !isSelected && (selectedCardIds.length >= 3 || !getAvailableForMerge(card));

                                return (
                                    <div
                                        key={card.tokenId}
                                        onClick={() => handleCardClick(card)}
                                        className={`
                                  bg-white dark:bg-[#121212] border rounded-xl overflow-hidden transition-all duration-300 relative cursor-pointer
                                  ${isSelected
                                                ? 'border-yc-orange ring-2 ring-yc-orange/50 shadow-[0_0_20px_rgba(242,101,34,0.2)] scale-[1.02] z-10'
                                                : 'border-yc-light-border dark:border-[#2A2A2A] hover:border-yc-orange hover:-translate-y-1 hover:shadow-xl'}
                                  ${isDimmed ? 'opacity-40 grayscale' : 'opacity-100'}
                                  ${card.isLocked ? 'ring-1 ring-red-500/50' : ''}
                              `}
                                    >
                                        {/* Selection Checkbox Overlay */}
                                        {isMergeMode && !card.isLocked && (
                                            <div className={`absolute top-3 right-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-yc-orange border-yc-orange' : 'bg-black/50 border-white/50'}`}>
                                                {isSelected && <Check className="w-4 h-4 text-white" />}
                                            </div>
                                        )}

                                        {/* Locked Badge */}
                                        {card.isLocked && (
                                            <div className="absolute top-3 right-3 z-20 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">
                                                LOCKED
                                            </div>
                                        )}

                                        <div className="h-40 relative">
                                            <img src={card.image} alt={card.name} className="w-full h-full object-contain" />
                                            <span className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded border backdrop-blur-md
                                      ${card.rarity === Rarity.LEGENDARY ? 'bg-orange-500/80 text-white border-orange-400' :
                                                    card.rarity === Rarity.EPIC_RARE ? 'bg-purple-600/80 text-white border-purple-500' :
                                                        card.rarity === Rarity.EPIC ? 'bg-violet-600/80 text-white border-violet-500' :
                                                            card.rarity === Rarity.RARE ? 'bg-green-600/80 text-white border-green-500' :
                                                                'bg-black/60 text-white border-white/20'}
                                   `}>
                                                {card.rarity}
                                            </span>
                                        </div>
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-yc-text-primary dark:text-white">{card.name}</h4>
                                                <span className="text-xs text-gray-500 font-mono">#{card.tokenId}</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] text-gray-500 uppercase">Edition</p>
                                                    <p className="font-mono font-bold text-yc-text-primary dark:text-white">#{card.edition}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-gray-500 uppercase">Mult</p>
                                                    <p className="font-mono font-bold text-yc-green">{card.multiplier}x</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add New Asset Placeholder */}
                            {!isMergeMode && (
                                <button
                                    onClick={onBuyPack}
                                    className="border-2 border-dashed border-gray-300 dark:border-[#2A2A2A] rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 hover:text-yc-orange hover:border-yc-orange transition-colors min-h-[280px]"
                                >
                                    <Plus className="w-8 h-8 mb-2" />
                                    <span className="font-bold text-sm">Add Asset</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Floating Action Bar for Merge */}
                    {isMergeMode && (
                        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-[slideUp_0.3s_cubic-bezier(0.2,0.8,0.2,1)]">
                            <div className="bg-[#1A1A1A] border border-[#333] p-2 pl-6 pr-2 rounded-2xl shadow-2xl flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Fusion Chamber</span>
                                    <span className="text-white font-mono font-bold">{selectedCardIds.length} / 3 Selected</span>
                                </div>
                                <button
                                    disabled={selectedCardIds.length !== 3}
                                    onClick={handleForge}
                                    className={`
                                px-8 py-3 rounded-xl font-bold uppercase tracking-wider flex items-center transition-all
                                ${selectedCardIds.length === 3
                                            ? 'bg-yc-orange hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(242,101,34,0.5)] animate-pulse'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                            `}
                                >
                                    <Zap className="w-4 h-4 mr-2 fill-current" />
                                    Forge
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* --- DETAILED CARD VIEW MODAL --- */}
            <CardDetailModal
                data={viewingCard}
                onClose={() => setViewingCard(null)}
            />

            {/* Forge Processing / Success Overlay */}
            {(mergeStatus !== 'idle' || mergeError) && (
                <div ref={fusionContainerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden">

                    <div ref={flashRef} className="absolute inset-0 bg-white pointer-events-none opacity-0 z-[60]" />

                    {/* Confirming state - waiting for wallet */}
                    {mergeStatus === 'confirming' && (
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-6 border-4 border-yc-orange/30 border-t-yc-orange rounded-full animate-spin" />
                            <h2 className="text-2xl font-bold text-white mb-2">Confirm in Wallet</h2>
                            <p className="text-gray-400">Please confirm the merge transaction...</p>
                        </div>
                    )}

                    {/* Error display */}
                    {mergeError && mergeStatus === 'idle' && (
                        <div className="text-center p-8 max-w-md">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                                <X className="w-8 h-8 text-red-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Merge Failed</h2>
                            <p className="text-red-400 mb-6">{mergeError}</p>
                            <button
                                onClick={() => setMergeError(null)}
                                className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Got It
                            </button>
                        </div>
                    )}

                    {mergeStatus === 'processing' && (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>

                            <div
                                ref={coreRef}
                                className="absolute w-32 h-32 rounded-full bg-yc-orange blur-md flex items-center justify-center z-10 shadow-[0_0_60px_rgba(242,101,34,0.6)]"
                            >
                                <div className="w-full h-full bg-white rounded-full opacity-50 blur-sm animate-pulse" />
                            </div>

                            <div className="relative w-[600px] h-[600px] flex items-center justify-center">
                                {selectedCardsData.map((card, idx) => {
                                    const angle = (idx / 3) * Math.PI * 2;
                                    const radius = 250;
                                    const x = Math.cos(angle) * radius;
                                    const y = Math.sin(angle) * radius;

                                    return (
                                        <div
                                            key={card.tokenId}
                                            ref={el => { if (el) fusionCardsRef.current[idx] = el }}
                                            className="absolute w-32 h-48 bg-black border-2 border-yc-orange rounded-xl overflow-hidden shadow-[0_0_30px_rgba(242,101,34,0.3)] z-20"
                                            style={{ transform: `translate(${x}px, ${y}px)` }}
                                        >
                                            <img src={card.image} className="w-full h-full object-contain opacity-80" />
                                            <div className="absolute inset-0 bg-yc-orange/20 mix-blend-overlay"></div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="absolute bottom-20 text-center animate-pulse z-30">
                                <h2 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-2">Fusing Assets</h2>
                                <p className="text-yc-orange font-mono text-xs">Processing on blockchain...</p>
                            </div>
                        </div>
                    )}

                    {mergeStatus === 'success' && (
                        <div className="flex flex-col items-center animate-[scaleIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)] relative z-50">
                            <div className="text-yc-green mb-4">
                                <Zap className="w-20 h-20 fill-current drop-shadow-[0_0_20px_rgba(20,184,129,0.5)]" />
                            </div>
                            <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Fusion Complete</h2>
                            <p className="text-gray-400 mb-8">A new powerful asset has been forged.</p>

                            {newlyForgedCard && (
                                <div className="w-64 bg-[#121212] border border-yc-orange/50 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(242,101,34,0.4)] mb-8 transform hover:scale-105 transition-transform duration-500">
                                    <div className="h-64 relative">
                                        <img src={newlyForgedCard.image} className="w-full h-full object-contain" />
                                        <div className="absolute top-2 right-2 bg-yc-orange text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase">
                                            New
                                        </div>
                                        <div className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded border backdrop-blur-md
                                        ${newlyForgedCard.rarity === Rarity.LEGENDARY ? 'bg-orange-500 text-white border-orange-400' :
                                                newlyForgedCard.rarity === Rarity.EPIC_RARE ? 'bg-purple-600 text-white border-purple-500' :
                                                    newlyForgedCard.rarity === Rarity.EPIC ? 'bg-violet-600 text-white border-violet-500' :
                                                        newlyForgedCard.rarity === Rarity.RARE ? 'bg-green-600 text-white border-green-500' :
                                                            'bg-gray-800 text-gray-300 border-white/20'}`}>
                                            {newlyForgedCard.rarity}
                                        </div>
                                    </div>
                                    <div className="p-4 text-center bg-gradient-to-b from-[#121212] to-black">
                                        <h3 className="text-white font-bold text-lg">{newlyForgedCard.name}</h3>
                                        <div className="text-yc-green font-mono font-bold mt-1 text-xl">{newlyForgedCard.multiplier}x</div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={closeSuccessModal}
                                className="bg-white text-black hover:bg-gray-200 px-10 py-3 rounded-lg font-bold uppercase tracking-wide transition-all shadow-lg"
                            >
                                Collect Asset
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Sell Modal */}
            {sellModalOpen && cardToSell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl animate-[scaleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Sell Card</h3>
                            <button
                                onClick={() => {
                                    setSellModalOpen(false);
                                    setCardToSell(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Card Preview */}
                        <div className="flex items-center gap-4 mb-4 p-3 bg-black/50 rounded-xl">
                            <img
                                src={cardToSell.image}
                                alt={cardToSell.name}
                                className="w-16 h-16 rounded-lg object-cover"
                            />
                            <div>
                                <h4 className="text-white font-bold">{cardToSell.name}</h4>
                                <p className="text-gray-400 text-sm">
                                    {cardToSell.rarity} · {cardToSell.multiplier}x
                                </p>
                            </div>
                        </div>

                        {/* Sale Type Tabs */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setSellMode('fixed')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${sellMode === 'fixed'
                                    ? 'bg-yc-orange text-white'
                                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'
                                    }`}
                            >
                                <Tag className="w-4 h-4" />
                                Fixed Price
                            </button>
                            <button
                                onClick={() => setSellMode('auction')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${sellMode === 'auction'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'
                                    }`}
                            >
                                <Gavel className="w-4 h-4" />
                                Auction
                            </button>
                        </div>

                        {/* Fixed Price Form */}
                        {sellMode === 'fixed' && (
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                                    Sale Price (XTZ)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        placeholder="0.00"
                                        value={sellPrice}
                                        onChange={(e) => setSellPrice(e.target.value)}
                                        className="w-full bg-black border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-yc-orange transition-colors"
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                        XTZ
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    2% royalty will be deducted on sale
                                </p>
                            </div>
                        )}

                        {/* Auction Form */}
                        {sellMode === 'auction' && (
                            <div className="space-y-4 mb-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                                        Starting Price (XTZ)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="0.00"
                                            value={auctionStartPrice}
                                            onChange={(e) => setAuctionStartPrice(e.target.value)}
                                            className="w-full bg-black border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-purple-500 transition-colors"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                            XTZ
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                                        Reserve Price (Optional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Same as start price"
                                            value={auctionReservePrice}
                                            onChange={(e) => setAuctionReservePrice(e.target.value)}
                                            className="w-full bg-black border border-[#2A2A2A] rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-purple-500 transition-colors"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                            XTZ
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Minimum price to complete sale
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                                        <Clock className="w-3 h-3 inline mr-1" />
                                        Duration
                                    </label>
                                    <select
                                        value={auctionDuration}
                                        onChange={(e) => setAuctionDuration(e.target.value)}
                                        className="w-full bg-black border border-[#2A2A2A] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                                    >
                                        <option value="1">1 Hour</option>
                                        <option value="6">6 Hours</option>
                                        <option value="12">12 Hours</option>
                                        <option value="24">24 Hours</option>
                                        <option value="48">48 Hours</option>
                                        <option value="72">72 Hours</option>
                                        <option value="168">1 Week</option>
                                    </select>
                                </div>
                                <p className="text-xs text-gray-500">
                                    2% royalty will be deducted on final sale
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSellModalOpen(false);
                                    setCardToSell(null);
                                }}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-400 bg-[#1A1A1A] hover:bg-[#222] transition-colors"
                            >
                                Cancel
                            </button>
                            {sellMode === 'fixed' ? (
                                <button
                                    onClick={handleSellCard}
                                    disabled={isSelling || !sellPrice || parseFloat(sellPrice) <= 0}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isSelling || !sellPrice || parseFloat(sellPrice) <= 0
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-yc-orange text-white hover:bg-orange-600'
                                        }`}
                                >
                                    {isSelling ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Listing...
                                        </>
                                    ) : (
                                        <>
                                            <Tag className="w-4 h-4" />
                                            List for Sale
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={handleCreateAuction}
                                    disabled={isSelling || !auctionStartPrice || parseFloat(auctionStartPrice) <= 0}
                                    className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isSelling || !auctionStartPrice || parseFloat(auctionStartPrice) <= 0
                                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                        : 'bg-purple-500 text-white hover:bg-purple-600'
                                        }`}
                                >
                                    {isSelling ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Gavel className="w-4 h-4" />
                                            Create Auction
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NFT Stats Modal */}
            {statsModalOpen && statsCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl animate-[scaleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)] max-h-[85vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Card Details</h3>
                            <button
                                onClick={() => {
                                    setStatsModalOpen(false);
                                    setStatsCard(null);
                                }}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Card Preview */}
                        <div className="flex items-center gap-4 mb-4 p-3 bg-black/50 rounded-xl">
                            <img
                                src={statsCard.image}
                                alt={statsCard.name}
                                className="w-16 h-16 rounded-lg object-cover"
                            />
                            <div>
                                <h4 className="text-white font-bold">{statsCard.name}</h4>
                                <p className="text-gray-400 text-sm">
                                    {statsCard.rarity} · {statsCard.multiplier}x · #{statsCard.tokenId}
                                </p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setStatsTab('bids')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${statsTab === 'bids'
                                    ? 'bg-yc-orange text-white'
                                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'
                                    }`}
                            >
                                <Gavel className="w-4 h-4" />
                                Bids ({cardBids.length})
                            </button>
                            <button
                                onClick={() => setStatsTab('sales')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${statsTab === 'sales'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'
                                    }`}
                            >
                                <History className="w-4 h-4" />
                                Sales
                            </button>
                            <button
                                onClick={() => setStatsTab('stats')}
                                className={`flex-1 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${statsTab === 'stats'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-[#1A1A1A] text-gray-400 hover:bg-[#222]'
                                    }`}
                            >
                                <Activity className="w-4 h-4" />
                                Stats
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            {loadingStats ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-yc-orange animate-spin" />
                                </div>
                            ) : (
                                <>
                                    {/* Bids Tab */}
                                    {statsTab === 'bids' && (
                                        <div className="space-y-3">
                                            {cardBids.length === 0 ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    <Gavel className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p>No active bids on this card</p>
                                                </div>
                                            ) : (
                                                cardBids.map((bid, idx) => (
                                                    <div key={idx} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <p className="text-white font-bold">{formatXTZ(bid.amount)} XTZ</p>
                                                                <p className="text-gray-500 text-xs font-mono">
                                                                    {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-gray-400 text-sm flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    Expires
                                                                </p>
                                                                <p className="text-gray-300 text-xs">
                                                                    {new Date(Number(bid.expiration) * 1000).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* Sales Tab */}
                                    {statsTab === 'sales' && (
                                        <div className="space-y-3">
                                            {cardSales.length === 0 ? (
                                                <div className="text-center py-8 text-gray-500">
                                                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p>No sales history yet</p>
                                                </div>
                                            ) : (
                                                cardSales.map((sale, idx) => (
                                                    <div key={idx} className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                        <div className="flex justify-between items-center">
                                                            <div>
                                                                <p className="text-white font-bold">{formatXTZ(sale.price)} XTZ</p>
                                                                <p className="text-gray-500 text-xs">
                                                                    {sale.saleType === 0 ? 'Listing' : sale.saleType === 1 ? 'Bid Accepted' : 'Auction'}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-gray-400 text-xs font-mono">
                                                                    From: {sale.seller.slice(0, 6)}...{sale.seller.slice(-4)}
                                                                </p>
                                                                <p className="text-gray-400 text-xs font-mono">
                                                                    To: {sale.buyer.slice(0, 6)}...{sale.buyer.slice(-4)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-500 text-xs mt-2">
                                                            {new Date(Number(sale.timestamp) * 1000).toLocaleString()}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* Stats Tab */}
                                    {statsTab === 'stats' && (
                                        <div className="space-y-3">
                                            {cardStats ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                            <p className="text-gray-500 text-xs uppercase mb-1">Total Sales</p>
                                                            <p className="text-white text-xl font-bold">{cardStats.salesCount?.toString() || '0'}</p>
                                                        </div>
                                                        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                            <p className="text-gray-500 text-xs uppercase mb-1">Total Volume</p>
                                                            <p className="text-white text-xl font-bold">
                                                                {cardStats.totalVolume ? formatXTZ(cardStats.totalVolume) : '0'} XTZ
                                                            </p>
                                                        </div>
                                                        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                            <p className="text-gray-500 text-xs uppercase mb-1">Highest Sale</p>
                                                            <p className="text-green-400 text-xl font-bold">
                                                                {cardStats.highestSale ? formatXTZ(cardStats.highestSale) : '0'} XTZ
                                                            </p>
                                                        </div>
                                                        <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                            <p className="text-gray-500 text-xs uppercase mb-1">Lowest Sale</p>
                                                            <p className="text-blue-400 text-xl font-bold">
                                                                {cardStats.lowestSale && cardStats.lowestSale > 0n ? formatXTZ(cardStats.lowestSale) : '-'} XTZ
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
                                                        <p className="text-gray-500 text-xs uppercase mb-1">Last Sale Price</p>
                                                        <p className="text-yc-orange text-2xl font-bold">
                                                            {cardStats.lastSalePrice && cardStats.lastSalePrice > 0n ? formatXTZ(cardStats.lastSalePrice) : '-'} XTZ
                                                        </p>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-center py-8 text-gray-500">
                                                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p>No stats available</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Portfolio;