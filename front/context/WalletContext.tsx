// Wallet context with EIP-6963 wallet discovery + selection modal
// Supports: MetaMask, Rabby, Trust Wallet, Coinbase, any EIP-6963 wallet
// Mobile: deep links to open in wallet browser (no WalletConnect needed)
import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { BrowserProvider, ethers, Eip1193Provider } from 'ethers';
import { CHAIN_ID, CHAIN_NAME, RPC_URL, EXPLORER_URL, getProvider } from '../lib/contracts';
import WalletModal, { DetectedWallet } from '../components/WalletModal';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    balance: bigint;
    chainId: number | null;
    isCorrectChain: boolean;
    isConnecting: boolean;
    error: string | null;
    connect: () => void;
    disconnect: () => void;
    switchChain: () => Promise<void>;
    getSigner: () => Promise<ethers.Signer | null>;
    refreshBalance: () => void;
    formatAddress: (address: string) => string;
    formatBalance: (wei: bigint, decimals?: number) => string;
    walletProvider: Eip1193Provider | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

const STORAGE_KEY = 'unicornx:wallet:connected';
const WALLET_RDNS_KEY = 'unicornx:wallet:rdns';

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

export function WalletProvider({ children }: { children: ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [balance, setBalance] = useState<bigint>(0n);
    const [error, setError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);
    const activeProviderRef = useRef<any>(null);
    const listenersRef = useRef<{ onAccounts: (a: string[]) => void; onChain: (h: string) => void } | null>(null);

    const isConnected = !!address;
    const isCorrectChain = chainId === CHAIN_ID;

    // Discover wallets via EIP-6963
    useEffect(() => {
        const wallets: DetectedWallet[] = [];

        const handler = (event: any) => {
            const detail = event.detail as DetectedWallet;
            if (!wallets.some(w => w.info.rdns === detail.info.rdns)) {
                wallets.push(detail);
                setDetectedWallets([...wallets]);
            }
        };

        window.addEventListener('eip6963:announceProvider', handler);
        window.dispatchEvent(new Event('eip6963:requestProvider'));

        return () => {
            window.removeEventListener('eip6963:announceProvider', handler);
        };
    }, []);

    // Update balance via read-only provider
    const updateBalance = useCallback(async (addr: string) => {
        try {
            const provider = getProvider();
            const bal = await provider.getBalance(addr);
            setBalance(bal);
        } catch (e) {
            console.error('Failed to get balance:', e);
        }
    }, []);

    // Read chain ID from a given provider
    const readChainId = useCallback(async (provider: any) => {
        if (!provider) return;
        try {
            const hexChainId = await provider.request({ method: 'eth_chainId' });
            setChainId(parseInt(hexChainId, 16));
        } catch { /* ignore */ }
    }, []);

    // Handle accounts result
    const handleAccounts = useCallback((accounts: string[]) => {
        if (accounts.length > 0) {
            setAddress(accounts[0]);
            localStorage.setItem(STORAGE_KEY, 'true');
        } else {
            setAddress(null);
            setBalance(0n);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(WALLET_RDNS_KEY);
        }
    }, []);

    // Set up event listeners on a provider
    const setupListeners = useCallback((provider: any) => {
        // Remove old listeners first
        if (listenersRef.current && activeProviderRef.current) {
            activeProviderRef.current.removeListener?.('accountsChanged', listenersRef.current.onAccounts);
            activeProviderRef.current.removeListener?.('chainChanged', listenersRef.current.onChain);
        }

        const onAccounts = (accounts: string[]) => handleAccounts(accounts);
        const onChain = (hexChainId: string) => setChainId(parseInt(hexChainId, 16));

        provider.on?.('accountsChanged', onAccounts);
        provider.on?.('chainChanged', onChain);

        listenersRef.current = { onAccounts, onChain };
        activeProviderRef.current = provider;
    }, [handleAccounts]);

    // Open connect modal
    const connect = useCallback(() => {
        setError(null);
        setShowModal(true);
    }, []);

    // Connect with a specific wallet provider
    const connectWithWallet = useCallback(async (provider: any, rdns: string) => {
        setIsConnecting(true);
        setError(null);
        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            setupListeners(provider);
            localStorage.setItem(WALLET_RDNS_KEY, rdns);
            handleAccounts(accounts);
            await readChainId(provider);
            setShowModal(false);
        } catch (e: any) {
            if (e.code === 4001) {
                setError('Connection rejected');
            } else {
                setError(e.message || 'Failed to connect');
            }
        } finally {
            setIsConnecting(false);
        }
    }, [handleAccounts, readChainId, setupListeners]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (listenersRef.current && activeProviderRef.current) {
            activeProviderRef.current.removeListener?.('accountsChanged', listenersRef.current.onAccounts);
            activeProviderRef.current.removeListener?.('chainChanged', listenersRef.current.onChain);
        }
        activeProviderRef.current = null;
        listenersRef.current = null;
        setAddress(null);
        setBalance(0n);
        setChainId(null);
        setError(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(WALLET_RDNS_KEY);
    }, []);

    // Switch to correct chain
    const switchChain = useCallback(async () => {
        const provider = activeProviderRef.current || (window as any)?.ethereum;
        if (!provider) return;
        const hexChainId = '0x' + CHAIN_ID.toString(16);
        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: hexChainId }],
            });
        } catch (switchError: any) {
            if (switchError.code === 4902) {
                try {
                    await provider.request({
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
    }, []);

    // Get signer for transactions
    const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
        const provider = activeProviderRef.current || (window as any)?.ethereum;
        if (!provider || !isConnected) return null;
        try {
            const browserProvider = new BrowserProvider(provider as Eip1193Provider);
            return await browserProvider.getSigner();
        } catch (e) {
            console.error('Failed to get signer:', e);
            return null;
        }
    }, [isConnected]);

    // Refresh balance
    const refreshBalance = useCallback(() => {
        if (address) updateBalance(address);
    }, [address, updateBalance]);

    // Auto-reconnect if previously connected
    useEffect(() => {
        const wasConnected = localStorage.getItem(STORAGE_KEY);
        if (!wasConnected) return;

        const savedRdns = localStorage.getItem(WALLET_RDNS_KEY);

        // Small delay to let EIP-6963 announcements arrive
        const timer = setTimeout(() => {
            let provider: any = null;

            // Try to find the same wallet that was used before
            if (savedRdns && savedRdns !== 'injected') {
                const wallet = detectedWallets.find(w => w.info.rdns === savedRdns);
                if (wallet) provider = wallet.provider;
            }

            // Fallback to window.ethereum
            if (!provider && (window as any)?.ethereum) {
                provider = (window as any).ethereum;
            }

            if (!provider) return;

            provider.request({ method: 'eth_accounts' })
                .then((accounts: string[]) => {
                    if (accounts.length > 0) {
                        setupListeners(provider);
                        handleAccounts(accounts);
                        readChainId(provider);
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                        localStorage.removeItem(WALLET_RDNS_KEY);
                    }
                })
                .catch(() => { });
        }, 150);

        return () => clearTimeout(timer);
    }, [detectedWallets, handleAccounts, readChainId, setupListeners]);

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
        connect,
        disconnect,
        switchChain,
        getSigner,
        refreshBalance,
        formatAddress,
        formatBalance,
        walletProvider: (activeProviderRef.current || null) as Eip1193Provider | null,
    };

    return (
        <WalletContext.Provider value={value}>
            {children}
            <WalletModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setIsConnecting(false); }}
                wallets={detectedWallets}
                onSelectWallet={connectWithWallet}
                isConnecting={isConnecting}
            />
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
