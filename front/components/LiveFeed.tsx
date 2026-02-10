import React, { useState, useEffect } from 'react';
import { Activity, ArrowUpRight, RefreshCw } from 'lucide-react';

interface FeedEvent {
    id: number;
    startup: string;
    eventType: string;
    description: string;
    points: number;
    date: string;
    createdAt: string;
}

const EVENT_LABELS: Record<string, { label: string; type: 'positive' | 'negative' }> = {
    FUNDING: { label: 'Funding', type: 'positive' },
    PARTNERSHIP: { label: 'Partnership', type: 'positive' },
    KEY_HIRE: { label: 'Key Hire', type: 'positive' },
    PRODUCT_LAUNCH: { label: 'Launch', type: 'positive' },
    REVENUE_MILESTONE: { label: 'Revenue', type: 'positive' },
    ACQUISITION: { label: 'Acquisition', type: 'positive' },
    MEDIA_MENTION: { label: 'Media', type: 'positive' },
    GROWTH: { label: 'Growth', type: 'positive' },
    POST: { label: 'Post', type: 'positive' },
};

const LiveFeed: React.FC = () => {
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFeed = async () => {
        try {
            const res = await fetch('http://localhost:3003/api/live-feed?limit=6');
            const data = await res.json();
            if (data.success && data.data.length > 0) {
                setEvents(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch live feed:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFeed();
        const interval = setInterval(fetchFeed, 60000);
        return () => clearInterval(interval);
    }, []);

    const fallbackEvents: FeedEvent[] = [
        { id: 0, startup: 'OpenAI', eventType: 'FUNDING', description: 'OpenAI closes massive $6.6B funding round at $157B valuation', points: 500, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 1, startup: 'Anthropic', eventType: 'PARTNERSHIP', description: 'Anthropic announces strategic partnership with major cloud provider for enterprise AI deployment', points: 300, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 2, startup: 'Cursor', eventType: 'PRODUCT_LAUNCH', description: 'Cursor releases new AI-powered code editor version with multi-file editing support', points: 250, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 3, startup: 'Lovable', eventType: 'GROWTH', description: 'Lovable surpasses 100K active developers on the platform in record time', points: 200, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 4, startup: 'Browser Use', eventType: 'MEDIA_MENTION', description: 'Browser Use featured in TechCrunch as top AI agent framework for web automation', points: 150, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
        { id: 5, startup: 'Openclaw', eventType: 'POST', description: 'Openclaw team shares major technical breakthrough in decentralized AI inference', points: 100, date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() },
    ];

    const displayEvents = events.length > 0 ? events.slice(0, 6) : fallbackEvents;

    // Duplicate items for seamless infinite scroll
    const marqueeItems = [...displayEvents, ...displayEvents];

    return (
        <div className="w-full bg-white dark:bg-yc-dark-panel border border-gray-200 dark:border-yc-dark-border rounded-xl py-3 px-4 mb-8 overflow-hidden">
            <div className="flex items-center gap-3">
                {/* Fixed label */}
                <div className="flex items-center shrink-0 pr-3 border-r border-gray-200 dark:border-yc-dark-border">
                    <Activity className="w-4 h-4 text-yc-orange mr-2" />
                    <span className="text-xs font-bold text-gray-500 dark:text-[#888888] uppercase tracking-widest whitespace-nowrap">Live Feed</span>
                    {loading && <RefreshCw className="w-3 h-3 text-gray-400 animate-spin ml-2" />}
                </div>

                {/* Scrolling marquee */}
                <div className="overflow-hidden flex-1">
                    <div className="flex animate-marquee whitespace-nowrap">
                        {marqueeItems.map((event, idx) => {
                            const eventInfo = EVENT_LABELS[event.eventType] || { label: event.eventType, type: 'positive' as const };
                            return (
                                <div key={`${event.id}-${idx}`} className="inline-flex items-center mr-8 shrink-0">
                                    <span className="text-xs font-bold text-yc-orange mr-1.5">{event.startup}</span>
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-2 ${
                                        eventInfo.type === 'positive'
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                    }`}>{eventInfo.label}</span>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">{event.description}</span>
                                    <span className="text-xs font-mono font-bold text-green-500 flex items-center shrink-0">
                                        +{event.points} pts
                                        <ArrowUpRight className="w-3 h-3 ml-0.5" />
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveFeed;
