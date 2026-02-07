import React, { useState } from 'react';
import { MOCK_STARTUPS } from '../constants';
import StartupCard from './StartupCard';
import CardDetailModal, { CardDetailData } from './CardDetailModal';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

const Marketplace: React.FC = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedStartup, setSelectedStartup] = useState<CardDetailData | null>(null);
  const tabs = ['All', 'Trending', 'New IPOs', 'AI Sector', 'SaaS', 'Fintech', 'BioTech'];

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
        
        {/* Header & Controls Container */}
        <div className="flex flex-col space-y-6 mb-8">
            
            {/* Title & Description */}
            <div>
                <h2 className="text-2xl md:text-3xl font-black text-yc-text-primary dark:text-white uppercase tracking-tight">Marketplace</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Discover and trade assets from top performing YC startups.</p>
            </div>

            {/* Filter Bar - Clean Style */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                
                {/* Pill Tabs - Scrollable on Mobile */}
                <div className="flex items-center space-x-2 overflow-x-auto w-full xl:w-auto pb-2 xl:pb-0 scrollbar-hide -mx-4 px-4 xl:mx-0 xl:px-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                whitespace-nowrap px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 transform active:scale-95
                                ${activeTab === tab 
                                    ? 'bg-black dark:bg-white text-yc-orange shadow-lg shadow-yc-orange/10 scale-105' 
                                    : 'text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}
                            `}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Right Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
                    
                    {/* Search */}
                    <div className="relative w-full sm:w-auto sm:flex-1 xl:flex-none xl:w-64 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-yc-orange transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            className="w-full bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-full pl-10 pr-4 py-2.5 text-sm font-medium text-yc-text-primary dark:text-white focus:outline-none focus:border-yc-orange focus:ring-1 focus:ring-yc-orange transition-all placeholder-gray-400 shadow-sm"
                        />
                    </div>

                    {/* Sort */}
                    <button className="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm font-bold text-yc-text-primary dark:text-white hover:border-yc-orange hover:text-yc-orange transition-all shadow-sm whitespace-nowrap group">
                        <ArrowUpDown className="w-3 h-3 mr-2 text-gray-400 group-hover:text-yc-orange" />
                        Sort by: Market Cap
                    </button>
                </div>
            </div>
        </div>

        {/* Large Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
            {MOCK_STARTUPS.map((startup) => (
                 <StartupCard 
                    key={startup.id} 
                    startup={startup} 
                    onClick={() => setSelectedStartup({
                        id: startup.id,
                        image: startup.coverImage,
                        name: startup.name,
                        value: startup.value,
                        rarity: 'Common',
                        multiplier: '1.1x', // Default for marketplace view
                        batch: startup.batch,
                        stage: startup.stage
                    })}
                />
            ))}
            {/* Duplicating for demo density */}
            {MOCK_STARTUPS.slice(0, 4).map((startup) => (
                 <StartupCard 
                    key={`${startup.id}-dup`} 
                    startup={{...startup, id: `${startup.id}-dup`}}
                    onClick={() => setSelectedStartup({
                        id: startup.id,
                        image: startup.coverImage,
                        name: startup.name,
                        value: startup.value,
                        rarity: 'Common',
                        multiplier: '1.1x',
                        batch: startup.batch,
                        stage: startup.stage
                    })} 
                 />
            ))}
        </div>

        {/* Modal */}
        <CardDetailModal 
            data={selectedStartup} 
            onClose={() => setSelectedStartup(null)} 
        />
    </div>
  );
};

export default Marketplace;