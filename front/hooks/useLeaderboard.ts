import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:3003/api';

export interface LeaderboardEntry {
    rank: number;
    address: string;
    score: number;
    lastUpdated: string;
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
 * Hook to fetch leaderboard data
 */
export function useLeaderboard(tournamentId: number | null, limit: number = 100) {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tournamentId) return;

        const fetchLeaderboard = async () => {
            setLoading(true);
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
                setLoading(false);
            }
        };

        fetchLeaderboard();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => clearInterval(interval);
    }, [tournamentId, limit]);

    return { leaderboard, loading, error };
}

/**
 * Hook to fetch player's rank
 */
export function usePlayerRank(tournamentId: number | null, playerAddress: string | null) {
    const [rank, setRank] = useState<PlayerRank | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tournamentId || !playerAddress) return;

        const fetchRank = async () => {
            setLoading(true);
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
                setLoading(false);
            }
        };

        fetchRank();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchRank, 30000);
        return () => clearInterval(interval);
    }, [tournamentId, playerAddress]);

    return { rank, loading, error };
}

/**
 * Hook to fetch daily scores
 */
export function useDailyScores(tournamentId: number | null, date: string) {
    const [scores, setScores] = useState<DailyScore[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tournamentId || !date) return;

        const fetchScores = async () => {
            setLoading(true);
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
                setLoading(false);
            }
        };

        fetchScores();
    }, [tournamentId, date]);

    return { scores, loading, error };
}

/**
 * Hook to fetch tournament stats
 */
export function useTournamentStats(tournamentId: number | null) {
    const [stats, setStats] = useState<TournamentStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tournamentId) return;

        const fetchStats = async () => {
            setLoading(true);
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
                setLoading(false);
            }
        };

        fetchStats();

        // Auto-refresh every minute
        const interval = setInterval(fetchStats, 60000);
        return () => clearInterval(interval);
    }, [tournamentId]);

    return { stats, loading, error };
}
