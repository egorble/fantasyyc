import React, { useState, useEffect, useCallback } from 'react';
import { Newspaper, ExternalLink, RefreshCw, ChevronDown, Loader2, TrendingUp } from 'lucide-react';

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

const EVENT_TYPE_LABELS: Record<string, string> = {
    'FUNDING': 'Fundraising',
    'PARTNERSHIP': 'Partnership',
    'KEY_HIRE': 'Team',
    'REVENUE': 'Revenue',
    'PRODUCT_LAUNCH': 'Product',
    'ACQUISITION': 'M&A',
    'MEDIA_MENTION': 'Media',
    'GROWTH': 'Growth',
    'ENGAGEMENT': 'Trending',
};

function getTweetUrl(event: FeedEvent): string | null {
    if (!event.tweetId) return null;
    const handle = STARTUP_HANDLES[event.startup];
    if (handle) {
        return `https://x.com/${handle}/status/${event.tweetId}`;
    }
    return `https://x.com/i/status/${event.tweetId}`;
}

function makeHeadline(event: FeedEvent): string {
    if (event.summary && event.summary.length > 10) return event.summary;
    // Fallback: create headline from startup + event type + first sentence
    const typeLabel = EVENT_TYPE_LABELS[event.eventType] || '';
    const firstSentence = (event.description || '').split(/[.\n!?]/)[0].trim();
    if (firstSentence.length > 15) {
        return firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
    }
    return `${event.startup}: ${typeLabel || 'Update'}`;
}

function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

    const startupNames = Array.from(new Set(events.map(e => e.startup))).sort();
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
                        <h2 className="text-2xl font-black text-yc-text-primary dark:text-white tracking-tight">News Feed</h2>
                        <p className="text-sm text-gray-500">
                            {pagination ? `${pagination.total} stories` : 'Loading...'}
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

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-yc-orange" />
                    <span className="ml-3 text-lg font-bold text-gray-400">Loading feed...</span>
                </div>
            )}

            {/* Empty */}
            {!loading && filteredEvents.length === 0 && (
                <div className="text-center py-20">
                    <Newspaper className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-400 mb-2">No Stories Yet</h3>
                    <p className="text-gray-500">News will appear here once scoring runs.</p>
                </div>
            )}

            {/* News Cards */}
            {!loading && filteredEvents.length > 0 && (
                <div className="space-y-px bg-gray-200 dark:bg-[#2A2A2A] rounded-xl overflow-hidden">
                    {filteredEvents.map(event => {
                        const tweetUrl = getTweetUrl(event);
                        const typeLabel = EVENT_TYPE_LABELS[event.eventType] || event.eventType;
                        const headline = makeHeadline(event);
                        const snippet = event.description?.substring(0, 120);

                        return (
                            <article
                                key={event.id}
                                className="bg-white dark:bg-[#0E0E0E] p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-[#141414] transition-colors"
                            >
                                {/* Source line */}
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-xs font-extrabold uppercase tracking-wider text-yc-orange">{event.startup}</span>
                                    <span className="text-gray-300 dark:text-[#333]">|</span>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{typeLabel}</span>
                                    <span className="text-gray-300 dark:text-[#333]">|</span>
                                    <span className="text-xs text-gray-400">{timeAgo(event.createdAt)}</span>
                                    <span className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-500">
                                        <TrendingUp className="w-3 h-3" />
                                        +{Math.round(event.points)}
                                    </span>
                                </div>

                                {/* Headline */}
                                <h3 className="text-[15px] sm:text-base font-bold text-gray-900 dark:text-white leading-snug">
                                    {headline}
                                </h3>

                                {/* Snippet + Source */}
                                <div className="flex items-end justify-between mt-1.5 gap-4">
                                    {snippet && headline !== snippet && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2 flex-1">
                                            {snippet}{snippet.length >= 120 ? '...' : ''}
                                        </p>
                                    )}
                                    {tweetUrl && (
                                        <a
                                            href={tweetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-yc-orange transition-colors shrink-0"
                                        >
                                            Source <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Load More */}
            {pagination?.hasMore && (
                <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full mt-4 py-3 rounded-xl bg-gray-100 dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-200 dark:hover:bg-[#222] transition-all flex items-center justify-center gap-2"
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
    );
};

export default Feed;
