import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, Sparkles, ExternalLink, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';

interface FeedEvent {
    id: number;
    startup: string;
    eventType: string;
    description: string;
    points: number;
    tweetId: string | null;
    date: string;
    createdAt: string;
    summary: string | null;
}

interface Pagination {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
}

// Map Twitter handles for building tweet URLs
const STARTUP_HANDLES: Record<string, string> = {
    'Openclaw': 'openclaw',
    'Lovable': 'lovable_dev',
    'Cursor': 'cursor_ai',
    'OpenAI': 'OpenAI',
    'Anthropic': 'AnthropicAI',
    'Browser Use': 'browser_use',
    'Dedalus Labs': 'dedaluslabs',
    'Autumn': 'autumnpricing',
    'Axiom': 'axiom_xyz',
    'Multifactor': 'MultifactorCOM',
    'Dome': 'getdomeapi',
    'GrazeMate': 'GrazeMate',
    'Tornyol Systems': 'tornyolsystems',
    'Pocket': 'heypocket',
    'Caretta': 'Caretta',
    'AxionOrbital Space': 'axionorbital',
    'Freeport Markets': 'freeportmrkts',
    'Ruvo': 'ruvopay',
    'Lightberry': 'lightberryai',
};

const EVENT_TYPE_COLORS: Record<string, string> = {
    'product_launch': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'partnership': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'fundraising': 'bg-green-500/10 text-green-500 border-green-500/20',
    'milestone': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'community': 'bg-pink-500/10 text-pink-500 border-pink-500/20',
    'technical': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

function getTweetUrl(event: FeedEvent): string | null {
    if (!event.tweetId) return null;
    const handle = STARTUP_HANDLES[event.startup];
    if (handle) {
        return `https://x.com/${handle}/status/${event.tweetId}`;
    }
    return `https://x.com/i/status/${event.tweetId}`;
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatEventType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const Feed: React.FC = () => {
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [filterStartup, setFilterStartup] = useState<string | null>(null);

    const fetchFeed = useCallback(async (offset = 0, append = false) => {
        if (offset === 0) setLoading(true);
        else setLoadingMore(true);

        try {
            const res = await fetch(`/api/feed?limit=20&offset=${offset}`);
            const data = await res.json();
            if (data.success) {
                if (append) {
                    setEvents(prev => [...prev, ...data.data]);
                } else {
                    setEvents(data.data);
                }
                setPagination(data.pagination);
            }
        } catch (err) {
            console.error('Failed to fetch feed:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();
        const interval = setInterval(() => fetchFeed(), 60000);
        return () => clearInterval(interval);
    }, [fetchFeed]);

    const loadMore = () => {
        if (pagination?.hasMore) {
            fetchFeed(pagination.offset + pagination.limit, true);
        }
    };

    // Get unique startup names for filter chips
    const startupNames = Array.from(new Set(events.map(e => e.startup))).sort();

    // Filter events
    const filteredEvents = filterStartup
        ? events.filter(e => e.startup === filterStartup)
        : events;

    return (
        <div className="overflow-x-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-yc-orange/10 rounded-xl">
                        <Newspaper className="w-6 h-6 text-yc-orange" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-yc-text-primary dark:text-white tracking-tight">Feed</h2>
                        <p className="text-sm text-gray-500">
                            {pagination ? `${pagination.total} events tracked` : 'Loading...'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => fetchFeed()}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-yc-orange transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filter Chips */}
            {startupNames.length > 0 && (
                <div className="mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                            onClick={() => setFilterStartup(null)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                                filterStartup === null
                                    ? 'bg-yc-orange text-white shadow-lg shadow-yc-orange/30'
                                    : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                            }`}
                        >
                            All
                        </button>
                        {startupNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setFilterStartup(filterStartup === name ? null : name)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
                                    filterStartup === name
                                        ? 'bg-yc-orange text-white shadow-lg shadow-yc-orange/30'
                                        : 'bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-yc-orange" />
                    <span className="ml-3 text-lg font-bold text-gray-400">Loading feed...</span>
                </div>
            )}

            {/* Empty State */}
            {!loading && filteredEvents.length === 0 && (
                <div className="text-center py-20">
                    <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400 mb-2">No Events Yet</h3>
                    <p className="text-gray-500">Feed events will appear here once scoring runs.</p>
                </div>
            )}

            {/* Event Cards */}
            {!loading && filteredEvents.length > 0 && (
                <div className="space-y-3">
                    {filteredEvents.map(event => {
                        const tweetUrl = getTweetUrl(event);
                        const eventColor = EVENT_TYPE_COLORS[event.eventType] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

                        return (
                            <div
                                key={event.id}
                                className="bg-white dark:bg-[#121212] border border-gray-200 dark:border-[#2A2A2A] rounded-xl p-4 hover:border-yc-orange/30 transition-all"
                            >
                                {/* Top Row: Startup + Event Type + Time */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-yc-orange">{event.startup}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${eventColor}`}>
                                            {formatEventType(event.eventType)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400">{timeAgo(event.createdAt)}</span>
                                        <span className="text-sm font-mono font-bold text-green-500">+{event.points}</span>
                                    </div>
                                </div>

                                {/* AI Summary */}
                                {event.summary && (
                                    <div className="flex items-start gap-2 mb-2 p-2.5 bg-yc-orange/5 dark:bg-yc-orange/10 rounded-lg border border-yc-orange/10">
                                        <Sparkles className="w-3.5 h-3.5 text-yc-orange shrink-0 mt-0.5" />
                                        <p className="text-sm font-medium text-yc-text-primary dark:text-white leading-snug">{event.summary}</p>
                                    </div>
                                )}

                                {/* Full Description */}
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{event.description}</p>

                                {/* Footer: Date + Tweet Link */}
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-[#1A1A1A]">
                                    <span className="text-xs text-gray-400">{event.date}</span>
                                    {tweetUrl && (
                                        <a
                                            href={tweetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-yc-orange transition-colors"
                                        >
                                            View Tweet <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Load More Button */}
                    {pagination?.hasMore && (
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="w-full py-3 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-200 dark:hover:bg-[#222] transition-all flex items-center justify-center gap-2"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-4 h-4" />
                                    Load More ({pagination.total - pagination.offset - pagination.limit} remaining)
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Feed;
