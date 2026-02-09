// Global wallet context for app-wide wallet state
import React, { createContext, useContext, ReactNode } from 'react';
import { useWallet as useWalletHook, formatAddress, formatBalance } from '../hooks/useWallet';
import { ethers } from 'ethers';

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

export function WalletProvider({ children }: { children: ReactNode }) {
    const wallet = useWalletHook();

    return (
        <WalletContext.Provider value={{ ...wallet, formatAddress, formatBalance }}>
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
