import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Clock, Info, GripVertical, X, CheckCircle, ArrowRight, Shield, Zap, Wallet, RefreshCw, Gift, ChevronDown, Loader2, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CardData, sortByRarity } from '../types';
import { useWalletContext } from '../context/WalletContext';
import { useNFT } from '../hooks/useNFT';
import { useTournament, Tournament } from '../hooks/useTournament';
import { useLeaderboard, usePlayerRank } from '../hooks/useLeaderboard';
import { formatXTZ } from '../lib/contracts';
import { generatePixelAvatar } from '../lib/pixelAvatar';
import { blockchainCache, CacheKeys } from '../lib/cache';
import gsap from 'gsap';
import { useOnboarding } from '../hooks/useOnboarding';
import OnboardingGuide, { OnboardingStep } from './OnboardingGuide';

const LEAGUES_GUIDE: OnboardingStep[] = [
    {
        title: 'Build Your Squad',
        description: 'Choose your 5 strongest cards. They\'ll earn points daily based on startup activity: funding rounds, partnerships, Twitter engagement, and more.',
        icon: '\uD83C\uDFC6',
    },
    {
        title: 'Daily Scoring',
        description: 'Every night, our system scans Twitter for startup activity. The more active a startup is, the more points your card earns. Higher rarity cards have bigger multipliers.',
        icon: '\uD83D\uDCCA',
    },
    {
        title: 'Prize Pool',
        description: 'The prize pool grows with every pack sold this season. At the end of the tournament, players earn tokens proportional to their total points.',
        icon: '\uD83D\uDCB8',
    },
];

interface AiRecommendation {
    recommended: number[];
    reasoning: string;
    insights: Array<{ name: string; outlook: 'bullish' | 'neutral' | 'bearish'; reason: string }>;
    source: string;
    model?: string;
}

interface SquadCard {
    tokenId: number;
    name: string;
    rarity: string;
    multiplier: number;
}

interface CardScoreData {
    totalPoints: number;
    todayPoints: number;
    daysScored: number;
}

const RARITY_BADGE: Record<string, string> = {
    'Common': 'bg-gray-700 text-gray-300',
    'Rare': 'bg-green-600 text-white',
    'Epic': 'bg-violet-600 text-white',
    'Legendary': 'bg-orange-500 text-white',
};

const STARTUP_ID_BY_NAME: Record<string, number> = {
    'Openclaw': 1, 'Lovable': 2, 'Cursor': 3, 'OpenAI': 4, 'Anthropic': 5,
    'Browser Use': 6, 'Dedalus Labs': 7, 'Autumn': 8,
    'Axiom': 9, 'Multifactor': 10, 'Dome': 11, 'GrazeMate': 12, 'Tornyol Systems': 13,
    'Pocket': 14, 'Caretta': 15, 'AxionOrbital Space': 16, 'Freeport Markets': 17, 'Ruvo': 18, 'Lightberry': 19,
};

