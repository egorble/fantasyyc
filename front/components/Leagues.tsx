import React, { useState, useRef } from 'react';
import { Trophy, Users, Clock, Info, GripVertical, X, CheckCircle, ArrowRight, Shield, Zap } from 'lucide-react';
import { MOCK_PACK_CARDS } from '../constants';
import { CardData, Rarity } from '../types';
import gsap from 'gsap';

const Leagues: React.FC = () => {
  const [isJoining, setIsJoining] = useState(false);
  const [deck, setDeck] = useState<(CardData | null)[]>([null, null, null, null, null]);
  const [submissionState, setSubmissionState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const containerRef = useRef<HTMLDivElement>(null);

  const availableCards = MOCK_PACK_CARDS; // In real app, filter out cards already in other decks

  // Drag Handlers
  const handleDragStart = (e: React.DragEvent, card: CardData) => {
    e.dataTransfer.setData("cardId", card.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("cardId");
    const card = availableCards.find(c => c.id === cardId);
    
    if (card) {
      const newDeck = [...deck];
      // If card is already in another slot, remove it from there
      const existingIndex = newDeck.findIndex(c => c?.id === card.id);
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

  const handleSubmit = () => {
      if (deck.includes(null)) return;
      
      setSubmissionState('submitting');
      
      const ctx = gsap.context(() => {
          const tl = gsap.timeline({
              onComplete: () => {
                  setSubmissionState('success');
                  // Auto close after success
                  setTimeout(() => {
                      setIsJoining(false);
                      setSubmissionState('idle');
                      setDeck([null, null, null, null, null]);
                  }, 2500);
              }
          });

          // Sequence: Lock cards -> Pulse Green -> Show Success Overlay
          tl.to('.deck-slot-card', {
              scale: 0.95,
              duration: 0.2,
              ease: "power2.inOut"
          })
          .to('.deck-slot-card', {
              scale: 1,
              borderColor: '#10B981', // yc-green
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
  };

  const leaderboard = [
    { rank: 1, user: 'CryptoKing.eth', points: 12450, change: '+120' },
    { rank: 2, user: 'SaaS_Master', points: 11200, change: '+45' },
    { rank: 3, user: 'VC_Intern', points: 10850, change: '+210' },
    { rank: 4, user: 'PaulG_Fan', points: 9500, change: '-20' },
    { rank: 5, user: 'UnicornHunter', points: 9200, change: '+5' },
  ];

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
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Select 5 assets to compete in Season 4.</p>
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
                          <p className="text-gray-400 font-mono mt-2">Ready for deployment</p>
                      </div>
                  )}

                  <div className="league-overlay absolute inset-0 pointer-events-none transition-colors duration-500 z-0"></div>

                  {/* Slots Grid */}
                  <div className="relative z-10 grid grid-cols-5 gap-4 mb-8">
                      {deck.map((slot, idx) => (
                          <div 
                            key={idx}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, idx)}
                            className={`
                                aspect-[3/4] rounded-xl border-2 transition-all relative flex items-center justify-center group
                                ${slot 
                                    ? 'border-yc-orange bg-black deck-slot-card shadow-lg' 
                                    : 'border-dashed border-gray-600 bg-black/20 hover:border-gray-400 hover:bg-black/40'}
                            `}
                          >
                              {slot ? (
                                  <div className="w-full h-full relative overflow-hidden rounded-[10px]">
                                      <img src={slot.image} alt={slot.startupName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                      
                                      {/* Card Overlay Info */}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90"></div>
                                      
                                      <button 
                                        onClick={() => removeCard(idx)}
                                        className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm transform hover:scale-110"
                                      >
                                          <X size={14} />
                                      </button>
                                      
                                      <div className="absolute bottom-3 left-3">
                                          <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-fit mb-1 ${slot.rarity === Rarity.LEGENDARY ? 'bg-yc-orange text-white' : 'bg-gray-700 text-gray-300'}`}>
                                              {slot.rarity}
                                          </div>
                                          <p className="text-sm font-bold text-white leading-none">{slot.startupName}</p>
                                          <p className="text-[10px] text-yc-green font-mono mt-0.5">{slot.multiplier}</p>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="text-center pointer-events-none">
                                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-2 text-gray-500 font-bold border border-gray-700">
                                          {idx + 1}
                                      </div>
                                      <span className="text-[10px] uppercase font-bold text-gray-600 tracking-wider">Empty Slot</span>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>

                  {/* Submit Action */}
                  <div className="flex justify-between items-center relative z-10 border-t border-gray-800 pt-6">
                      <div className="flex items-center text-gray-400 text-xs">
                          <Info className="w-4 h-4 mr-2" />
                          <span>Drag cards from your inventory below.</span>
                      </div>
                      
                      <button 
                          disabled={deck.includes(null) || submissionState !== 'idle'}
                          onClick={handleSubmit}
                          className={`
                              px-10 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all flex items-center
                              ${deck.includes(null) 
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                                : submissionState === 'submitting'
                                    ? 'bg-yc-orange text-white cursor-wait opacity-80'
                                    : 'bg-yc-orange hover:bg-orange-600 text-white shadow-[0_0_30px_rgba(242,101,34,0.3)] hover:shadow-[0_0_50px_rgba(242,101,34,0.5)] transform hover:-translate-y-1 active:scale-95'}
                          `}
                      >
                          {submissionState === 'submitting' ? (
                              <span className="animate-pulse">Locking In...</span>
                          ) : (
                              <>
                                <Zap className="w-4 h-4 mr-2 fill-current" />
                                Submit Squad
                              </>
                          )}
                      </button>
                  </div>
              </div>

              {/* Inventory */}
              <div className="animate-[fadeInUp_0.4s_ease-out]">
                <h3 className="text-lg font-bold text-yc-text-primary dark:text-white mb-4 flex items-center">
                    <GripVertical className="mr-2 text-gray-500" />
                    Available Assets ({availableCards.length})
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {availableCards.map((card) => {
                        const isSelected = deck.some(c => c?.id === card.id);
                        return (
                            <div 
                                key={card.id}
                                draggable={!isSelected && submissionState === 'idle'}
                                onDragStart={(e) => handleDragStart(e, card)}
                                className={`
                                    bg-white dark:bg-[#121212] border rounded-xl p-3 transition-all duration-300 relative group
                                    ${isSelected 
                                        ? 'border-gray-800 opacity-30 grayscale cursor-not-allowed' 
                                        : 'border-yc-light-border dark:border-[#2A2A2A] cursor-grab active:cursor-grabbing hover:border-yc-orange hover:shadow-lg hover:-translate-y-1'}
                                `}
                            >
                                <div className="aspect-square bg-gray-100 dark:bg-black rounded-lg mb-3 overflow-hidden relative">
                                    <img src={card.image} className="w-full h-full object-cover" />
                                    {/* Hover hint */}
                                    {!isSelected && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[10px] font-bold text-white uppercase tracking-wider border border-white/30 px-2 py-1 rounded">Drag Me</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-yc-text-primary dark:text-white truncate">{card.startupName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                            card.rarity === Rarity.LEGENDARY ? 'bg-orange-900/50 text-orange-400' : 
                                            card.rarity === Rarity.RARE ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                                        }`}>
                                            {card.rarity}
                                        </span>
                                        <span className="text-[10px] font-mono text-gray-500">{card.multiplier}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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
                    <span className="px-2 py-0.5 bg-yc-orange text-white text-[10px] font-bold uppercase rounded">Season 4</span>
                    <span className="px-2 py-0.5 bg-gray-800 text-gray-300 text-[10px] font-bold uppercase rounded flex items-center">
                        <Clock size={10} className="mr-1" /> 24 Days Left
                    </span>
                </div>
                <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Global YC Fantasy League</h2>
                <p className="text-gray-400 mb-6 leading-relaxed">
                    Compete against 12,000+ investors. Build a portfolio of 5 YC startups. 
                    Points are awarded for funding rounds, product launches, and revenue milestones.
                    Top 100 players split the prize pool.
                </p>
                
                <div className="flex items-center gap-6 mb-8">
                    <div>
                        <p className="text-gray-500 text-xs uppercase font-bold">Prize Pool</p>
                        <p className="text-2xl font-black text-yc-orange font-mono">50,000 XTZ</p>
                    </div>
                    <div className="w-px h-10 bg-gray-800"></div>
                    <div>
                        <p className="text-gray-500 text-xs uppercase font-bold">Participants</p>
                        <p className="text-2xl font-black text-white font-mono flex items-center">
                            <Users className="w-5 h-5 mr-2 text-gray-600" /> 12,402
                        </p>
                    </div>
                </div>

                <button 
                    onClick={() => setIsJoining(true)}
                    className="bg-white text-black hover:bg-yc-orange hover:text-white px-8 py-3 rounded-lg font-black text-sm uppercase tracking-wide transition-all flex items-center shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(242,101,34,0.4)]"
                >
                    Enter League <ArrowRight className="w-4 h-4 ml-2" />
                </button>
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