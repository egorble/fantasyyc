import React from 'react';
import { X, ExternalLink, Smartphone } from 'lucide-react';

export interface DetectedWallet {
    info: {
        uuid: string;
        name: string;
        icon: string;
        rdns: string;
    };
    provider: any;
}

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    wallets: DetectedWallet[];
    onSelectWallet: (provider: any, rdns: string) => void;
    isConnecting: boolean;
}

const MOBILE_WALLETS = [
    {
        name: 'MetaMask',
        color: '#E8831D',
        getLink: () => `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`,
    },
    {
        name: 'Trust Wallet',
        color: '#0500FF',
        getLink: () => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(window.location.href)}`,
    },
    {
        name: 'Coinbase Wallet',
        color: '#0052FF',
        getLink: () => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(window.location.href)}`,
    },
];

const isMobile = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, wallets, onSelectWallet, isConnecting }) => {
    if (!isOpen) return null;

    const mobile = isMobile();
    const hasInjected = typeof window !== 'undefined' && !!(window as any).ethereum;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-[#121212] rounded-t-2xl md:rounded-2xl p-6 w-full max-w-sm md:mx-4 shadow-2xl animate-[slideUp_0.2s_ease-out]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Connect Wallet</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Connecting spinner */}
                {isConnecting && (
                    <div className="text-center py-8">
                        <div className="w-10 h-10 mx-auto border-3 border-yc-orange/30 border-t-yc-orange rounded-full animate-spin mb-3" />
                        <p className="text-gray-500 text-sm">Confirm in your wallet...</p>
                    </div>
                )}

                {/* Detected wallets (EIP-6963) */}
                {!isConnecting && wallets.length > 0 && (
                    <div className="space-y-2">
                        {wallets.map(wallet => (
                            <button
                                key={wallet.info.uuid}
                                onClick={() => onSelectWallet(wallet.provider, wallet.info.rdns)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-yc-orange hover:bg-yc-orange/5 transition-all active:scale-[0.98]"
                            >
                                <img
                                    src={wallet.info.icon}
                                    alt={wallet.info.name}
                                    className="w-9 h-9 rounded-xl"
                                />
                                <span className="text-gray-900 dark:text-white font-bold text-sm flex-1 text-left">
                                    {wallet.info.name}
                                </span>
                                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Detected</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Fallback: window.ethereum without EIP-6963 (desktop) */}
                {!isConnecting && wallets.length === 0 && !mobile && hasInjected && (
                    <div className="space-y-2">
                        <button
                            onClick={() => onSelectWallet((window as any).ethereum, 'injected')}
                            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-yc-orange hover:bg-yc-orange/5 transition-all active:scale-[0.98]"
                        >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-bold">
                                W
                            </div>
                            <span className="text-gray-900 dark:text-white font-bold text-sm flex-1 text-left">
                                Browser Wallet
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Detected</span>
                        </button>
                    </div>
                )}

                {/* Mobile deep links — show when no wallet detected (regular browser) */}
                {!isConnecting && mobile && !hasInjected && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                            <Smartphone className="w-4 h-4 text-gray-400" />
                            <p className="text-gray-500 text-xs font-medium">Open in wallet app</p>
                        </div>
                        {MOBILE_WALLETS.map(wallet => (
                            <a
                                key={wallet.name}
                                href={wallet.getLink()}
                                rel="noopener noreferrer"
                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-yc-orange hover:bg-yc-orange/5 transition-all active:scale-[0.98] block"
                            >
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                                    style={{ backgroundColor: wallet.color }}
                                >
                                    {wallet.name[0]}
                                </div>
                                <span className="text-gray-900 dark:text-white font-bold text-sm flex-1 text-left">
                                    {wallet.name}
                                </span>
                                <ExternalLink className="w-4 h-4 text-gray-400" />
                            </a>
                        ))}
                    </div>
                )}

                {/* Mobile deep links — also show below detected wallets for "other wallet" option */}
                {!isConnecting && mobile && hasInjected && wallets.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#2A2A2A]">
                        <p className="text-gray-500 text-xs font-medium mb-2">Or open in another wallet</p>
                        <div className="flex gap-2">
                            {MOBILE_WALLETS.map(wallet => (
                                <a
                                    key={wallet.name}
                                    href={wallet.getLink()}
                                    rel="noopener noreferrer"
                                    className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-200 dark:border-[#2A2A2A] hover:border-yc-orange transition-all"
                                >
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                        style={{ backgroundColor: wallet.color }}
                                    >
                                        {wallet.name[0]}
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-medium">{wallet.name.split(' ')[0]}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* No wallet at all (desktop) */}
                {!isConnecting && !mobile && wallets.length === 0 && !hasInjected && (
                    <div className="text-center py-6">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                            <Smartphone className="w-7 h-7 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm mb-4">No wallet detected</p>
                        <a
                            href="https://metamask.io/download/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-yc-orange font-bold text-sm hover:underline"
                        >
                            Install MetaMask <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                )}

                {/* Safe area bottom padding on mobile */}
                <div className="h-2 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
            </div>
        </div>
    );
};

export default WalletModal;
