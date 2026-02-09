// Wallet connection hook for MetaMask
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CHAIN_ID, CHAIN_NAME, RPC_URL, EXPLORER_URL, getProvider } from '../lib/contracts';

// TypeScript declaration for window.ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

interface WalletState {
    isConnected: boolean;
    address: string | null;
    balance: bigint;
    chainId: number | null;
    isCorrectChain: boolean;
    isConnecting: boolean;
    error: string | null;
}

export function useWallet() {
    const [state, setState] = useState<WalletState>({
        isConnected: false,
        address: null,
        balance: 0n,
        chainId: null,
        isCorrectChain: false,
        isConnecting: false,
        error: null,
    });

    // Check if MetaMask is installed
    const hasMetaMask = typeof window !== 'undefined' && window.ethereum;

    // Update balance
    const updateBalance = useCallback(async (address: string) => {
        try {
            const provider = getProvider();
            const balance = await provider.getBalance(address);
            setState(prev => ({ ...prev, balance }));
        } catch (e) {
            console.error('Failed to get balance:', e);
        }
    }, []);

    // Connect wallet
    const connect = useCallback(async () => {
        if (!hasMetaMask) {
            setState(prev => ({ ...prev, error: 'MetaMask not installed' }));
            return;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);
            const address = accounts[0];

            setState(prev => ({
                ...prev,
                isConnected: true,
                address,
                chainId,
                isCorrectChain: chainId === CHAIN_ID,
                isConnecting: false,
            }));

            await updateBalance(address);
        } catch (e: any) {
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: e.message || 'Failed to connect',
            }));
        }
    }, [hasMetaMask, updateBalance]);

    // Disconnect wallet
    const disconnect = useCallback(() => {
        setState({
            isConnected: false,
            address: null,
            balance: 0n,
            chainId: null,
            isCorrectChain: false,
            isConnecting: false,
            error: null,
        });
    }, []);

    // Switch to correct chain
    const switchChain = useCallback(async () => {
        if (!hasMetaMask) return;

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
            });
        } catch (switchError: any) {
            // Chain not added, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: `0x${CHAIN_ID.toString(16)}`,
                            chainName: CHAIN_NAME,
                            nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 },
                            rpcUrls: [RPC_URL],
                            blockExplorerUrls: [EXPLORER_URL],
                        }],
                    });
                } catch (addError) {
                    console.error('Failed to add chain:', addError);
                }
            }
        }
    }, [hasMetaMask]);

    // Get signer for transactions
    const getSigner = useCallback(async () => {
        if (!hasMetaMask || !state.isConnected) return null;
        const provider = new ethers.BrowserProvider(window.ethereum);
        return provider.getSigner();
    }, [hasMetaMask, state.isConnected]);

    // Listen for account/chain changes
    useEffect(() => {
        if (!hasMetaMask) return;

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                disconnect();
            } else {
                setState(prev => ({ ...prev, address: accounts[0] }));
                updateBalance(accounts[0]);
            }
        };

        const handleChainChanged = (chainIdHex: string) => {
            const chainId = parseInt(chainIdHex, 16);
            setState(prev => ({
                ...prev,
                chainId,
                isCorrectChain: chainId === CHAIN_ID,
            }));
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Check if already connected
        window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
            if (accounts.length > 0) {
                connect();
            }
        });

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        };
    }, [hasMetaMask, connect, disconnect, updateBalance]);

    return {
        ...state,
        hasMetaMask,
        connect,
        disconnect,
        switchChain,
        getSigner,
        refreshBalance: () => state.address && updateBalance(state.address),
    };
}

// Format address for display
export function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Format balance
export function formatBalance(wei: bigint, decimals = 4): string {
    const xtz = Number(ethers.formatEther(wei));
    return xtz.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}
