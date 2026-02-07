import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { CardData, Rarity } from '../types';
import { Layers } from 'lucide-react';
import { MOCK_PACK_CARDS } from '../constants';
import gsap from 'gsap';

interface PackOpeningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const generateTearPath = (seed: number) => {
  const isHorizontal = Math.random() > 0.5;
  const start = isHorizontal 
    ? { x: 0, y: 10 + Math.random() * 80 } 
    : { x: 10 + Math.random() * 80, y: 0 };
  const end = isHorizontal 
    ? { x: 100, y: 10 + Math.random() * 80 } 
    : { x: 10 + Math.random() * 80, y: 100 };
  
  let d = `M ${start.x} ${start.y}`;
  const steps = 8;
  
  for(let i=1; i<steps; i++) {
    const t = i/steps;
    const lx = start.x + (end.x - start.x) * t;
    const ly = start.y + (end.y - start.y) * t;
    const noise = (Math.random() - 0.5) * 15;
    d += ` L ${lx + noise} ${ly + noise}`;
  }
  d += ` L ${end.x} ${end.y}`;
  return d;
};

const PackOpeningModal: React.FC<PackOpeningModalProps> = ({ isOpen, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Persistent GSAP context
  const ctx = useRef<gsap.Context | null>(null);
  
  const [stage, setStage] = useState<'idle' | 'tearing' | 'exploding' | 'dealing' | 'finished'>('idle');
  const [cuts, setCuts] = useState<string[]>([]);
  const [cardsDealtCount, setCardsDealtCount] = useState(0);
  const maxTaps = 5;

  // Preload images when modal opens
  useEffect(() => {
    if (isOpen) {
        MOCK_PACK_CARDS.forEach((card) => {
            const img = new Image();
            img.src = card.image;
        });
    }
  }, [isOpen]);

  // Initialize Modal and GSAP Context
  useLayoutEffect(() => {
    if (isOpen) {
      ctx.current = gsap.context(() => {
        // Initial Pack Animation
        if (packRef.current) {
            gsap.set(packRef.current, { clearProps: "all" });
            gsap.to(packRef.current, {
                y: -15,
                rotation: 2,
                duration: 2,
                yoyo: true,
                repeat: -1,
                ease: "sine.inOut"
            });
        }
      }, containerRef);
    }

    return () => {
      ctx.current?.revert();
      setStage('idle');
      setCuts([]);
      setCardsDealtCount(0);
      cardRefs.current = [];
    };
  }, [isOpen]);

  // Handle "Dealing" Logic
  useLayoutEffect(() => {
    if (stage === 'dealing' && ctx.current) {
        ctx.current.add(() => {
            // Delay increased slightly to ensure preloaded images render in DOM
            setTimeout(() => {
                prepareStack();
            }, 100);
        });
    }
  }, [stage]);

  const handleTapPack = () => {
    if (stage !== 'idle' && stage !== 'tearing') return;
    
    const newCount = cuts.length + 1;
    const newCut = generateTearPath(newCount);
    setCuts(prev => [...prev, newCut]);
    setStage('tearing');

    if (packRef.current && ctx.current) {
        ctx.current.add(() => {
            gsap.killTweensOf(packRef.current);
            const tl = gsap.timeline();
            tl.to(packRef.current, {
                x: () => (Math.random() - 0.5) * 20,
                y: () => (Math.random() - 0.5) * 20,
                rotation: () => (Math.random() - 0.5) * 10,
                duration: 0.05,
                repeat: 3,
                yoyo: true,
                ease: "rough"
            })
            .to(packRef.current, {
                x: 0, y: 0, rotation: 0, duration: 0.2
            });
        });
    }

    if (newCount >= maxTaps) {
        explode();
    }
  };

  const explode = () => {
      setStage('exploding');
      
      if (packRef.current && flashRef.current && ctx.current) {
          ctx.current.add(() => {
              const tl = gsap.timeline({
                  onComplete: () => {
                      setStage('dealing');
                  }
              });

              // Fast, high-impact flash explosion
              tl.to(packRef.current, {
                  scale: 1.1,
                  duration: 0.1,
                  ease: "back.in(2)"
              })
              .to(flashRef.current, {
                  opacity: 1,
                  duration: 0.05,
                  ease: "power4.in"
              })
              .set(packRef.current, { opacity: 0 }) // Instant hide behind flash
              .to(flashRef.current, {
                  opacity: 0,
                  duration: 0.3,
                  ease: "power2.out"
              });
          });
      }
  };

  const prepareStack = () => {
    const cards = cardRefs.current;
    if (!cards || cards.length === 0) return;
    
    const stackX = window.innerWidth / 2;
    const stackY = window.innerHeight - 150; 

    cards.forEach((card, i) => {
        if(!card) return;
        
        const rect = card.getBoundingClientRect();
        const cardCenterX = rect.width ? rect.left + rect.width / 2 : stackX;
        const cardCenterY = rect.height ? rect.top + rect.height / 2 : stackY;

        const deltaX = stackX - cardCenterX;
        const deltaY = stackY - cardCenterY;

        gsap.set(card, {
            x: deltaX,
            y: deltaY,
            z: 0,
            zIndex: 50 - i,
            rotation: (Math.random() - 0.5) * 10,
            scale: 0.8,
            autoAlpha: 1
        });
        
        const inner = card.querySelector('.card-inner');
        if(inner) gsap.set(inner, { rotationY: 180 });
    });
  };

  const dealNextCard = () => {
      if (cardsDealtCount >= MOCK_PACK_CARDS.length) return;

      const cardIndex = cardsDealtCount;
      const card = cardRefs.current[cardIndex];

      if (card && ctx.current) {
        ctx.current.add(() => {
            gsap.to(card, {
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                zIndex: 100,
                duration: 0.5, // Faster deal
                ease: "back.out(1.2)", // Snappier landing
                onComplete: () => {
                    gsap.set(card, { zIndex: 1 });
                }
            });

            const inner = card.querySelector('.card-inner');
            if(inner) {
                gsap.to(inner, {
                    rotationY: 0,
                    duration: 0.4, // Faster flip
                    delay: 0.1,
                    ease: "power2.out"
                });
            }
        });
      }

      const nextCount = cardsDealtCount + 1;
      setCardsDealtCount(nextCount);
      
      if (nextCount === MOCK_PACK_CARDS.length) {
          setTimeout(() => setStage('finished'), 800);
      }
  };

  if (!isOpen) return null;

  return (
    <div 
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md perspective-1000 overflow-hidden"
    >
        {/* Flash Overlay */}
        <div ref={flashRef} className="absolute inset-0 bg-white pointer-events-none opacity-0 z-[60]" />

        {/* --- STAGE 1: PACK INTERACTION --- */}
        {(stage === 'idle' || stage === 'tearing' || stage === 'exploding') && (
            <div className="flex flex-col items-center justify-center w-full h-full relative cursor-pointer" onClick={handleTapPack}>
                <h2 className="absolute top-1/4 text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-glow pointer-events-none select-none">
                    {cuts.length === 0 ? "TAP TO BREACH" : 
                     cuts.length < maxTaps - 1 ? "TEAR IT OPEN" : "CRITICAL OVERLOAD"}
                </h2>
                
                <div className="absolute top-[32%] w-48 h-1 bg-gray-800 rounded-full overflow-hidden pointer-events-none">
                    <div className="h-full bg-yc-orange transition-all duration-100" style={{ width: `${(cuts.length / maxTaps) * 100}%` }} />
                </div>

                <div ref={packRef} className="relative w-72 h-[420px] shadow-2xl z-10">
                    <div className="absolute inset-0 bg-[#151515] rounded-xl overflow-hidden border border-white/20">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="w-24 h-24 border-2 border-yc-orange rounded-full flex items-center justify-center mb-4 bg-black/50 backdrop-blur-sm">
                                <span className="text-white font-black text-3xl">YC</span>
                            </div>
                            <div className="px-3 py-1 bg-yc-orange text-white text-[10px] font-black uppercase tracking-[0.2em]">Season 4</div>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
                    </div>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none filter drop-shadow-[0_0_5px_rgba(255,200,0,0.8)]" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {cuts.map((d, i) => (
                            <path key={i} d={d} stroke="#F26522" strokeWidth={0.5 + (i * 0.3)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        ))}
                    </svg>
                </div>
            </div>
        )}

        {/* --- STAGE 2: CARD DEALING --- */}
        {(stage === 'dealing' || stage === 'finished') && (
            <div className="w-full h-full flex flex-col items-center relative z-40 pt-20">
                
                {/* Header Title */}
                <div className={`transition-all duration-500 absolute top-12 ${stage === 'finished' ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}`}>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter text-center">Acquisition Complete</h2>
                </div>

                {/* Grid Container */}
                <div ref={cardsContainerRef} className="flex flex-wrap justify-center gap-4 md:gap-8 perspective-1000 w-full max-w-6xl px-4 mt-10">
                    {MOCK_PACK_CARDS.map((card, index) => (
                        <div 
                            key={card.id} 
                            ref={(el) => { cardRefs.current[index] = el }}
                            className="relative w-48 h-72 md:w-56 md:h-80 group cursor-pointer opacity-0"
                        >
                            <div className="card-inner w-full h-full relative preserve-3d">
                                {/* FRONT FACE */}
                                <div className="absolute inset-0 backface-hidden rounded-xl bg-[#121212] border border-white/10 overflow-hidden shadow-2xl">
                                    <div className="h-1/2 relative">
                                        <img src={card.image} className="w-full h-full object-cover" loading="eager" />
                                        <div className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded border backdrop-blur-md
                                            ${card.rarity === Rarity.LEGENDARY ? 'bg-orange-500 text-white border-orange-400' : 
                                              card.rarity === Rarity.RARE ? 'bg-green-600 text-white border-green-500' : 
                                              'bg-gray-800 text-gray-300 border-white/20'}`}>
                                            {card.rarity}
                                        </div>
                                    </div>
                                    <div className="p-4 h-1/2 flex flex-col justify-between bg-gradient-to-b from-[#121212] to-black">
                                        <div>
                                            <h3 className="text-white font-bold text-lg">{card.startupName}</h3>
                                            <p className="text-gray-500 text-xs">Series A • W24</p>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold">Valuation</p>
                                                <p className="text-white font-mono font-bold">${card.value}B</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold">Mult</p>
                                                <p className={`font-mono font-bold ${card.rarity === Rarity.LEGENDARY ? 'text-yc-orange' : 'text-yc-green'}`}>
                                                    {card.multiplier}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BACK FACE */}
                                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl bg-[#0a0a0a] border border-gray-800 overflow-hidden shadow-2xl flex items-center justify-center">
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                                    <div className="w-full h-full border-4 border-[#1a1a1a] m-1 rounded-lg flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-12 h-12 bg-yc-orange rounded flex items-center justify-center mx-auto mb-2 shadow-[0_0_15px_#F26522]">
                                                <span className="text-white font-black text-xl">Y</span>
                                            </div>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">FANTASY</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* BIG CLICK AREA FOR DEALING */}
                {stage === 'dealing' && (
                    <div 
                        className="fixed bottom-0 left-0 w-full h-[40vh] z-50 flex items-end justify-center pb-12 cursor-pointer touch-manipulation group"
                        onClick={dealNextCard}
                    >
                        <div className="flex flex-col items-center animate-pulse group-active:scale-95 transition-transform">
                             <p className="text-white/50 text-sm font-bold uppercase tracking-widest mb-2">Tap to Reveal</p>
                             <Layers className="text-yc-orange opacity-80 w-8 h-8" />
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                {stage === 'finished' && (
                    <div className="fixed bottom-12 flex space-x-4 animate-[fadeInUp_0.5s_ease-out] z-50">
                        <button 
                            onClick={onClose}
                            className="px-8 py-3 bg-yc-orange hover:bg-orange-600 text-white rounded-lg font-bold uppercase tracking-wider transition-all shadow-lg shadow-orange-500/30"
                        >
                            Collect All
                        </button>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default PackOpeningModal;