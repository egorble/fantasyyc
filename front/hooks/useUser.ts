import { useState, useCallback, useEffect } from 'react';
import { useWalletContext } from '../context/WalletContext';
import { generatePixelAvatar } from '../lib/pixelAvatar';

const API_BASE = 'http://localhost:3003/api';

export interface UserProfileData {
    address: string;
    username: string;
    avatar: string | null;
}

export function useUser() {
    const { address, isConnected } = useWalletContext();
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [needsRegistration, setNeedsRegistration] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);

    // Check if user exists in backend
    const checkUser = useCallback(async (addr: string) => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/users/${addr}`);
            const data = await res.json();

            if (data.success && data.data) {
                setProfile({
                    address: data.data.address,
                    username: data.data.username,
                    avatar: data.data.avatar || generatePixelAvatar(addr),
                });
                setNeedsRegistration(false);
                setIsNewUser(false);
            } else {
                // Backend confirmed user doesn't exist
                setProfile(null);
                setNeedsRegistration(true);
                setIsNewUser(true);
            }
        } catch {
            // Backend unreachable - don't show registration modal, just skip
            // The user can still use the app, and we'll check again on next connect
            setProfile(null);
            setNeedsRegistration(false);
            setIsNewUser(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // Register new user
    const registerUser = useCallback(async (username: string, avatarDataUrl?: string) => {
        if (!address) return false;

        try {
            setLoading(true);

            // Check for stored referrer to send with registration
            // localStorage may already be cleared by useReferral hook, so also check URL params
            let referrer = localStorage.getItem('fantasyyc_referrer');
            if (!referrer) {
                const params = new URLSearchParams(window.location.search);
                const ref = params.get('ref');
                if (ref && ref.startsWith('0x') && ref.length === 42) {
                    referrer = ref.toLowerCase();
                }
            }

            const res = await fetch(`${API_BASE}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address.toLowerCase(),
                    username,
                    avatar: avatarDataUrl || null,
                    referrer: referrer || null,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setProfile({
                    address: data.data.address,
                    username: data.data.username,
                    avatar: data.data.avatar || generatePixelAvatar(address),
                });
                setNeedsRegistration(false);
                setIsNewUser(data.isNew);
                return data.isNew;
            }
            return false;
        } catch {
            return false;
        } finally {
            setLoading(false);
        }
    }, [address]);

    // Update existing profile
    const updateProfile = useCallback(async (username: string, avatarDataUrl?: string) => {
        if (!address) return false;

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/users/${address.toLowerCase()}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    avatar: avatarDataUrl || null,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setProfile({
                    address: data.data.address,
                    username: data.data.username,
                    avatar: data.data.avatar || generatePixelAvatar(address),
                });
                return true;
            }
            return false;
        } catch {
            return false;
        } finally {
            setLoading(false);
        }
    }, [address]);

    // Get generated pixel avatar for address
    const getPixelAvatar = useCallback((addr?: string) => {
        return generatePixelAvatar(addr || address || '');
    }, [address]);

    // Check user on wallet connect
    useEffect(() => {
        if (isConnected && address) {
            checkUser(address);
        } else {
            setProfile(null);
            setNeedsRegistration(false);
            setIsNewUser(false);
        }
    }, [isConnected, address, checkUser]);

    return {
        profile,
        needsRegistration,
        isNewUser,
        loading,
        registerUser,
        updateProfile,
        getPixelAvatar,
    };
}
