// Direct wallet context — no Web3Modal, no API keys
// Uses window.ethereum (MetaMask, Rabby, Trust Wallet, Coinbase, etc.)
// On mobile: open site in wallet's built-in browser
import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { BrowserProvider, ethers, Eip1193Provider } from 'ethers';
import { CHAIN_ID, CHAIN_NAME, RPC_URL, EXPLORER_URL, getProvider } from '../lib/contracts';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    balance: bigint;
    chainId: number | null;
    isCorrectChain: boolean;
    isConnecting: boolean;
    error: string | null;
    hasMetaMask: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    switchChain: () => Promise<void>;
    getSigner: () => Promise<ethers.Signer | null>;
    refreshBalance: () => void;
    formatAddress: (address: string) => string;
    formatBalance: (wei: bigint, decimals?: number) => string;
    // Expose provider for hooks that need it directly
    walletProvider: Eip1193Provider | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

// Persist connection state
const STORAGE_KEY = 'unicornx:wallet:connected';

function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(wei: bigint, decimals = 4): string {
    const xtz = Number(ethers.formatEther(wei));
    return xtz.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function getEthereum(): any {
    if (typeof window !== 'undefined' && window.ethereum) {
        return window.ethereum;
    }
    return null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [balance, setBalance] = useState<bigint>(0n);
    const [error, setError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const ethereum = getEthereum();
    const hasMetaMask = !!ethereum;
    const isConnected = !!address;
    const isCorrectChain = chainId === CHAIN_ID;

    // Update balance
    const updateBalance = useCallback(async (addr: string) => {
        try {
            const provider = getProvider();
            const bal = await provider.getBalance(addr);
            setBalance(bal);
        } catch (e) {
            console.error('Failed to get balance:', e);
        }
    }, []);

    // Read chain ID from provider
    const readChainId = useCallback(async () => {
        if (!ethereum) return;
        try {
            const hexChainId = await ethereum.request({ method: 'eth_chainId' });
            setChainId(parseInt(hexChainId, 16));
        } catch { /* ignore */ }
    }, [ethereum]);

    // Handle connection result
    const handleAccounts = useCallback((accounts: string[]) => {
        if (accounts.length > 0) {
            setAddress(accounts[0]);
            localStorage.setItem(STORAGE_KEY, 'true');
        } else {
            setAddress(null);
            setBalance(0n);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    // Connect wallet
    const connect = useCallback(async () => {
        if (!ethereum) {
            setError('No wallet detected. Install MetaMask or open in your wallet browser.');
            return;
        }
        setIsConnecting(true);
        setError(null);
        try {
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            handleAccounts(accounts);
            await readChainId();
        } catch (e: any) {
            if (e.code === 4001) {
                setError('Connection rejected');
            } else {
                setError(e.message || 'Failed to connect');
            }
        } finally {
            setIsConnecting(false);
        }
    }, [ethereum, handleAccounts, readChainId]);

    // Disconnect wallet (clear local state — no WalletConnect session to destroy)
    const disconnect = useCallback(() => {
        setAddress(null);
        setBalance(0n);
        setChainId(null);
        setError(null);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Switch to correct chain
    const switchChain = useCallback(async () => {
        if (!ethereum) return;
        const hexChainId = '0x' + CHAIN_ID.toString(16);
        try {
            await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }],
            });
        } catch (switchError: any) {
            // Chain not added — add it
            if (switchError.code === 4902) {
                try {
                    await ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: hexChainId,
                            chainName: CHAIN_NAME,
                            nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 },
                            rpcUrls: [RPC_URL],
                            blockExplorerUrls: [EXPLORER_URL],
                        }],
                    });
                } catch (addError: any) {
                    console.error('Failed to add chain:', addError);
                }
            } else {
                console.error('Failed to switch chain:', switchError);
            }
        }
    }, [ethereum]);

    // Get signer for transactions
    const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
        if (!ethereum || !isConnected) return null;
        try {
            const provider = new BrowserProvider(ethereum as Eip1193Provider);
            return await provider.getSigner();
        } catch (e) {
            console.error('Failed to get signer:', e);
            return null;
        }
    }, [ethereum, isConnected]);

    // Refresh balance
    const refreshBalance = useCallback(() => {
        if (address) updateBalance(address);
    }, [address, updateBalance]);

    // Listen for wallet events
    useEffect(() => {
        if (!ethereum) return;

        const onAccountsChanged = (accounts: string[]) => handleAccounts(accounts);
        const onChainChanged = (hexChainId: string) => setChainId(parseInt(hexChainId, 16));

        ethereum.on('accountsChanged', onAccountsChanged);
        ethereum.on('chainChanged', onChainChanged);

        return () => {
            ethereum.removeListener('accountsChanged', onAccountsChanged);
            ethereum.removeListener('chainChanged', onChainChanged);
        };
    }, [ethereum, handleAccounts]);

    // Auto-reconnect if previously connected
    useEffect(() => {
        if (!ethereum) return;
        const wasConnected = localStorage.getItem(STORAGE_KEY);
        if (wasConnected) {
            ethereum.request({ method: 'eth_accounts' })
                .then((accounts: string[]) => {
                    if (accounts.length > 0) {
                        handleAccounts(accounts);
                        readChainId();
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                })
                .catch(() => {});
        }
    }, [ethereum, handleAccounts, readChainId]);

    // Balance polling
    useEffect(() => {
        if (address) {
            updateBalance(address);
            const interval = setInterval(() => updateBalance(address), 10000);
            return () => clearInterval(interval);
        } else {
            setBalance(0n);
        }
    }, [address, updateBalance]);

    const value: WalletContextType = {
        isConnected,
        address,
        balance,
        chainId,
        isCorrectChain,
        isConnecting,
        error,
        hasMetaMask,
        connect,
        disconnect,
        switchChain,
        getSigner,
        refreshBalance,
        formatAddress,
        formatBalance,
        walletProvider: ethereum as Eip1193Provider | null,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWalletContext() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWalletContext must be used within WalletProvider');
    }
    return context;
}
