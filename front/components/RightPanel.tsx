import React from 'react';
import { Clock, Gift, UserPlus, ChevronRight } from 'lucide-react';

interface RightPanelProps {
  onOpenPack: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onOpenPack }) => {
  return (
    <aside className="w-80 h-screen fixed right-0 top-0 bg-yc-light-panel dark:bg-yc-dark-panel border-l border-yc-light-border dark:border-yc-dark-border p-6 hidden xl:flex flex-col space-y-6 z-40 overflow-y-auto transition-colors duration-300">
      
      {/* Daily Reward / Free Pack */}
      <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-5 relative overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 p-2 opacity-10 text-yc-text-primary dark:text-white">
            <Gift size={64} />
        </div>
        <h3 className="text-yc-text-primary dark:text-white font-bold text-lg mb-1">Daily Reward</h3>
        <p className="text-gray-500 dark:text-[#888888] text-xs mb-4">Claim your free common pack.</p>
        
        <div className="flex items-center justify-between bg-gray-50 dark:bg-[#050505] rounded-lg p-3 border border-yc-light-border dark:border-[#2A2A2A] mb-4">
            <span className="text-xs text-gray-500 dark:text-[#888888] font-mono uppercase">Next drop</span>
            <div className="flex items-center text-yc-orange font-mono font-bold text-sm">
                <Clock className="w-3 h-3 mr-1.5" />
                04:23:12
            </div>
        </div>
        
        <button 
          onClick={onOpenPack}
          className="w-full bg-black dark:bg-[#1A1A1A] hover:bg-yc-orange text-white border border-transparent dark:border-yc-orange py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center"
        >
          Open Pack
        </button>
      </div>

      {/* Top Gainers */}
      <div className="bg-white dark:bg-[#121212] border border-yc-light-border dark:border-[#2A2A2A] rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-yc-text-primary dark:text-white font-bold text-sm uppercase tracking-wide">Top Gainers</h3>
             <button className="text-gray-500 hover:text-yc-text-primary dark:hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
             </button>
        </div>
        
        <div className="space-y-3">
            {[
                { name: 'Rippling', val: '+12.4%', price: '$42.50' },
                { name: 'Deel', val: '+8.2%', price: '$31.20' },
                { name: 'Brex', val: '+5.1%', price: '$55.00' }
            ].map((stock, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 p-1 rounded transition-colors">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-[#888888] border border-gray-200 dark:border-[#2A2A2A] mr-3">
                            {stock.name[0]}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-yc-text-primary dark:text-white group-hover:text-yc-orange transition-colors">{stock.name}</p>
                            <p className="text-[10px] text-gray-500 dark:text-[#888888]">Saas / B2B</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-yc-green font-mono">{stock.val}</p>
                        <p className="text-[10px] text-gray-500 dark:text-[#888888] font-mono">{stock.price}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Referral */}
      <div className="bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-900 dark:to-black border border-gray-300 dark:border-gray-800 rounded-xl p-5 relative shadow-lg">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-900 dark:text-white font-bold text-md">Invite Friends</h3>
            <UserPlus className="w-5 h-5 text-yc-orange" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-xs mb-4 leading-relaxed">
            Get <span className="text-gray-900 dark:text-white font-bold">500 XTZ</span> for every friend who joins Season 4.
        </p>
        <div className="flex space-x-2">
            <input type="text" value="YC-JON-8821" readOnly className="bg-gray-100 dark:bg-black/50 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs px-3 py-2 rounded flex-1 font-mono focus:outline-none" />
            <button className="bg-gray-900 dark:bg-gray-700 hover:bg-yc-orange text-white text-xs font-bold px-3 py-2 rounded transition-colors">
                Copy
            </button>
        </div>
      </div>

    </aside>
  );
};

export default RightPanel;