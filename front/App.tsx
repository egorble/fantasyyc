import React, { useState, useMemo } from 'react';
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
import CardDetailModal, { CardDetailData } from './components/CardDetailModal';
import { NavSection, UserProfile } from './types';
import { MOCK_STARTUPS } from './constants';
import { Filter, Search, Wallet, Bell, Menu } from 'lucide-react';
import { ThemeProvider } from './context/ThemeContext';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<NavSection>(NavSection.HOME);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Dashboard specific selection
  const [dashboardSelectedStartup, setDashboardSelectedStartup] = useState<CardDetailData | null>(null);

  // Mock User
  const user: UserProfile = {
    name: 'Alex Trader',
    handle: '@cryptoking',
    balanceXTZ: 124500,
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
  };

  // Filter functionality for the Home Dashboard
  const filteredStartups = useMemo(() => {
    return MOCK_STARTUPS.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.batch.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Close mobile menu when changing sections
  const handleSectionChange = (section: NavSection) => {
    setActiveSection(section);
    setIsMobileMenuOpen(false);
  };

  const renderContent = () => {
      switch(activeSection) {
          case NavSection.MARKETPLACE:
              return <Marketplace />;
          case NavSection.PORTFOLIO:
              return <Portfolio onBuyPack={() => setIsPackModalOpen(true)} />;
          case NavSection.LEAGUES:
              return <Leagues />;
          case NavSection.ANALYTICS:
              return <Analytics />;
          case NavSection.HOME:
          default:
              return (
                <div className="animate-[fadeIn_0.3s_ease-out]">
                    {/* Hero Section */}
                    <div className="mb-6 md:mb-10">
                       <HeroBanner />
                    </div>
                    
                    {/* Live Ticker */}
                    <LiveFeed />

                    {/* Grid Section Header */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 md:gap-6">
                        {/* Custom Tabs - Scrollable on mobile */}
                        <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
                            <div className="flex items-center space-x-2 min-w-max">
                                <button className="px-6 py-2 bg-black dark:bg-white text-yc-orange rounded-full text-sm font-black shadow-lg shadow-yc-orange/10 transform transition-all hover:scale-105 active:scale-95">
                                    Trending
                                </button>
                                <button className="px-5 py-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white text-sm font-bold transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                    New IPOs
                                </button>
                                <button className="px-5 py-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white text-sm font-bold transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                    AI Sector
                                </button>
                                <button className="px-5 py-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white text-sm font-bold transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
                                    SaaS
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 self-end md:self-auto">
                            <span className="text-xs font-bold text-gray-400 uppercase">Sort by:</span>
                            <button className="flex items-center text-sm font-bold text-yc-text-primary dark:text-white hover:text-yc-orange transition-colors group">
                                Market Cap
                                <Filter className="w-3 h-3 ml-1 text-gray-400 group-hover:text-yc-orange transition-colors" />
                            </button>
                        </div>
                    </div>

                    {/* Startup Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                    {filteredStartups.length > 0 ? (
                        filteredStartups.map((startup) => (
                            <StartupCard 
                                key={startup.id} 
                                startup={startup} 
                                onClick={() => setDashboardSelectedStartup({
                                    id: startup.id,
                                    image: startup.coverImage,
                                    name: startup.name,
                                    value: startup.value,
                                    rarity: 'Common', // Default for public listings
                                    multiplier: '1.2x', // Estimated default
                                    batch: startup.batch,
                                    stage: startup.stage
                                })}
                            />
                        ))
                    ) : (
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 text-center py-20">
                            <p className="text-xl font-bold text-gray-400">No startups found matching "{searchQuery}"</p>
                        </div>
                    )}
                    </div>
                </div>
              );
      }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-[#050505] text-yc-text-primary dark:text-white font-sans selection:bg-yc-orange selection:text-white transition-colors duration-300">
        
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm animate-[fadeIn_0.2s]"
                onClick={() => setIsMobileMenuOpen(false)}
            />
        )}

        {/* Sidebar Navigation - Responsive */}
        <Sidebar 
          activeSection={activeSection} 
          setActiveSection={handleSectionChange}
          user={user}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area - Responsive Padding */}
        <main className="w-full md:pl-72 xl:pr-80 min-h-screen transition-all duration-300">
          <div className="w-full mx-auto p-4 md:p-6">
            
            {/* Top Bar (Search & Notifications) */}
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
                   <div className="text-right hidden lg:block">
                       <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Balance</p>
                       <p className="text-lg font-black font-mono flex items-center">
                           <span className="text-yc-orange text-sm mr-2">₿</span> 
                           {user.balanceXTZ.toLocaleString()}
                       </p>
                   </div>
                   
                   <div className="text-right hidden lg:block border-l border-gray-200 dark:border-gray-800 pl-6">
                       <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">24h Change</p>
                       <p className="text-lg font-black font-mono text-yc-green">+12.4%</p>
                   </div>

                   <button 
                        onClick={() => setWalletConnected(!walletConnected)}
                        className="bg-yc-orange hover:bg-orange-600 text-white p-2 md:px-6 md:py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center"
                   >
                      <span className="md:mr-2">+</span> <span className="hidden md:inline">Deposit</span>
                   </button>
               </div>
            </div>

            {/* Dynamic Content */}
            {renderContent()}

          </div>
        </main>

        {/* Right Widget Panel */}
        <RightPanel onOpenPack={() => setIsPackModalOpen(true)} />

        {/* Pack Opening Modal (Overlay) */}
        <PackOpeningModal 
          isOpen={isPackModalOpen} 
          onClose={() => setIsPackModalOpen(false)} 
        />
        
        {/* Card Details Modal (Home Dashboard Context) */}
        <CardDetailModal 
            data={dashboardSelectedStartup}
            onClose={() => setDashboardSelectedStartup(null)}
        />

      </div>
    </ThemeProvider>
  );
};

export default App;