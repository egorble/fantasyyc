import React, { useState, useRef, useLayoutEffect } from 'react';
import { MOCK_PACK_CARDS } from '../constants';
import { Rarity, CardData } from '../types';
import CardDetailModal, { CardDetailData } from './CardDetailModal';
import { Wallet, ArrowUpRight, TrendingUp, Plus, ShoppingCart, Layers, Zap, X, Check } from 'lucide-react';
import gsap from 'gsap';

interface PortfolioProps {
    onBuyPack: () => void;
}

const Portfolio: React.FC<PortfolioProps> = ({ onBuyPack }) => {
  // Convert mock data to local state to allow mutation (merging)
  const [myCards, setMyCards] = useState<CardData[]>(MOCK_PACK_CARDS);
  
  // Merge Mode States
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [newlyForgedCard, setNewlyForgedCard] = useState<CardData | null>(null);

  // Detail View State
  const [viewingCard, setViewingCard] = useState<CardDetailData | null>(null);

  // Refs for animation
  const fusionContainerRef = useRef<HTMLDivElement>(null);
  const fusionCardsRef = useRef<HTMLDivElement[]>([]);
  const coreRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const totalValue = myCards.reduce((acc, card) => acc + parseFloat(card.value), 0);

  // Toggle Selection
  const toggleCardSelection = (id: string) => {
      if (!isMergeMode) return;

      if (selectedCardIds.includes(id)) {
          setSelectedCardIds(prev => prev.filter(cId => cId !== id));
      } else {
          if (selectedCardIds.length < 3) {
              setSelectedCardIds(prev => [...prev, id]);
          }
      }
  };

  // Handle Card Click
  const handleCardClick = (card: CardData) => {
      if (isMergeMode) {
          toggleCardSelection(card.id);
      } else {
          // Normalize CardData to CardDetailData for the modal
          setViewingCard({
              id: card.id,
              name: card.startupName,
              image: card.image,
              value: card.value,
              rarity: card.rarity,
              multiplier: card.multiplier,
              batch: 'W24', // Default for portfolio mock
              stage: 'Series B' // Default for portfolio mock
          });
      }
  };

  // Execute Merge & Animation
  const handleForge = () => {
      if (selectedCardIds.length !== 3) return;
      setMergeStatus('processing');
  };

  // GSAP Animation Effect
  useLayoutEffect(() => {
    if (mergeStatus === 'processing' && fusionContainerRef.current) {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                onComplete: () => {
                   finalizeMerge();
                }
            });

            // Initial Setup
            gsap.set(fusionCardsRef.current, { scale: 0, opacity: 0 });
            gsap.set(coreRef.current, { scale: 0, opacity: 0 });
            gsap.set(flashRef.current, { opacity: 0 });

            // 1. Cards Appear in Triangle formation
            tl.to(fusionCardsRef.current, {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                stagger: 0.1,
                ease: "back.out(1.7)"
            })
            // 2. Core Appears
            .to(coreRef.current, {
                scale: 1,
                opacity: 1,
                duration: 0.5,
                ease: "power2.out"
            }, "-=0.3")
            // 3. Orbit & Converge
            .to(fusionCardsRef.current, {
                rotation: 360,
                duration: 2,
                ease: "power1.in",
                scale: 0.5, // Shrink as they get closer
                opacity: 0.8
            }, "orbit")
            // Move cards to center (0,0 is center of container flex)
            .to(fusionCardsRef.current, {
                x: 0,
                y: 0,
                duration: 1.5,
                ease: "expo.in",
                delay: 0.5
            }, "orbit")
            // 4. Core Pulsing and Exploding
            .to(coreRef.current, {
                scale: 3,
                duration: 1.5,
                ease: "expo.in",
                boxShadow: "0 0 100px 50px rgba(242,101,34, 0.8)"
            }, "orbit+=0.5")
            // 5. FLASH
            .to(flashRef.current, {
                opacity: 1,
                duration: 0.1,
                ease: "power4.in"
            })
            // Hide elements behind flash
            .set([fusionCardsRef.current, coreRef.current], { opacity: 0 })
            // 6. Fade Flash
            .to(flashRef.current, {
                opacity: 0,
                duration: 0.8,
                ease: "power2.out"
            });

        }, fusionContainerRef);

        return () => ctx.revert();
    }
  }, [mergeStatus]);

  const finalizeMerge = () => {
    // Remove 3 old cards
    const remainingCards = myCards.filter(card => !selectedCardIds.includes(card.id));
    
    // Create 1 new "Better" card
    const newCard: CardData = {
        id: `forged-${Date.now()}`,
        startupName: 'Forged AI System',
        rarity: Rarity.RARE, 
        value: '145.0',
        multiplier: '3.5x',
        image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=400&h=500&fit=crop'
    };

    setMyCards([newCard, ...remainingCards]);
    setNewlyForgedCard(newCard);
    setMergeStatus('success');
    setSelectedCardIds([]);
  };

  const closeSuccessModal = () => {
      setMergeStatus('idle');
      setNewlyForgedCard(null);
      setIsMergeMode(false);
  };

  const selectedCardsData = myCards.filter(c => selectedCardIds.includes(c.id));

  return (
    <div className="animate-[fadeInUp_0.5s_ease-out] relative min-h-[80vh]">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="col-span-2 p-6 bg-gradient-to-r from-yc-orange to-red-600 rounded-2xl text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-white/80 text-sm font-bold uppercase tracking-widest mb-1">Total Portfolio Value</p>
                    <h2 className="text-4xl font-black font-mono">${totalValue.toLocaleString()}</h2>
                    <div className="flex items-center mt-2 text-sm font-bold bg-white/20 w-fit px-2 py-1 rounded backdrop-blur-sm">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        +12.5% this week
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
                    <p className="text-xs text-gray-500 dark:text-gray-400">Select <span className="text-yc-orange font-bold">3 cards</span> to burn them and forge 1 higher rarity card.</p>
                </div>
            </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pb-24">
            {myCards.map((card) => {
                const isSelected = selectedCardIds.includes(card.id);
                const isDimmed = isMergeMode && !isSelected && selectedCardIds.length >= 3;

                return (
                    <div 
                        key={card.id} 
                        onClick={() => handleCardClick(card)}
                        className={`
                            bg-white dark:bg-[#121212] border rounded-xl overflow-hidden transition-all duration-300 relative cursor-pointer
                            ${isSelected 
                                ? 'border-yc-orange ring-2 ring-yc-orange/50 shadow-[0_0_20px_rgba(242,101,34,0.2)] scale-[1.02] z-10' 
                                : 'border-yc-light-border dark:border-[#2A2A2A] hover:border-yc-orange hover:-translate-y-1 hover:shadow-xl'}
                            ${isDimmed ? 'opacity-40 grayscale' : 'opacity-100'}
                        `}
                    >
                        {/* Selection Checkbox Overlay */}
                        {isMergeMode && (
                            <div className={`absolute top-3 right-3 z-20 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-yc-orange border-yc-orange' : 'bg-black/50 border-white/50'}`}>
                                {isSelected && <Check className="w-4 h-4 text-white" />}
                            </div>
                        )}

                        <div className="h-40 relative">
                             <img src={card.image} alt={card.startupName} className="w-full h-full object-cover" />
                             <span className={`absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded border backdrop-blur-md
                                ${card.rarity === Rarity.LEGENDARY ? 'bg-orange-500/80 text-white border-orange-400' : 'bg-black/60 text-white border-white/20'}
                             `}>
                                {card.rarity}
                             </span>
                        </div>
                        <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                 <h4 className="font-bold text-yc-text-primary dark:text-white">{card.startupName}</h4>
                                 <span className="text-xs text-gray-500 font-mono">x1</span>
                            </div>
                            <div className="flex justify-between items-end">
                                 <div>
                                    <p className="text-[10px] text-gray-500 uppercase">Value</p>
                                    <p className="font-mono font-bold text-yc-text-primary dark:text-white">${card.value}</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase">Mult</p>
                                    <p className="font-mono font-bold text-yc-green">{card.multiplier}</p>
                                 </div>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {/* Add New Asset Placeholder (Only show if not merging) */}
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

        {/* --- DETAILED CARD VIEW MODAL --- */}
        <CardDetailModal 
            data={viewingCard}
            onClose={() => setViewingCard(null)}
        />

        {/* Forge Processing / Success Overlay */}
        {mergeStatus !== 'idle' && (
            <div ref={fusionContainerRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl overflow-hidden">
                
                {/* 1. Flash Overlay */}
                <div ref={flashRef} className="absolute inset-0 bg-white pointer-events-none opacity-0 z-[60]" />

                {mergeStatus === 'processing' ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* Background Energy Grid */}
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                        
                        {/* 2. Core Energy Ball */}
                        <div 
                            ref={coreRef} 
                            className="absolute w-32 h-32 rounded-full bg-yc-orange blur-md flex items-center justify-center z-10 shadow-[0_0_60px_rgba(242,101,34,0.6)]"
                        >
                            <div className="w-full h-full bg-white rounded-full opacity-50 blur-sm animate-pulse" />
                        </div>
                        
                        {/* 3. Orbiting Cards */}
                        <div className="relative w-[600px] h-[600px] flex items-center justify-center">
                            {selectedCardsData.map((card, idx) => {
                                const angle = (idx / 3) * Math.PI * 2;
                                const radius = 250; // Initial radius
                                const x = Math.cos(angle) * radius;
                                const y = Math.sin(angle) * radius;

                                return (
                                    <div 
                                        key={card.id}
                                        ref={el => { if(el) fusionCardsRef.current[idx] = el }}
                                        className="absolute w-32 h-48 bg-black border-2 border-yc-orange rounded-xl overflow-hidden shadow-[0_0_30px_rgba(242,101,34,0.3)] z-20"
                                        style={{ transform: `translate(${x}px, ${y}px)` }} // Initial static position managed by GSAP later
                                    >
                                        <img src={card.image} className="w-full h-full object-cover opacity-80" />
                                        <div className="absolute inset-0 bg-yc-orange/20 mix-blend-overlay"></div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="absolute bottom-20 text-center animate-pulse z-30">
                            <h2 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-2">Fusing Assets</h2>
                            <p className="text-yc-orange font-mono text-xs">Don't turn off the reactor...</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center animate-[scaleIn_0.4s_cubic-bezier(0.34,1.56,0.64,1)] relative z-50">
                        <div className="text-yc-green mb-4">
                            <Zap className="w-20 h-20 fill-current drop-shadow-[0_0_20px_rgba(20,184,129,0.5)]" />
                        </div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Fusion Complete</h2>
                        <p className="text-gray-400 mb-8">A new powerful asset has been forged.</p>
                        
                        {/* New Card Preview */}
                        {newlyForgedCard && (
                            <div className="w-64 bg-[#121212] border border-yc-orange/50 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(242,101,34,0.4)] mb-8 transform hover:scale-105 transition-transform duration-500">
                                <div className="h-64 relative">
                                    <img src={newlyForgedCard.image} className="w-full h-full object-cover" />
                                    <div className="absolute top-2 right-2 bg-yc-orange text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase">
                                        New
                                    </div>
                                </div>
                                <div className="p-4 text-center bg-gradient-to-b from-[#121212] to-black">
                                    <h3 className="text-white font-bold text-lg">{newlyForgedCard.startupName}</h3>
                                    <div className="text-yc-green font-mono font-bold mt-1 text-xl">{newlyForgedCard.multiplier}</div>
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

    </div>
  );
};

export default Portfolio;