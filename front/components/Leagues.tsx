import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Clock, Info, GripVertical, X, CheckCircle, ArrowRight, Shield, Zap, Wallet, RefreshCw } from 'lucide-react';
import { CardData, Rarity } from '../types';
import { useWalletContext } from '../context/WalletContext';
import { useNFT } from '../hooks/useNFT';
import { useTournament, Tournament } from '../hooks/useTournament';
import { formatXTZ } from '../lib/contracts';
import gsap from 'gsap';

const Leagues: React.FC = () => {
    const [isJoining, setIsJoining] = useState(false);
    const [deck, setDeck] = useState<(CardData | null)[]>([null, null, null, null, null]);
    const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [availableCards, setAvailableCards] = useState<CardData[]>([]);
    const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
    const [activeTournamentId, setActiveTournamentId] = useState<number>(0);
    const [hasUserEntered, setHasUserEntered] = useState(false);
    const [phase, setPhase] = useState<'registration' | 'active' | 'ended' | 'upcoming'>('upcoming');
    const containerRef = useRef<HTMLDivElement>(null);

    // Hooks
    const { isConnected, address, getSigner, connect } = useWalletContext();
    const { getCards, isLoading: nftLoading } = useNFT();
    const {
        getActiveTournamentId: fetchActiveTournamentId,
        getTournament,
        enterTournament,
        hasEntered,
        canRegister,
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

                // Determine phase
                const now = Date.now() / 1000;
                if (now < tournament.registrationStart) {
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
                }
            }
        }
    };

    const loadUserCards = async () => {
        if (!address) return;
        const cards = await getCards(address);
        // Filter out locked cards
        setAvailableCards(cards.filter(c => !c.isLocked));
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

    const leaderboard = [
        { rank: 1, user: 'CryptoKing.eth', points: 12450, change: '+120' },
        { rank: 2, user: 'SaaS_Master', points: 11200, change: '+45' },
        { rank: 3, user: 'VC_Intern', points: 10850, change: '+210' },
        { rank: 4, user: 'PaulG_Fan', points: 9500, change: '-20' },
        { rank: 5, user: 'UnicornHunter', points: 9200, change: '+5' },
    ];

    // Calculate time remaining based on phase
    const getTimeInfo = () => {
        if (!activeTournament) return { label: 'No Tournament', value: '-' };

        const now = Date.now() / 1000;

        if (phase === 'upcoming') {
            const hours = Math.max(0, Math.ceil((activeTournament.registrationStart - now) / 3600));
            return { label: 'Registration Opens In', value: hours < 24 ? `${hours}h` : `${Math.ceil(hours / 24)}d` };
        }
        if (phase === 'registration') {
            const hours = Math.max(0, Math.ceil((activeTournament.startTime - now) / 3600));
            return { label: 'Tournament Starts In', value: hours < 24 ? `${hours}h` : `${Math.ceil(hours / 24)}d` };
        }
        if (phase === 'active') {
            const hours = Math.max(0, Math.ceil((activeTournament.endTime - now) / 3600));
            return { label: 'Ends In', value: hours < 24 ? `${hours}h` : `${Math.ceil(hours / 24)}d` };
        }
        return { label: 'Status', value: 'Ended' };
    };

    const timeInfo = getTimeInfo();

    const getPhaseLabel = () => {
        switch (phase) {
            case 'registration': return 'Registration Open';
            case 'active': return 'In Progress';
            case 'ended': return 'Ended';
            case 'upcoming': return 'Coming Soon';
        }
    };

    const getPhaseColor = () => {
        switch (phase) {
            case 'registration': return 'bg-blue-500';
            case 'active': return 'bg-green-500';
            case 'ended': return 'bg-gray-500';
            case 'upcoming': return 'bg-purple-500';
        }
    };

    if (isJoining) {
        return (
            <div ref={containerRef} className="animate-[fadeIn_0.3s_ease-out] relative">

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
                                            <img src={slot.image} alt={slot.name} className="w-10 h-10 rounded object-cover" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{slot.name}</p>
                                                <p className="text-[10px] text-yc-green font-mono">{slot.multiplier}x</p>
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

                            {/* Submit Button */}
                            <button
                                disabled={deck.includes(null) || submissionState !== 'idle'}
                                onClick={handleSubmit}
                                className={`
                                    mt-4 w-full py-3 rounded-lg font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center
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
                                                        : canAdd
                                                            ? 'border-[#2A2A2A] cursor-pointer hover:border-yc-orange hover:bg-[#1A1A1A] hover:-translate-y-1'
                                                            : 'border-[#2A2A2A] opacity-60 cursor-not-allowed'}
                                                `}
                                            >
                                                <div className="aspect-square bg-black rounded overflow-hidden mb-2 relative">
                                                    <img src={card.image} className="w-full h-full object-cover" alt={card.name} />
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
                                                <p className="text-xs font-bold text-white truncate">{card.name}</p>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase ${card.rarity === Rarity.LEGENDARY ? 'bg-orange-900/50 text-orange-400' :
                                                            card.rarity === Rarity.EPIC_RARE ? 'bg-purple-900/50 text-purple-400' :
                                                                card.rarity === Rarity.EPIC ? 'bg-violet-900/50 text-violet-400' :
                                                                    card.rarity === Rarity.RARE ? 'bg-green-900/50 text-green-400' :
                                                                        'bg-gray-800 text-gray-400'
                                                        }`}>
                                                        {card.rarity}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-gray-500">{card.multiplier}x</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-[fadeInUp_0.5s_ease-out]">
            <div className="bg-gradient-to-br from-black to-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-2xl p-8 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Trophy size={200} />
                </div>

                <div className="relative z-10 max-w-2xl">
                    <div className="flex items-center space-x-2 mb-4">
                        <span className="px-2 py-0.5 bg-yc-orange text-white text-[10px] font-bold uppercase rounded">
                            Tournament #{activeTournamentId}
                        </span>
                        <span className={`px-2 py-0.5 text-white text-[10px] font-bold uppercase rounded ${getPhaseColor()}`}>
                            {getPhaseLabel()}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-[10px] font-bold uppercase rounded flex items-center">
                            <Clock size={10} className="mr-1" /> {timeInfo.value} {phase !== 'ended' ? 'left' : ''}
                        </span>
                        {hasUserEntered && (
                            <span className="px-2 py-0.5 bg-yc-green/20 text-yc-green text-[10px] font-bold uppercase rounded flex items-center">
                                <CheckCircle size={10} className="mr-1" /> Entered
                            </span>
                        )}
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Global YC Fantasy League</h2>
                    <p className="text-gray-400 mb-6 leading-relaxed">
                        Compete against other investors. Build a portfolio of 5 NFT startup cards.
                        Cards are locked during the tournament. Top players win from the prize pool!
                    </p>

                    <div className="flex items-center gap-6 mb-8">
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-bold">Prize Pool</p>
                            <p className="text-2xl font-black text-yc-orange font-mono">
                                {activeTournament ? formatXTZ(activeTournament.prizePool) : '0'} XTZ
                            </p>
                        </div>
                        <div className="w-px h-10 bg-gray-800"></div>
                        <div>
                            <p className="text-gray-500 text-xs uppercase font-bold">Participants</p>
                            <p className="text-2xl font-black text-white font-mono flex items-center">
                                <Users className="w-5 h-5 mr-2 text-gray-600" />
                                {activeTournament?.entryCount || 0}
                            </p>
                        </div>
                    </div>

                    {!isConnected ? (
                        <button
                            onClick={connect}
                            className="bg-yc-orange hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all flex items-center shadow-lg"
                        >
                            <Wallet className="w-4 h-4 mr-2" /> Connect to Enter
                        </button>
                    ) : hasUserEntered ? (
                        <div className="flex items-center gap-4">
                            <span className="text-yc-green font-bold flex items-center">
                                <CheckCircle className="w-5 h-5 mr-2" /> You're registered for this tournament
                            </span>
                        </div>
                    ) : phase === 'registration' ? (
                        <button
                            onClick={() => setIsJoining(true)}
                            className="bg-white text-black hover:bg-yc-orange hover:text-white px-8 py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all flex items-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(242,101,34,0.4)]"
                        >
                            Enter League <ArrowRight className="w-4 h-4 ml-2" />
                        </button>
                    ) : phase === 'upcoming' ? (
                        <span className="text-purple-400 font-bold">Registration opens soon</span>
                    ) : phase === 'active' ? (
                        <span className="text-gray-400 font-bold">Registration closed - Tournament in progress</span>
                    ) : (
                        <span className="text-gray-500 font-bold">Tournament ended</span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-xl text-yc-text-primary dark:text-white">Live Leaderboard</h3>
            </div>

            <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="p-0">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-[#0F0F0F] text-xs uppercase text-gray-500 font-bold border-b border-yc-light-border dark:border-[#2A2A2A]">
                            <tr>
                                <th className="px-6 py-4">Rank</th>
                                <th className="px-6 py-4">Player</th>
                                <th className="px-6 py-4 text-right">Points</th>
                                <th className="px-6 py-4 text-right">24h</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-[#2A2A2A]">
                            {leaderboard.map((player) => (
                                <tr key={player.rank} className="hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className={`
                                        w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                                        ${player.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                                                player.rank === 2 ? 'bg-gray-400/20 text-gray-400' :
                                                    player.rank === 3 ? 'bg-orange-700/20 text-orange-700' : 'text-gray-500'}
                                    `}>
                                            {player.rank}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-[#333] mr-3 border border-gray-300 dark:border-gray-700"></div>
                                            <span className="font-bold text-yc-text-primary dark:text-white group-hover:text-yc-orange transition-colors">{player.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-yc-text-primary dark:text-white">
                                        {player.points.toLocaleString()}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-mono text-xs font-bold ${player.change.includes('+') ? 'text-yc-green' : 'text-yc-red'}`}>
                                        {player.change}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Leagues;