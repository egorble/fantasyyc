// Centralized cache service for blockchain data
// Cache first, update in background, refresh on changes

type CacheEntry<T> = {
    data: T;
    timestamp: number;
    key: string;
};

// Default TTL: 30 seconds for frequently changing data
const DEFAULT_TTL = 30 * 1000;
// Long TTL: 5 minutes for rarely changing data
const LONG_TTL = 5 * 60 * 1000;

class BlockchainCache {
    private cache = new Map<string, CacheEntry<any>>();
    private pendingRequests = new Map<string, Promise<any>>();

    // Get cached data immediately, optionally fetch fresh in background
    get<T>(key: string): T | undefined {
        const entry = this.cache.get(key);
        return entry?.data;
    }

    // Check if cache is stale
    isStale(key: string, ttl: number = DEFAULT_TTL): boolean {
        const entry = this.cache.get(key);
        if (!entry) return true;
        return Date.now() - entry.timestamp > ttl;
    }

    // Set cache value
    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            key
        });
    }

    // Invalidate specific cache key
    invalidate(key: string): void {
        this.cache.delete(key);
    }

    // Invalidate all keys starting with prefix
    invalidatePrefix(prefix: string): void {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    // Clear all cache
    clear(): void {
        this.cache.clear();
    }

    // Get or fetch with deduplication - prevents multiple simultaneous requests for same data
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl: number = DEFAULT_TTL
    ): Promise<T> {
        // Return cached if fresh enough
        const cached = this.get<T>(key);
        if (cached !== undefined && !this.isStale(key, ttl)) {
            return cached;
        }

        // Check if there's already a pending request for this key
        const pending = this.pendingRequests.get(key);
        if (pending) {
            return pending;
        }

        // Create new request
        const request = fetcher()
            .then(data => {
                this.set(key, data);
                this.pendingRequests.delete(key);
                return data;
            })
            .catch(err => {
                this.pendingRequests.delete(key);
                // Return cached data on error if available
                const fallback = this.get<T>(key);
                if (fallback !== undefined) {
                    console.warn(`Cache fallback for ${key}:`, err.message);
                    return fallback;
                }
                throw err;
            });

        this.pendingRequests.set(key, request);
        return request;
    }

    // Fetch in background and update cache without blocking
    fetchInBackground<T>(key: string, fetcher: () => Promise<T>): void {
        // Don't create duplicate requests
        if (this.pendingRequests.has(key)) return;

        const request = fetcher()
            .then(data => {
                this.set(key, data);
                this.pendingRequests.delete(key);
            })
            .catch(err => {
                console.warn(`Background fetch failed for ${key}:`, err.message);
                this.pendingRequests.delete(key);
            });

        this.pendingRequests.set(key, request);
    }
}

// Singleton instance
export const blockchainCache = new BlockchainCache();

// Cache keys
export const CacheKeys = {
    // Pack data
    packPrice: () => 'pack:price',
    packsSold: () => 'pack:sold',

    // User-specific pack data
    userUnopenedPacks: (address: string) => `pack:unopened:${address}`,
    userPacks: (address: string) => `pack:user:${address}`,

    // NFT data
    ownedTokens: (address: string) => `nft:owned:${address}`,
    cardMetadata: (tokenId: number) => `nft:card:${tokenId}`,
    userCards: (address: string) => `nft:cards:${address}`,

    // Tournament data
    activeTournamentId: () => 'tournament:activeId',
    tournament: (id: number) => `tournament:${id}`,
    canRegister: (id: number) => `tournament:canRegister:${id}`,
    userEntered: (id: number, address: string) => `tournament:entered:${id}:${address}`,
    userLineup: (id: number, address: string) => `tournament:lineup:${id}:${address}`,
    tournamentPhase: (id: number) => `tournament:phase:${id}`,
};

// TTL constants
export const CacheTTL = {
    SHORT: 10 * 1000,     // 10 seconds - for rapidly changing data
    DEFAULT: 30 * 1000,   // 30 seconds - most blockchain data
    LONG: 5 * 60 * 1000,  // 5 minutes - for stable data
    PERMANENT: Infinity,  // Never expires - for immutable data
};
