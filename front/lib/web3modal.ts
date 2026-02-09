// Web3Modal configuration for UnicornX
/// <reference types="vite/client" />
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';

// Get projectId from WalletConnect Cloud - https://cloud.walletconnect.com/
const projectId = (import.meta as any).env?.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Etherlink Shadownet Testnet configuration
const etherlinkShadownet = {
    chainId: 127823,
    name: 'Etherlink Shadownet',
    currency: 'XTZ',
    explorerUrl: 'https://shadownet.explorer.etherlink.com',
    rpcUrl: 'https://node.shadownet.etherlink.com'
};

// Etherlink Mainnet (for future use)
const etherlinkMainnet = {
    chainId: 42793,
    name: 'Etherlink Mainnet',
    currency: 'XTZ',
    explorerUrl: 'https://explorer.etherlink.com',
    rpcUrl: 'https://node.mainnet.etherlink.com'
};

// Metadata for WalletConnect
const metadata = {
    name: 'UnicornX',
    description: 'Fantasy trading card game with YC startups',
    url: 'https://unicornx.xyz',
    icons: ['https://unicornx.xyz/logo.png']
};

// Configure Web3Modal
const ethersConfig = defaultConfig({
    metadata,
    enableEIP6963: true, // Supports injected wallets like MetaMask
    enableInjected: true,
    enableCoinbase: true,
});

// Create modal instance
createWeb3Modal({
    ethersConfig,
    chains: [etherlinkShadownet],
    projectId,
    enableAnalytics: false,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-color-mix': '#F26522',
        '--w3m-color-mix-strength': 20,
        '--w3m-accent': '#F26522',
        '--w3m-border-radius-master': '12px',
    },
    featuredWalletIds: [
        'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96', // MetaMask
    ],
});

export { etherlinkShadownet, etherlinkMainnet };
