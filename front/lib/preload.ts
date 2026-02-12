// Preloader: fires all dashboard API calls in parallel on import
// Import this BEFORE App.tsx to start fetching while React is still mounting
//
// Flow:
// 1. Module imported → all fetches fire immediately (parallel)
// 2. React mounts → components check preloaded data → instant render (no spinner)
// 3. Components still poll on their own intervals for updates

import { blockchainCache } from './cache';

const API = '/api';

// ── Cache keys for preloaded data ──
export const PreloadKeys = {
    activeTournament: 'preload:tournament',
    liveFeed: 'preload:livefeed',
    leaderboard: (id: number) => `preload:leaderboard:${id}`,
    topStartups: (id: number) => `preload:topStartups:${id}`,
};

// ── Preload state ──
let _tournamentId: number | null = null;

/** Get preloaded tournament ID (null if not yet loaded) */
export function getPreloadedTournamentId(): number | null {
    return _tournamentId;
}

// ── Main preload function ──
async function preloadAll() {
    const start = performance.now();

    try {
        // Phase 1: tournament + live feed in parallel
        const [tournamentRes, feedRes] = await Promise.all([
            fetch(`${API}/tournaments/active`).then(r => r.json()).catch(() => null),
            fetch(`${API}/live-feed?limit=15`).then(r => r.json()).catch(() => null),
        ]);

        if (tournamentRes?.success) {
            blockchainCache.set(PreloadKeys.activeTournament, tournamentRes.data);
            _tournamentId = tournamentRes.data.id;
        }

        if (feedRes?.success) {
            blockchainCache.set(PreloadKeys.liveFeed, feedRes.data);
        }

        // Phase 2: leaderboard + top startups (need tournament ID)
        if (_tournamentId) {
            const [leaderboardRes, startupsRes] = await Promise.all([
                fetch(`${API}/leaderboard/${_tournamentId}?limit=10`).then(r => r.json()).catch(() => null),
                fetch(`${API}/top-startups/${_tournamentId}?limit=5`).then(r => r.json()).catch(() => null),
            ]);

            if (leaderboardRes?.success) {
                blockchainCache.set(PreloadKeys.leaderboard(_tournamentId), leaderboardRes.data);
            }
            if (startupsRes?.success) {
                blockchainCache.set(PreloadKeys.topStartups(_tournamentId), startupsRes.data);
            }
        }

        const elapsed = (performance.now() - start).toFixed(0);
        console.log(`⚡ Preload complete in ${elapsed}ms`);
    } catch (e) {
        console.warn('Preload failed:', e);
    }
}

// Fire immediately on module import
export const preloadPromise = preloadAll();
