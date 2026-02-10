import { useState, useCallback, useEffect } from 'react';
import { useWalletContext } from '../context/WalletContext';
import { getPackOpenerContract, formatXTZ } from '../lib/contracts';

const REFERRAL_STORAGE_KEY = 'fantasyyc_referrer';

export function useReferral() {
    const { address, isConnected, getSigner } = useWalletContext();
    const [referralStats, setReferralStats] = useState<{ count: number; totalEarned: string }>({
        count: 0,
        totalEarned: '0',
    });
    const [myReferrer, setMyReferrer] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Generate referral link
    const getReferralLink = useCallback(() => {
        if (!address) return '';
        return `${window.location.origin}?ref=${address}`;
    }, [address]);

    // Check URL for referral code on page load
    const checkReferralFromURL = useCallback(() => {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (ref && ref.startsWith('0x') && ref.length === 42) {
            // Store referrer locally
            const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
            if (!stored) {
                localStorage.setItem(REFERRAL_STORAGE_KEY, ref.toLowerCase());
            }
            return ref.toLowerCase();
        }
        return localStorage.getItem(REFERRAL_STORAGE_KEY);
    }, []);

    // Register referrer on-chain
    const registerReferrer = useCallback(async (referrerAddress: string) => {
        if (!isConnected || !address) return false;
        if (referrerAddress.toLowerCase() === address.toLowerCase()) return false;

        try {
            setLoading(true);
            const signer = await getSigner();
            if (!signer) return false;

            const contract = getPackOpenerContract(signer);
            const tx = await contract.setReferrer(referrerAddress);
            await tx.wait();

            setMyReferrer(referrerAddress);
            localStorage.removeItem(REFERRAL_STORAGE_KEY); // Clear after registering
            return true;
        } catch (error: any) {
            // AlreadyHasReferrer is expected if already registered
            if (error.message?.includes('AlreadyHasReferrer')) {
                console.log('Referrer already set');
            } else {
                console.error('Failed to register referrer:', error);
            }
            return false;
        } finally {
            setLoading(false);
        }
    }, [isConnected, address, getSigner]);

    // Fetch referral stats from contract
    const fetchReferralStats = useCallback(async () => {
        if (!address) return;

        try {
            const contract = getPackOpenerContract();

            // Get stats
            const [count, totalEarned] = await contract.getReferralStats(address);
            setReferralStats({
                count: Number(count),
                totalEarned: formatXTZ(totalEarned),
            });

            // Get my referrer
            const referrer = await contract.getReferrer(address);
            if (referrer !== '0x0000000000000000000000000000000000000000') {
                setMyReferrer(referrer);
            }
        } catch (error) {
            // Contract might not be deployed yet, use backend fallback
            try {
                const res = await fetch(`http://localhost:3003/api/referrals/${address}`);
                const data = await res.json();
                if (data.success) {
                    setReferralStats({
                        count: data.data.totalReferrals,
                        totalEarned: String(data.data.totalEarned),
                    });
                }
            } catch {
                // Silently fail
            }
        }
    }, [address]);

    // Auto-check referral URL and fetch stats
    useEffect(() => {
        if (isConnected && address) {
            checkReferralFromURL();
            fetchReferralStats();
        }
    }, [isConnected, address, checkReferralFromURL, fetchReferralStats]);

    // Auto-register referrer when connected
    useEffect(() => {
        if (isConnected && address && !myReferrer) {
            const storedReferrer = localStorage.getItem(REFERRAL_STORAGE_KEY);
            if (storedReferrer && storedReferrer !== address.toLowerCase()) {
                registerReferrer(storedReferrer);
            }
        }
    }, [isConnected, address, myReferrer, registerReferrer]);

    return {
        getReferralLink,
        referralStats,
        myReferrer,
        registerReferrer,
        fetchReferralStats,
        loading,
    };
}
