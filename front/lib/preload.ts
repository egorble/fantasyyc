// Preloader: fires all dashboard API calls in parallel on import
// Import this BEFORE App.tsx to start fetching while React is still mounting
//
// Flow:
// 1. Module imported → all fetches fire immediately (parallel)
// 2. React mounts → components check preloaded data → instant render (no spinner)
// 3. Components still poll on their own intervals for updates

import { blockchainCache } from './cache';
import { apiUrl } from './api';
import { useGLTF } from '@react-three/drei';

// ── Preload 3D assets (fire-and-forget) ──
// These start downloading immediately on import but DON'T block splash.
// GLB: drei's GLTFLoader parses + caches (useGLTF() is instant later)
// HDR: browser-cached so useEnvironment() gets a cache hit later
const GLB_PATH = '/megaeth-pack.glb';
const ENV_HDR = '/env-city.hdr';
useGLTF.preload(GLB_PATH, false, true);
fetch(ENV_HDR).catch(() => {}); // warm browser cache, don't await

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

/** Reset preload state and re-fetch network-specific data only.
 *  Live feed + images are shared across networks — skip them.
 *  Old cached data stays so components don't flash blank. */
export function resetPreloadState(): void {
    _tournamentId = null;
    preloadNetworkData();
}

// ── Preload all 19 startup images into browser cache ──
// Batched (6 at a time) to avoid overwhelming HTTP/2 streams
function preloadImages(): Promise<void> {
    const STARTUP_COUNT = 19;
    const BATCH = 6;
    const ids = Array.from({ length: STARTUP_COUNT }, (_, i) => i + 1);

    const loadOne = (id: number) => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = `/images/${id}.png`;
    });

    let idx = 0;
    const next = async (): Promise<void> => {
        const batch = ids.slice(idx, idx + BATCH);
        if (!batch.length) return;
        idx += BATCH;
        await Promise.all(batch.map(loadOne));
        return next();
    };
    return next();
}

// ── Network-switch preload (tournament + leaderboard only) ──
// Live feed & top startups are shared across networks — skip them.
// Throttled: max once per 30s to avoid 429.
let _lastNetworkPreload = 0;
async function preloadNetworkData() {
    const now = Date.now();
    if (now - _lastNetworkPreload < 30_000) return;
    _lastNetworkPreload = now;

    try {
        const tournamentRes = await fetch(apiUrl('/tournaments/active')).then(r => r.json()).catch(() => null);
        if (tournamentRes?.success) {
            blockchainCache.set(PreloadKeys.activeTournament, tournamentRes.data);
            _tournamentId = tournamentRes.data.id;
        }
        if (_tournamentId) {
            const leaderboardRes = await fetch(apiUrl(`/leaderboard/${_tournamentId}?limit=10`)).then(r => r.json()).catch(() => null);
            if (leaderboardRes?.success) {
                blockchainCache.set(PreloadKeys.leaderboard(_tournamentId), leaderboardRes.data);
            }
        }
    } catch {}
}

// ── Full preload (first load only — includes live feed + images) ──
async function preloadAll() {
    // Images preload in background (batched, non-blocking) — don't hold splash
    preloadImages();

    try {
        // Phase 1: critical API data only (GLB + HDR + images load in background)
        const [tournamentRes, feedRes] = await Promise.all([
            fetch(apiUrl('/tournaments/active')).then(r => r.json()).catch(() => null),
            fetch(apiUrl('/live-feed?limit=15')).then(r => r.json()).catch(() => null),
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
                fetch(apiUrl(`/leaderboard/${_tournamentId}?limit=10`)).then(r => r.json()).catch(() => null),
                fetch(apiUrl(`/top-startups/${_tournamentId}?limit=5`)).then(r => r.json()).catch(() => null),
            ]);

            if (leaderboardRes?.success) {
                blockchainCache.set(PreloadKeys.leaderboard(_tournamentId), leaderboardRes.data);
            }
            if (startupsRes?.success) {
                blockchainCache.set(PreloadKeys.topStartups(_tournamentId), startupsRes.data);
            }
        }
    } catch (e) {
    }
}

// Fire immediately on module import
export const preloadPromise = preloadAll();
