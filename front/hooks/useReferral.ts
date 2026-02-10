import { useState, useCallback, useEffect } from 'react';
import { useWalletContext } from '../context/WalletContext';
import { getPackOpenerContract, formatXTZ } from '../lib/contracts';

const REFERRAL_STORAGE_KEY = 'fantasyyc_referrer';
const API_BASE = 'http://localhost:3003/api';

export function useReferral() {
    const { address, isConnected } = useWalletContext();
    const [referralStats, setReferralStats] = useState<{ count: number; totalEarned: string }>({
        count: 0,
        totalEarned: '0',
    });
    const [myReferrer, setMyReferrer] = useState<string | null>(null);

    // Generate referral link
    const getReferralLink = useCallback(() => {
        if (!address) return '';
        return `${window.location.origin}?ref=${address}`;
    }, [address]);

    // Check URL for referral code on page load and store in localStorage
    const checkReferralFromURL = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref && ref.startsWith('0x') && ref.length === 42) {
            const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
            if (!stored) {
                localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toLowerCase());
            }
            return ref.toLowerCase();
        }
        return localStorage.getItem(REFERRAL_STORAGE_KEY);
    }, []);

    // Fetch referral stats - on-chain + backend
    const fetchReferralStats = useCallback(async () => {
        if (!address) return;

        try {
            const contract = getPackOpenerContract();
            const [count, totalEarned] = await contract.getReferralStats(address);
            const onChainCount = Number(count);
            const onChainEarned = formatXTZ(totalEarned);

            // Also fetch backend stats
            let backendCount = 0;
            try {
                const res = await fetch(`${API_BASE}/referrals/${address}`);
                const data = await res.json();
                if (data.success) {
                    backendCount = data.data.totalReferrals || 0;
                }
            } catch {
                // Backend unavailable
            }

            setReferralStats({
                count: Math.max(onChainCount, backendCount),
                totalEarned: onChainEarned,
            });

            // Get my referrer
            const referrer = await contract.getReferrer(address);
            if (referrer !== '0x0000000000000000000000000000000000000000') {
                setMyReferrer(referrer);
            }
        } catch {
            // On-chain failed, try backend only
            try {
                const res = await fetch(`${API_BASE}/referrals/${address}`);
                const data = await res.json();
                if (data.success) {
                    setReferralStats({
                        count: data.data.totalReferrals || 0,
                        totalEarned: String(data.data.totalEarned || 0),
                    });
                }
            } catch {
                // Both failed
            }
        }
    }, [address]);

    // Auto-check referral URL and fetch stats
    useEffect(() => {
        if (isConnected && address) {
            checkReferralFromURL();
            fetchReferralStats();

            const interval = setInterval(fetchReferralStats, 30000);
            return () => clearInterval(interval);
        }
    }, [isConnected, address, checkReferralFromURL, fetchReferralStats]);

    return {
        getReferralLink,
        referralStats,
        myReferrer,
        fetchReferralStats,
    };
}
