import React from 'react';
import { NavSection } from '../types';
import { Flame, Store, Wallet, Swords, Newspaper, ShieldCheck } from 'lucide-react';
import { isAdmin } from '../hooks/useAdmin';
import { useWalletContext } from '../context/WalletContext';

interface BottomNavProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeSection, onNavigate }) => {
  const { address } = useWalletContext();
  const userIsAdmin = isAdmin(address);

  const tabs = [
    { id: NavSection.HOME, icon: Flame, label: 'Home' },
    { id: NavSection.MARKETPLACE, icon: Store, label: 'Market' },
    { id: NavSection.PORTFOLIO, icon: Wallet, label: 'Portfolio' },
    { id: NavSection.LEAGUES, icon: Swords, label: 'Leagues' },
    { id: NavSection.FEED, icon: Newspaper, label: 'Feed' },
    ...(userIsAdmin ? [{ id: NavSection.ADMIN, icon: ShieldCheck, label: 'Admin' }] : []),
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-center pb-safe">
      <nav className="mx-4 mb-3 px-3 py-2 w-full max-w-[400px] rounded-[28px] bg-white/70 dark:bg-[#121212]/70 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.5)] flex justify-between">
        {tabs.map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 w-14 ${isActive
                ? 'bg-yc-orange text-white shadow-lg shadow-yc-orange/30 -translate-y-1 scale-110'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 active:scale-95'
                }`}
            >
              <tab.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <span className="text-[9px] mt-1 font-bold whitespace-nowrap">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomNav;