const Leagues: React.FC = () => {
    const [isJoining, setIsJoining] = useState(false);
    const [deck, setDeck] = useState<(CardData | null)[]>([null, null, null, null, null]);
    const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [availableCards, setAvailableCards] = useState<CardData[]>([]);
    const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
    const [activeTournamentId, setActiveTournamentId] = useState<number>(0);
    const [hasUserEntered, setHasUserEntered] = useState(false);
    const [phase, setPhase] = useState<'registration' | 'active' | 'ended' | 'upcoming' | 'finalized'>('upcoming');
    const [userPrize, setUserPrize] = useState<bigint>(0n);
    const [isClaiming, setIsClaiming] = useState(false);
    const [hasClaimed, setHasClaimed] = useState(false);
    const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
    const [squadCards, setSquadCards] = useState<SquadCard[]>([]);
    const [squadScores, setSquadScores] = useState<Record<string, CardScoreData>>({});
    const [squadLoading, setSquadLoading] = useState(false);
    const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Hooks
    const { isConnected, address, getSigner, connect } = useWalletContext();
    const { getCards, clearCache, isLoading: nftLoading } = useNFT();
    const { isVisible: showGuide, currentStep: guideStep, nextStep: guideNext, dismiss: guideDismiss } = useOnboarding('leagues');
    const {
        getActiveTournamentId: fetchActiveTournamentId,
        getTournament,
        enterTournament,
        hasEntered,
        canRegister,
        getUserScoreInfo,
        claimPrize,
        getUserLineup,
        isLoading: tournamentLoading
    } = useTournament();

    // Load tournament and user cards
    useEffect(() => {
        loadTournamentData();
    }, [isConnected, address]);

    const loadTournamentData = async () => {
        // Get active tournament ID from PackOpener
        const activeId = await fetchActiveTournamentId();
        setActiveTournamentId(activeId);

        if (activeId > 0) {
            const tournament = await getTournament(activeId);
            if (tournament) {
                setActiveTournament(tournament);

                // Determine phase (check contract status for finalized)
                const now = Date.now() / 1000;
                if (tournament.status === 'Finalized') {
                    setPhase('finalized');
                } else if (now < tournament.registrationStart) {
                    setPhase('upcoming');
                } else if (now >= tournament.registrationStart && now < tournament.startTime) {
                    setPhase('registration');
                } else if (now >= tournament.startTime && now < tournament.endTime) {
                    setPhase('active');
                } else {
                    setPhase('ended');
                }

                if (address) {
                    const entered = await hasEntered(activeId, address);
                    setHasUserEntered(entered);

                    // If finalized, check prize info
                    if (tournament.status === 'Finalized' && entered) {
                        const scoreInfo = await getUserScoreInfo(activeId, address);
                        if (scoreInfo) {
                            setUserPrize(scoreInfo.prize);
                        }
                        // Check if already claimed
                        const lineup = await getUserLineup(activeId, address);
                        if (lineup) {
                            setHasClaimed(lineup.claimed);
                        }
                    }
                }
            }
        }
    };

    // Fetch AI recommendation when player opens League page and hasn't entered
    useEffect(() => {
        if (!isConnected || !address || hasUserEntered || aiRecommendation || aiLoading) return;
        if (phase !== 'registration' && phase !== 'active') return;

        setAiLoading(true);
        fetch(`/api/ai/card-recommendation/${address}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setAiRecommendation(data.data);
                }
            })
            .catch(() => { /* silently fail */ })
            .finally(() => setAiLoading(false));
    }, [isConnected, address, hasUserEntered, phase]);

    // Leaderboard data from backend
    const { leaderboard: leaderboardData, loading: leaderboardLoading, error: leaderboardError } = useLeaderboard(activeTournamentId > 0 ? activeTournamentId : null, 100);
    const { rank: playerRank, loading: rankLoading } = usePlayerRank(activeTournamentId > 0 ? activeTournamentId : null, address || null);

    const loadUserCards = async () => {
        if (!address) return;
        const cards = await getCards(address);
        // Filter out locked cards
        setAvailableCards(sortByRarity(cards.filter(c => !c.isLocked)));
    };

    useEffect(() => {
        if (isJoining && address) {
            loadUserCards();
        }
    }, [isJoining, address]);

    // Drag Handlers
    const handleDragStart = (e: React.DragEvent, card: CardData) => {
        e.dataTransfer.setData("cardId", card.tokenId.toString());
        e.dataTransfer.effectAllowed = "copy";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    };

    const handleDrop = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        const cardId = e.dataTransfer.getData("cardId");
        const card = availableCards.find(c => c.tokenId.toString() === cardId);

        if (card) {
            const newDeck = [...deck];
            const existingIndex = newDeck.findIndex(c => c?.tokenId === card.tokenId);
            if (existingIndex !== -1) {
                newDeck[existingIndex] = null;
            }
            newDeck[index] = card;
            setDeck(newDeck);
        }
    };

    const removeCard = (index: number) => {
        if (submissionState !== 'idle') return;
        const newDeck = [...deck];
        newDeck[index] = null;
        setDeck(newDeck);
    };

    const handleSubmit = async () => {
        if (deck.includes(null) || activeTournamentId === 0) return;

        setSubmissionState('submitting');

        const signer = await getSigner();
        if (!signer) {
            setSubmissionState('idle');
            return;
        }

        const cardIds = deck.map(c => c!.tokenId) as [number, number, number, number, number];
        const result = await enterTournament(signer, activeTournamentId, cardIds);

        if (result.success) {
            // Refetch cards from blockchain so isLocked updates
            if (address) {
                clearCache();
                getCards(address, true);
            }

            // Run success animation
            const ctx = gsap.context(() => {
                const tl = gsap.timeline({
                    onComplete: () => {
                        setSubmissionState('success');
                        setTimeout(() => {
                            setIsJoining(false);
                            setSubmissionState('idle');
                            setDeck([null, null, null, null, null]);
                            setHasUserEntered(true);
                        }, 2500);
                    }
                });

                tl.to('.deck-slot-card', {
                    scale: 0.95,
                    duration: 0.2,
                    ease: "power2.inOut"
                })
                    .to('.deck-slot-card', {
                        scale: 1,
                        borderColor: '#10B981',
                        boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
                        duration: 0.4,
                        stagger: 0.05,
                        ease: "back.out(1.7)"
                    })
                    .to('.league-overlay', {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        duration: 0.5
                    }, "-=0.5");

            }, containerRef);
        } else {
            setSubmissionState('idle');
        }
    };

    const handleClaimPrize = async () => {
        if (!activeTournamentId || isClaiming) return;
        setIsClaiming(true);
        const signer = await getSigner();
        if (!signer) {
            setIsClaiming(false);
            return;
        }
        const result = await claimPrize(signer, activeTournamentId);
        if (result.success) {
            setHasClaimed(true);
            setUserPrize(0n);
            // Invalidate lineup cache so re-mount reads claimed=true
            if (address) {
                blockchainCache.invalidate(CacheKeys.userLineup(activeTournamentId, address));
                clearCache();
                getCards(address, true);
            }
        }
        setIsClaiming(false);
    };

    // Format address for display
    const formatAddress = (addr: string) => {
        if (addr.length <= 12) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    // Format remaining seconds into human readable string
    const formatRemaining = (seconds: number): string => {
        if (seconds <= 0) return '0m';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    // Fetch a player's squad cards
    const togglePlayerSquad = async (playerAddress: string) => {
        if (expandedPlayer === playerAddress) {
            setExpandedPlayer(null);
            setSquadCards([]);
            setSquadScores({});
            return;
        }
        setExpandedPlayer(playerAddress);
        setSquadCards([]);
        setSquadScores({});
        setSquadLoading(true);
        try {
            const [cardsRes, scoresRes] = await Promise.all([
                fetch(`/api/player/${playerAddress}/cards/${activeTournamentId}`),
                fetch(`/api/player/${playerAddress}/card-scores/${activeTournamentId}`)
            ]);
            const cardsData = await cardsRes.json();
            if (cardsData.success) {
                setSquadCards(cardsData.data);
            }
            const scoresData = await scoresRes.json();
            if (scoresData.success) {
                setSquadScores(scoresData.data);
            }
        } catch { /* silently fail */ }
        setSquadLoading(false);
    };

    // Calculate time remaining based on phase
    const getTimeInfo = () => {
        if (!activeTournament) return { label: 'No Tournament', value: '-' };

        const now = Date.now() / 1000;

        if (phase === 'upcoming') {
            return { label: 'Registration Opens In', value: formatRemaining(activeTournament.registrationStart - now) };
        }
        if (phase === 'registration') {
            return { label: 'Tournament Starts In', value: formatRemaining(activeTournament.startTime - now) };
        }
        if (phase === 'active') {
            return { label: 'Ends In', value: formatRemaining(activeTournament.endTime - now) };
        }
        if (phase === 'finalized') return { label: 'Status', value: 'Finalized' };
        return { label: 'Status', value: 'Ended' };
    };

    const timeInfo = getTimeInfo();

    const getPhaseLabel = () => {
        switch (phase) {
            case 'registration': return 'Registration Open';
            case 'active': return 'In Progress';
            case 'ended': return 'Ended';
            case 'finalized': return 'Finalized';
            case 'upcoming': return 'Coming Soon';
        }
    };

    const getPhaseColor = () => {
        switch (phase) {
            case 'registration': return 'bg-blue-500';
            case 'active': return 'bg-green-500';
            case 'ended': return 'bg-gray-500';
            case 'finalized': return 'bg-yellow-500';
            case 'upcoming': return 'bg-purple-500';
        }
    };

    if (isJoining) {
        return (
            <div ref={containerRef} className="relative overflow-x-hidden">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-3xl font-black text-yc-text-primary dark:text-white uppercase tracking-tight flex items-center">
                            <Shield className="mr-3 w-8 h-8 text-yc-orange" />
                            Assemble Your Squad
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Select 5 NFT cards to compete. Cards will be locked during tournament.</p>
                    </div>
                    <button
                        onClick={() => setIsJoining(false)}
                        disabled={submissionState !== 'idle'}
                        className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#1A1A1A] flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Deck Builder Area */}
                <div className="relative bg-yc-light-panel dark:bg-[#0A0A0A] border border-yc-light-border dark:border-[#2A2A2A] rounded-2xl p-8 mb-8 overflow-hidden shadow-2xl">

                    {/* Submission Success Overlay */}
                    {submissionState === 'success' && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-[fadeIn_0.3s]">
                            <CheckCircle className="w-24 h-24 text-yc-green mb-4 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]" />
                            <h3 className="text-3xl font-black text-white uppercase tracking-widest">Squad Locked</h3>
                            <p className="text-gray-400 font-mono mt-2">Your NFTs are now frozen for this tournament</p>
                        </div>
                    )}

                    <div className="league-overlay absolute inset-0 pointer-events-none transition-colors duration-500 z-0"></div>

                    {/* Two-column Layout: Slots Left, Cards Right */}
                    <div className="relative z-10 flex gap-6">

                        {/* Left Side - Deck Slots (Vertical) */}
                        <div className="flex flex-col gap-3 w-48 shrink-0">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Your Squad</h4>
                            {deck.map((slot, idx) => (
                                <div
                                    key={idx}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, idx)}
                                    className={`
                                        h-16 rounded-lg border-2 transition-all relative flex items-center gap-3 px-3 group
                                        ${slot
                                            ? 'border-yc-orange bg-black/80 deck-slot-card'
                                            : 'border-dashed border-gray-600 bg-black/20 hover:border-gray-400'}
                                    `}
                                >
                                    {slot ? (
                                        <>
                                            <img src={slot.image} alt={slot.name} className="w-10 h-10 rounded object-contain" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{slot.name}</p>
                                            </div>
                                            <button
                                                onClick={() => removeCard(idx)}
                                                className="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-600 text-red-400 hover:text-white flex items-center justify-center transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold border border-gray-700">
                                                {idx + 1}
                                            </div>
                                            <span className="text-[10px] uppercase font-bold tracking-wider">Empty</span>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* AI Pick Button */}
                            {aiRecommendation && aiRecommendation.recommended?.length === 5 && submissionState === 'idle' && (
                                <button
                                    onClick={() => {
                                        const newDeck: (CardData | null)[] = [null, null, null, null, null];
                                        aiRecommendation.recommended.forEach((tokenId, i) => {
                                            const card = availableCards.find(c => c.tokenId === tokenId);
                                            if (card) newDeck[i] = card;
                                        });
                                        setDeck(newDeck);
                                    }}
                                    className="w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg active:scale-95"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                    AI Pick
                                </button>
                            )}
                            {aiLoading && (
                                <div className="w-full py-2 flex items-center justify-center text-violet-400 text-[10px] uppercase tracking-wider">
                                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                    AI analyzing...
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                disabled={deck.includes(null) || submissionState !== 'idle'}
                                onClick={handleSubmit}
                                className={`
                                    mt-2 w-full py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center
                                    ${deck.includes(null)
                                        ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                        : submissionState === 'submitting'
                                            ? 'bg-yc-orange text-white cursor-wait opacity-80'
                                            : 'bg-yc-orange hover:bg-orange-600 text-white shadow-lg active:scale-95'}
                                `}
                            >
                                {submissionState === 'submitting' ? (
                                    <span className="animate-pulse">Locking...</span>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4 mr-2 fill-current" />
                                        Submit Squad
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Right Side - Available Cards */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center">
                                    Available Cards ({availableCards.length})
                                    {nftLoading && <RefreshCw className="w-3 h-3 ml-2 animate-spin" />}
                                </h4>
                                <p className="text-[10px] text-gray-500">Click to add</p>
                            </div>

                            {availableCards.length === 0 && !nftLoading ? (
                                <div className="text-center py-8 bg-black/30 rounded-xl border border-dashed border-gray-700">
                                    <p className="text-gray-500">No available cards. Buy packs to get started!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {availableCards.map((card) => {
                                        const isSelected = deck.some(c => c?.tokenId === card.tokenId);
                                        const canAdd = !isSelected && submissionState === 'idle' && deck.includes(null);
                                        const isAiPick = aiRecommendation?.recommended?.includes(card.tokenId);

                                        return (
                                            <div
                                                key={card.tokenId}
                                                onClick={() => {
                                                    if (!canAdd) return;
                                                    // Find first empty slot
                                                    const emptyIdx = deck.findIndex(d => d === null);
                                                    if (emptyIdx !== -1) {
                                                        const newDeck = [...deck];
                                                        newDeck[emptyIdx] = card;
                                                        setDeck(newDeck);
                                                    }
                                                }}
                                                draggable={!isSelected && submissionState === 'idle'}
                                                onDragStart={(e) => handleDragStart(e, card)}
                                                className={`
                                                    bg-[#0D0D0D] border rounded-lg p-2 transition-all duration-200 relative group
                                                    ${isSelected
                                                        ? 'border-yc-orange/50 opacity-40 grayscale cursor-not-allowed'
                                                        : isAiPick && canAdd
                                                            ? 'border-violet-500/60 cursor-pointer hover:border-violet-400 hover:bg-violet-950/20 hover:-translate-y-1 shadow-[0_0_8px_rgba(139,92,246,0.15)]'
                                                            : canAdd
                                                                ? 'border-[#2A2A2A] cursor-pointer hover:border-yc-orange hover:bg-[#1A1A1A] hover:-translate-y-1'
                                                                : 'border-[#2A2A2A] opacity-60 cursor-not-allowed'}
                                                `}
                                            >
                                                {isAiPick && !isSelected && (
                                                    <div className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-md">
                                                        <Sparkles className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}
                                                <div className="aspect-square bg-black rounded overflow-hidden relative">
                                                    <img src={card.image} className="w-full h-full object-contain" alt={card.name} />
                                                    {!isSelected && canAdd && (
                                                        <div className="absolute inset-0 bg-yc-orange/0 group-hover:bg-yc-orange/20 flex items-center justify-center transition-colors">
                                                            <span className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                                                        </div>
                                                    )}
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                            <CheckCircle className="w-6 h-6 text-yc-orange" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* UnicornX AI Recommendation Panel */}
                {aiRecommendation && aiRecommendation.source !== 'insufficient_cards' && (
                    <div className="bg-gradient-to-r from-violet-950/40 to-blue-950/40 border border-violet-500/20 rounded-xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-violet-300 uppercase tracking-wider">UnicornX AI</h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono">
                                {aiRecommendation.source === 'ai' ? aiRecommendation.model?.split('/')[0] : 'heuristic'}
                            </span>
                        </div>
                        <p className="text-sm text-gray-300 leading-relaxed mb-3">{aiRecommendation.reasoning}</p>
                        {aiRecommendation.insights && aiRecommendation.insights.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {aiRecommendation.insights.map((insight, i) => (
                                    <div key={i} className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2.5 py-1.5">
                                        {insight.outlook === 'bullish' ? (
                                            <TrendingUp className="w-3 h-3 text-green-400" />
                                        ) : insight.outlook === 'bearish' ? (
                                            <TrendingDown className="w-3 h-3 text-red-400" />
                                        ) : (
                                            <Minus className="w-3 h-3 text-gray-400" />
                                        )}
                                        <span className="text-[11px] font-bold text-gray-200">{insight.name}</span>
                                        <span className={`text-[10px] ${
                                            insight.outlook === 'bullish' ? 'text-green-400' :
                                            insight.outlook === 'bearish' ? 'text-red-400' : 'text-gray-500'
                                        }`}>
                                            {insight.reason}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="overflow-x-hidden">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-black dark:to-[#121212] border border-gray-300 dark:border-[#2A2A2A] rounded-2xl p-4 md:p-8 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-gray-900 dark:text-white">
                    <Trophy size={200} />
                </div>

                <div className="relative z-10 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <span className="px-2 py-0.5 bg-yc-orange text-white text-[10px] font-bold uppercase rounded">
                            Tournament #{activeTournamentId}
                        </span>
                        <span className={`px-2 py-0.5 text-white text-[10px] font-bold uppercase rounded ${getPhaseColor()}`}>
                            {getPhaseLabel()}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-300 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-bold uppercase rounded flex items-center">
                            <Clock size={10} className="mr-1" /> {timeInfo.value} {phase !== 'ended' ? 'left' : ''}
                        </span>
                        {hasUserEntered && (
                            <span className="px-2 py-0.5 bg-yc-green/20 text-yc-green text-[10px] font-bold uppercase rounded flex items-center">
                                <CheckCircle size={10} className="mr-1" /> Entered
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white mb-3 sm:mb-4 uppercase tracking-tighter">Global UnicornX League</h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 leading-relaxed">
                        Compete against other investors. Build a portfolio of 5 NFT startup cards.
                        Cards are locked during the tournament. Top players win from the prize pool!
                    </p>

                    <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
                        <div>
                            <p className="text-gray-500 dark:text-gray-500 text-[10px] sm:text-xs uppercase font-bold">Prize Pool</p>
                            <p className="text-xl sm:text-2xl font-black text-yc-orange font-mono">
                                {activeTournament ? formatXTZ(activeTournament.prizePool) : '0'} XTZ
                            </p>
                        </div>
                        <div className="w-px h-10 bg-gray-300 dark:bg-gray-800"></div>
                        <div>
                            <p className="text-gray-500 dark:text-gray-500 text-[10px] sm:text-xs uppercase font-bold">Participants</p>
                            <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white font-mono flex items-center">
                                <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-gray-400 dark:text-gray-600" />
                                {activeTournament?.entryCount || 0}
                            </p>
                        </div>
                    </div>

                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="bg-yc-orange hover:bg-orange-600 text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex items-center shadow-lg"
                        >
                            <Wallet className="w-4 h-4 mr-2" /> Connect to Enter
                        </button>
                    ) : phase === 'finalized' && hasUserEntered ? (
                        hasClaimed ? (
                            <span className="text-yc-green font-bold flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2" /> Prize claimed!
                            </span>
                        ) : userPrize > 0n ? (
                            <button
                                onClick={handleClaimPrize}
                                disabled={isClaiming}
                                className="bg-yellow-500 hover:bg-yellow-600 text-black px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex items-center shadow-lg"
                            >
                                {isClaiming ? (
                                    <span className="animate-pulse">Claiming...</span>
                                ) : (
                                    <>
                                        <Gift className="w-4 h-4 mr-2" /> Claim {formatXTZ(userPrize)} XTZ
                                    </>
                                )}
                            </button>
                        ) : (
                            <span className="text-gray-500 font-bold">Tournament finalized - no prize earned</span>
                        )
                    ) : hasUserEntered ? (
                        <div className="flex items-center gap-4">
                            <span className="text-yc-green font-bold flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2" /> You're registered for this tournament
                            </span>
                        </div>
                    ) : (phase === 'registration' || phase === 'active') ? (
                        <button
                            onClick={() => setIsJoining(true)}
                            className="bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-yc-orange hover:text-white px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-black text-xs sm:text-sm uppercase tracking-wide transition-all flex items-center shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(242,101,34,0.4)]"
                        >
                            Enter League <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                    ) : phase === 'upcoming' ? (
                        <span className="text-purple-500 dark:text-purple-400 font-bold">Registration opens soon</span>
                    ) : phase === 'ended' ? (
                        <span className="text-gray-500 font-bold">Tournament ended - awaiting finalization</span>
                    ) : (
                        <span className="text-gray-500 dark:text-gray-500 font-bold">Tournament ended</span>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-1">
                <h3 className="font-bold text-lg sm:text-xl text-yc-text-primary dark:text-white flex items-center">
                    Live Leaderboard
                    {leaderboardLoading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
                </h3>
                {playerRank && (
                    <div className="text-xs sm:text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Your Rank: </span>
                        <span className="font-bold text-yc-orange">#{playerRank.rank}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">Score: </span>
                        <span className="font-mono font-bold text-yc-text-primary dark:text-white">{playerRank.score.toFixed(1)}</span>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                {leaderboardError ? (
                    <div className="p-8 text-center">
                        <p className="text-red-500">Error loading leaderboard: {leaderboardError}</p>
                    </div>
                ) : leaderboardData.length === 0 && !leaderboardLoading ? (
                    <div className="p-8 text-center">
                        <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400">No players yet. Be the first to enter!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                        {leaderboardData.map((player) => {
                            const isCurrentUser = address && player.address.toLowerCase() === address.toLowerCase();
                            const isExpanded = expandedPlayer === player.address;
                            return (
                                <div key={player.address}>
                                    <div
                                        onClick={() => togglePlayerSquad(player.address)}
                                        className={`flex items-center px-3 sm:px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer ${isCurrentUser ? 'bg-yc-orange/5' : ''} ${isExpanded ? 'bg-gray-50 dark:bg-[#1A1A1A]' : ''}`}
                                    >
                                        {/* Rank */}
                                        <div className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-bold text-xs sm:text-sm shrink-0 ${
                                            player.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                                            player.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                                            player.rank === 3 ? 'bg-orange-700/20 text-orange-700' : 'text-gray-500 dark:text-gray-400'
                                        }`}>
                                            {player.rank}
                                        </div>

                                        {/* Avatar + Name */}
                                        <div className="flex items-center ml-2 sm:ml-3 flex-1 min-w-0">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-200 dark:bg-[#333] border border-gray-300 dark:border-gray-700 overflow-hidden shrink-0">
                                                <img
                                                    src={player.avatar || generatePixelAvatar(player.address, 64)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    style={{ imageRendering: player.avatar ? 'auto' : 'pixelated' }}
                                                />
                                            </div>
                                            <div className="ml-2 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isCurrentUser ? 'text-yc-orange' : 'text-yc-text-primary dark:text-white'}`}>
                                                    {player.username || formatAddress(player.address)}
                                                    {isCurrentUser && <span className="text-[10px] text-yc-orange ml-1">(You)</span>}
                                                </p>
                                                <p className="text-[10px] font-mono text-gray-400 truncate hidden sm:block">
                                                    {formatAddress(player.address)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Score + Chevron */}
                                        <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                                            <div>
                                                <p className="text-sm font-bold font-mono text-yc-text-primary dark:text-white">
                                                    {player.score.toFixed(1)}
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-mono hidden sm:block">
                                                    {(() => {
                                                        const d = new Date(player.lastUpdated);
                                                        d.setDate(d.getDate() - 1);
                                                        return d.toLocaleDateString();
                                                    })()}
                                                </p>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded Squad */}
                                    {isExpanded && (
                                        <div className="px-3 sm:px-5 py-3 bg-gray-50 dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1E1E1E]">
                                            {squadLoading ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <Loader2 className="w-5 h-5 animate-spin text-yc-orange" />
                                                    <span className="ml-2 text-sm text-gray-400">Loading squad...</span>
                                                </div>
                                            ) : squadCards.length === 0 ? (
                                                <p className="text-sm text-gray-400 text-center py-3">No squad data available</p>
                                            ) : (
                                                <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                                                    {squadCards.map((card) => {
                                                        const startupId = STARTUP_ID_BY_NAME[card.name] || 1;
                                                        const scoreData = squadScores[card.name];
                                                        return (
                                                            <div key={card.tokenId} className="flex flex-col items-center">
                                                                <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212]">
                                                                    <img
                                                                        src={`/images/${startupId}.png`}
                                                                        alt={card.name}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                </div>
                                                                <p className="text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 mt-1 text-center truncate w-full">{card.name}</p>
                                                                <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${RARITY_BADGE[card.rarity] || RARITY_BADGE.Common}`}>
                                                                    {card.rarity} {card.multiplier}x
                                                                </span>
                                                                {scoreData && (
                                                                    <span className="text-[9px] sm:text-[10px] font-bold font-mono text-emerald-500 mt-0.5">
                                                                        +{Math.round(scoreData.totalPoints)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Onboarding Guide */}
            {showGuide && (
                <OnboardingGuide
                    steps={LEAGUES_GUIDE}
                    currentStep={guideStep}
                    onNext={() => guideNext(LEAGUES_GUIDE.length)}
                    onDismiss={guideDismiss}
                />
            )}
        </div>
    );
};

export default Leagues;