import React, { useState } from 'react';
import { Clock, Gift, UserPlus, ChevronRight, Copy, Check, Users, DollarSign } from 'lucide-react';
import { useWalletContext } from '../context/WalletContext';
import { useReferral } from '../hooks/useReferral';

interface RightPanelProps {
  onOpenPack: () => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ onOpenPack }) => {
  const { isConnected, address, formatAddress } = useWalletContext();
  const { getReferralLink, referralStats } = useReferral();
  const [copied, setCopied] = useState(false);

  const referralLink = getReferralLink();

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-80 h-screen fixed right-0 top-0 bg-white dark:bg-yc-dark-panel border-l border-gray-200 dark:border-yc-dark-border p-6 hidden xl:flex flex-col space-y-6 z-40 overflow-y-auto transition-colors duration-300">

      {/* Daily Reward / Free Pack */}
      <div className="bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5 relative overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 p-2 opacity-10 text-gray-900 dark:text-white">
            <Gift size={64} />
        </div>
        <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Daily Reward</h3>
        <p className="text-gray-500 dark:text-[#888888] text-xs mb-4">Claim your free common pack.</p>

        <div className="flex items-center justify-between bg-white dark:bg-[#050505] rounded-lg p-3 border border-gray-200 dark:border-[#2A2A2A] mb-4">
            <span className="text-xs text-gray-500 dark:text-[#888888] font-mono uppercase">Next drop</span>
            <div className="flex items-center text-yc-orange font-mono font-bold text-sm">
                <Clock className="w-3 h-3 mr-1.5" />
                04:23:12
            </div>
        </div>

        <button
          onClick={onOpenPack}
          className="w-full bg-gray-900 dark:bg-[#1A1A1A] hover:bg-yc-orange text-white border border-transparent dark:border-yc-orange py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center justify-center"
        >
          Open Pack
        </button>
      </div>

      {/* Top Gainers */}
      <div className="bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-5 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-gray-900 dark:text-white font-bold text-sm uppercase tracking-wide">Top Gainers</h3>
             <button className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
             </button>
        </div>

        <div className="space-y-3">
            {[
                { name: 'Rippling', val: '+12.4%', price: '$42.50' },
                { name: 'Deel', val: '+8.2%', price: '$31.20' },
                { name: 'Brex', val: '+5.1%', price: '$55.00' }
            ].map((stock, i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 p-1 rounded transition-colors">
                    <div className="flex items-center">
                        <div className="w-8 h-8 rounded bg-white dark:bg-[#1A1A1A] flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-[#888888] border border-gray-200 dark:border-[#2A2A2A] mr-3">
                            {stock.name[0]}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-yc-orange transition-colors">{stock.name}</p>
                            <p className="text-[10px] text-gray-500 dark:text-[#888888]">Saas / B2B</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-bold text-green-500 font-mono">{stock.val}</p>
                        <p className="text-[10px] text-gray-500 dark:text-[#888888] font-mono">{stock.price}</p>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Referral Program */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-gray-900 dark:to-black border border-orange-200 dark:border-gray-800 rounded-xl p-5 relative shadow-lg">
        <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-900 dark:text-white font-bold text-md">Referral Program</h3>
            <UserPlus className="w-5 h-5 text-yc-orange" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-xs mb-4 leading-relaxed">
            Earn <span className="text-yc-orange font-bold">10%</span> from every pack your friends buy.
            Share your link below!
        </p>

        {/* Referral Stats */}
        {isConnected && (
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-white/80 dark:bg-black/50 rounded-lg p-2.5 border border-orange-200/50 dark:border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Referrals</span>
                    </div>
                    <p className="text-gray-900 dark:text-white font-bold font-mono">{referralStats.count}</p>
                </div>
                <div className="bg-white/80 dark:bg-black/50 rounded-lg p-2.5 border border-orange-200/50 dark:border-gray-700">
                    <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Earned</span>
                    </div>
                    <p className="text-yc-orange font-bold font-mono">{referralStats.totalEarned} XTZ</p>
                </div>
            </div>
        )}

        {/* Referral Link */}
        <div className="relative">
            <input
                type="text"
                value={isConnected ? referralLink : 'Connect wallet first'}
                readOnly
                className="w-full bg-white/80 dark:bg-black/50 border border-orange-200/50 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs px-3 py-2 pr-16 rounded font-mono focus:outline-none truncate"
            />
            <button
                onClick={handleCopy}
                disabled={!isConnected}
                className={`absolute right-1 top-1/2 -translate-y-1/2 text-white text-xs font-bold px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                    copied
                        ? 'bg-green-500'
                        : isConnected
                            ? 'bg-yc-orange hover:bg-orange-600'
                            : 'bg-gray-400 cursor-not-allowed'
                }`}
            >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'OK' : 'Copy'}
            </button>
        </div>

        {/* Distribution Info */}
        <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-500 space-y-0.5">
            <p>10% to referrer | 10% platform | 80% prize pool</p>
            <p>No referrer: 10% platform | 90% prize pool</p>
        </div>
      </div>

    </aside>
  );
};

export default RightPanel;
