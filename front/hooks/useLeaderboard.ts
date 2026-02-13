import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = '/api';

export interface LeaderboardEntry {
    rank: number;
    address: string;
    score: number;
    lastUpdated: string;
    username?: string | null;
    avatar?: string | null;
}

export interface PlayerRank {
    rank: number;
    score: number;
    address: string;
}

export interface DailyScore {
    startup: string;
    points: number;
    tweetsAnalyzed: number;
    events: any[];
}

export interface TournamentStats {
    total_players: number;
    avg_score: number;
    max_score: number;
    min_score: number;
}

/**
 * Hook to fetch leaderboard data.
 * Uses stale-while-revalidate: shows existing data during refetch, no loading flicker.
 */
export function useLeaderboard(tournamentId: number | null, limit: number = 100) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId) return;
        hasFetched.current = false;

        const fetchLeaderboard = async () => {
            if (!hasFetched.current) setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/leaderboard/${tournamentId}?limit=${limit}`);
                const data = await response.json();

                if (data.success) {
                    setLeaderboard(data.data);
                } else {
                    setError(data.message || 'Failed to fetch leaderboard');
                }
            } catch (err) {
                setError('Network error');
                console.error('Error fetching leaderboard:', err);
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchLeaderboard();

        const interval = setInterval(fetchLeaderboard, 10000);
        return () => clearInterval(interval);
    }, [tournamentId, limit]);

    return { leaderboard, loading, error };
}

/**
 * Hook to fetch player's rank.
 */
export function usePlayerRank(tournamentId: number | null, playerAddress: string | null) {
    const [rank, setRank] = useState<PlayerRank | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId || !playerAddress) return;
        hasFetched.current = false;

        const fetchRank = async () => {
            if (!hasFetched.current) setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/player/${playerAddress}/rank/${tournamentId}`);
                const data = await response.json();

                if (data.success) {
                    setRank(data.data);
                } else {
                    setRank(null);
                    setError(data.message || 'Player not found');
                }
            } catch (err) {
                setError('Network error');
                console.error('Error fetching player rank:', err);
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchRank();

        const interval = setInterval(fetchRank, 10000);
        return () => clearInterval(interval);
    }, [tournamentId, playerAddress]);

    return { rank, loading, error };
}

/**
 * Hook to fetch daily scores.
 */
export function useDailyScores(tournamentId: number | null, date: string) {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId || !date) return;
        hasFetched.current = false;

        const fetchScores = async () => {
            if (!hasFetched.current) setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/daily-scores/${tournamentId}/${date}`);
                const data = await response.json();

                if (data.success) {
                    setScores(data.data);
                } else {
                    setError(data.message || 'Failed to fetch scores');
                }
            } catch (err) {
                setError('Network error');
                console.error('Error fetching daily scores:', err);
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchScores();
    }, [tournamentId, date]);

    return { scores, loading, error };
}

/**
 * Hook to fetch tournament stats.
 */
export function useTournamentStats(tournamentId: number | null) {
    const [stats, setStats] = useState<TournamentStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!tournamentId) return;
        hasFetched.current = false;

        const fetchStats = async () => {
            if (!hasFetched.current) setLoading(true);
            setError(null);

            try {
                const response = await fetch(`${API_BASE_URL}/stats/${tournamentId}`);
                const data = await response.json();

                if (data.success) {
                    setStats(data.data);
                } else {
                    setError(data.message || 'Failed to fetch stats');
                }
            } catch (err) {
                setError('Network error');
                console.error('Error fetching stats:', err);
            } finally {
                hasFetched.current = true;
                setLoading(false);
            }
        };

        fetchStats();

        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [tournamentId]);

    return { stats, loading, error };
}
