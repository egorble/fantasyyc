// Global wallet context using Web3Modal
'use client';
import React, { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';
import { useWeb3Modal, useWeb3ModalProvider, useWeb3ModalAccount, useDisconnect, useWeb3ModalState } from '@web3modal/ethers/react';
import { BrowserProvider, ethers, Eip1193Provider } from 'ethers';
import { CHAIN_ID, getProvider } from '../lib/contracts';
// Import web3modal config (runs createWeb3Modal on import)
import '../lib/web3modal';

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
}

const WalletContext = createContext<WalletContextType | null>(null);

// Helper functions
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
    const { open } = useWeb3Modal();
    const { walletProvider } = useWeb3ModalProvider();
    const { address, chainId, isConnected } = useWeb3ModalAccount();
    const { disconnect: web3Disconnect } = useDisconnect();
    const { open: isModalOpen } = useWeb3ModalState();

    const [balance, setBalance] = useState<bigint>(0n);
    const [error, setError] = useState<string | null>(null);

    // Check MetaMask availability
    const hasMetaMask = typeof window !== 'undefined' && !!window.ethereum;

    // Check if on correct chain
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

    // Update balance when address changes + poll every 10s
    useEffect(() => {
        if (address) {
            updateBalance(address);
            const interval = setInterval(() => updateBalance(address), 10000);
            return () => clearInterval(interval);
        } else {
            setBalance(0n);
        }
    }, [address, updateBalance]);

    // Connect wallet - opens Web3Modal
    const connect = useCallback(async () => {
        try {
            setError(null);
            await open();
        } catch (e: any) {
            setError(e.message || 'Failed to connect');
        }
    }, [open]);

    // Disconnect wallet
    const disconnect = useCallback(() => {
        web3Disconnect();
        setBalance(0n);
        setError(null);
    }, [web3Disconnect]);

    // Switch to correct chain
    const switchChain = useCallback(async () => {
        try {
            await open({ view: 'Networks' });
        } catch (e: any) {
            console.error('Failed to switch chain:', e);
        }
    }, [open]);

    // Get signer for transactions
    const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
        if (!walletProvider || !isConnected) return null;
        try {
            const provider = new BrowserProvider(walletProvider as Eip1193Provider);
            return await provider.getSigner();
        } catch (e) {
            console.error('Failed to get signer:', e);
            return null;
        }
    }, [walletProvider, isConnected]);

    // Refresh balance
    const refreshBalance = useCallback(() => {
        if (address) {
            updateBalance(address);
        }
    }, [address, updateBalance]);

    const value: WalletContextType = {
        isConnected,
        address: address || null,
        balance,
        chainId: chainId || null,
        isCorrectChain,
        isConnecting: isModalOpen,
        error,
        hasMetaMask,
        connect,
        disconnect,
        switchChain,
        getSigner,
        refreshBalance,
        formatAddress,
        formatBalance,
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
