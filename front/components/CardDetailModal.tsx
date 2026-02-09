import React from 'react';
import { X, Share2, Calendar, DollarSign, MessageCircle, BarChart3, Activity, PieChart, ExternalLink, TrendingUp, Users, Building2 } from 'lucide-react';
import { CardData, Rarity } from '../types';

export interface CardDetailData {
    id: string;
    image: string;
    name: string;
    value: string | number;
    rarity?: Rarity | string;
    multiplier?: string;
    batch?: string;
    stage?: string;
}

interface CardDetailModalProps {
    data: CardDetailData | null;
    cardData?: CardData | null; // Add real CardData prop
    onClose: () => void;
}

const CardDetailModal: React.FC<CardDetailModalProps> = ({ data, cardData, onClose }) => {
    if (!data && !cardData) return null;

    // Use real data from cardData if available, otherwise fall back to legacy data
    const displayData = cardData || data;
    if (!displayData) return null;

    // Extract fundraising data from cardData
    const fundraising = cardData?.fundraising;
    const description = cardData?.description || 'YC startup - building innovative solutions for the future.';

    // Build funding history from fundraising data or use mock
    const fundingHistory = fundraising ? [
        {
            round: fundraising.round,
            date: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            amount: fundraising.amount,
            valuation: fundraising.valuation || 'N/A',
            investor: 'Undisclosed'
        }
    ] : [];

    // Mock data for fields not in metadata yet
    const details = {
        sentiment: 87,
        socialMentions: '14.2k',
        sector: 'Artificial Intelligence',
        founded: '2023',
        description: description,
        fundingHistory: fundingHistory.length > 0 ? fundingHistory : [
            { round: 'Stealth', date: 'TBD', amount: 'N/A', valuation: 'N/A', investor: 'N/A' }
        ],
        breakdown: [
            { label: 'Technology', value: 40, color: 'bg-zinc-800 dark:bg-zinc-200' },
            { label: 'Team', value: 25, color: 'bg-zinc-600 dark:bg-zinc-400' },
            { label: 'Market', value: 20, color: 'bg-yc-orange' },
            { label: 'Traction', value: 15, color: 'bg-zinc-400 dark:bg-zinc-600' },
        ]
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s] overflow-y-auto">
            <div
                className="bg-white dark:bg-[#09090b] w-full max-w-5xl rounded-xl shadow-2xl border border-gray-200 dark:border-[#27272a] flex flex-col relative animate-[scaleIn_0.2s_ease-out]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-[#27272a]">
                    <div className="flex gap-5">
                        <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] overflow-hidden shrink-0">
                            <img
                                src={cardData?.image || data?.image}
                                alt={cardData?.name || data?.name}
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                                    {cardData?.name || data?.name}
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-[#27272a] text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#18181b]">
                                    {fundraising?.round || data?.stage || 'Available'}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4" />
                                    <span>{details.sector}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span>{data?.batch ? `Batch ${data.batch}` : 'W24'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-4 h-4" />
                                    <span>Founded {details.founded}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                            <Share2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="flex flex-col lg:flex-row h-full">

                    {/* Left Column: Key Stats & Breakdown */}
                    <div className="lg:w-2/3 p-6 border-r border-gray-200 dark:border-[#27272a]">

                        {/* Description */}
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">About</h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                                {details.description}
                            </p>
                        </div>

                        {/* Primary Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#27272a]">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                                    <DollarSign className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase">Valuation</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">
                                    {fundraising?.valuation || `${cardData?.multiplier || data?.value}x`}
                                </p>
                                <div className="mt-2 text-xs font-medium text-yc-green flex items-center">
                                    <TrendingUp className="w-3 h-3 mr-1" /> {fundraising ? 'Latest Round' : 'Multiplier'}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#27272a]">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                                    <Activity className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase">Sentiment</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">{details.sentiment}</p>
                                    <span className="text-sm text-gray-500 mb-1">/ 100</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-[#27272a] h-1.5 rounded-full mt-3 overflow-hidden">
                                    <div className="bg-yc-orange h-full rounded-full" style={{ width: `${details.sentiment}%` }}></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-[#27272a]">
                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                                    <MessageCircle className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase">Mentions</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">{details.socialMentions}</p>
                                <p className="mt-2 text-xs text-gray-500">Global volume (24h)</p>
                            </div>
                        </div>

                        {/* Valuation Breakdown - Clean Bars */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4 flex items-center">
                                <PieChart className="w-4 h-4 mr-2" /> Valuation Breakdown
                            </h3>
                            <div className="flex h-8 w-full rounded-md overflow-hidden mb-4 border border-white dark:border-black ring-1 ring-gray-200 dark:ring-[#27272a]">
                                {details.breakdown.map((item, i) => (
                                    <div key={i} style={{ width: `${item.value}%` }} className={`${item.color} h-full border-r last:border-r-0 border-white dark:border-black flex items-center justify-center`}>
                                        {item.value > 10 && <span className="text-[10px] font-bold text-white mix-blend-difference">{item.value}%</span>}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {details.breakdown.map((item, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Timeline & Actions */}
                    <div className="lg:w-1/3 bg-gray-50 dark:bg-[#0c0c0e]">

                        {/* Funding Timeline */}
                        <div className="p-6 border-b border-gray-200 dark:border-[#27272a]">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-6">Funding History</h3>
                            <div className="relative pl-2">
                                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200 dark:bg-[#27272a]"></div>
                                <div className="space-y-6">
                                    {details.fundingHistory.map((round, i) => (
                                        <div key={i} className="relative pl-8">
                                            <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-[3px] border-white dark:border-[#0c0c0e] z-10 
                                                ${i === 0 ? 'bg-yc-orange ring-1 ring-yc-orange' : 'bg-gray-300 dark:bg-gray-700'}`}></div>

                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-sm text-gray-900 dark:text-white">{round.round}</span>
                                                <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{round.amount}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-gray-500">
                                                <span>{round.date}</span>
                                                <span>Val: {round.valuation}</span>
                                            </div>
                                            <div className="mt-1 text-xs text-gray-400 font-medium">
                                                Lead: {round.investor}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Trade Actions */}
                        <div className="p-6">
                            <div className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#27272a] rounded-lg p-4 mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-gray-500 font-medium uppercase">Current Price</span>
                                    <span className="text-xs text-green-500 font-medium flex items-center"><TrendingUp className="w-3 h-3 mr-1" /> Low Volatility</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-gray-900 dark:text-white font-mono">142.50</span>
                                    <span className="text-sm font-bold text-gray-400">XTZ</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <button className="w-full py-3.5 px-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-lg font-bold text-sm hover:bg-yc-orange dark:hover:bg-yc-orange dark:hover:text-white transition-colors flex items-center justify-center">
                                    Buy Shares
                                </button>
                                <button className="w-full py-3.5 px-4 bg-transparent border border-gray-200 dark:border-[#27272a] text-gray-900 dark:text-white rounded-lg font-bold text-sm hover:bg-gray-50 dark:hover:bg-[#18181b] transition-colors flex items-center justify-center">
                                    <ExternalLink className="w-4 h-4 mr-2" /> View Prospectus
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

export default CardDetailModal;