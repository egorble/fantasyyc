// useMarketplaceV2.ts - Hook for MarketplaceV2 contract with bids, auctions, history
'use client';

import { useState, useCallback } from 'react';
import { useWeb3ModalProvider, useWeb3ModalAccount } from '@web3modal/ethers/react';
import { BrowserProvider, ethers } from 'ethers';
import { getMarketplaceV2Contract, getNFTContract, CONTRACTS, formatXTZ } from '@/lib/contracts';

// ============ Types ============
export interface Bid {
    bidId: bigint;
    bidder: string;
    tokenId: bigint;
    amount: bigint;
    expiration: bigint;
    active: boolean;
}

export interface Auction {
    auctionId: bigint;
    seller: string;
    tokenId: bigint;
    startPrice: bigint;
    reservePrice: bigint;
    highestBid: bigint;
    highestBidder: string;
    startTime: bigint;
    endTime: bigint;
    status: number; // 0=Active, 1=Ended, 2=Cancelled
}

export interface Sale {
    tokenId: bigint;
    seller: string;
    buyer: string;
    price: bigint;
    timestamp: bigint;
    saleType: number; // 0=Listing, 1=Bid, 2=Auction
}

export interface TokenStats {
    totalSales: bigint;
    totalVolume: bigint;
    highestSale: bigint;
    lowestSale: bigint;
    lastSalePrice: bigint;
    lastSaleTime: bigint;
}

export interface MarketplaceStats {
    totalListings: bigint;
    activeBids: bigint;
    activeAuctions: bigint;
    totalVolume: bigint;
    totalSales: bigint;
}

export interface Listing {
    listingId: bigint;
    seller: string;
    tokenId: bigint;
    price: bigint;
    listedAt: bigint;
    active: boolean;
}

// ============ Hook ============
export function useMarketplaceV2() {
    const { address, isConnected } = useWeb3ModalAccount();
    const { walletProvider } = useWeb3ModalProvider();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get signer
    const getSigner = useCallback(async () => {
        if (!walletProvider) throw new Error('Wallet not connected');
        const provider = new BrowserProvider(walletProvider as any);
        return provider.getSigner();
    }, [walletProvider]);

    // ============ Listings ============
    const getActiveListings = useCallback(async (): Promise<Listing[]> => {
        try {
            const contract = getMarketplaceV2Contract();
            const listings = await contract.getActiveListings();
            return listings.map((l: any) => ({
                listingId: l.listingId,
                seller: l.seller,
                tokenId: l.tokenId,
                price: l.price,
                listedAt: l.listedAt,
                active: l.active,
            }));
        } catch (err: any) {
            console.error('Error getting listings:', err);
            return [];
        }
    }, []);

    const listCard = useCallback(async (tokenId: bigint, priceInXTZ: string) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const nftContract = getNFTContract(signer);
            const marketplaceContract = getMarketplaceV2Contract(signer);

            // Approve marketplace
            const approveTx = await nftContract.approve(CONTRACTS.MarketplaceV2, tokenId, {
                gasLimit: 100000n
            });
            await approveTx.wait();

            // List card
            const priceWei = ethers.parseEther(priceInXTZ);
            const listTx = await marketplaceContract.listCard(tokenId, priceWei, {
                gasLimit: 300000n
            });
            await listTx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to list card');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const buyCard = useCallback(async (listingId: bigint, price: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.buyCard(listingId, {
                value: price,
                gasLimit: 500000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to buy card');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const cancelListing = useCallback(async (listingId: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.cancelListing(listingId, {
                gasLimit: 200000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to cancel listing');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    // ============ Bids ============
    const placeBid = useCallback(async (tokenId: bigint, amountInXTZ: string, expirationDays: number = 7) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const amountWei = ethers.parseEther(amountInXTZ);
            const expiration = BigInt(Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60);

            const tx = await contract.placeBid(tokenId, expiration, {
                value: amountWei,
                gasLimit: 300000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to place bid');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const cancelBid = useCallback(async (bidId: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.cancelBid(bidId, {
                gasLimit: 200000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to cancel bid');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const acceptBid = useCallback(async (bidId: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.acceptBid(bidId, {
                gasLimit: 500000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to accept bid');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const getBidsForToken = useCallback(async (tokenId: bigint): Promise<Bid[]> => {
        try {
            const contract = getMarketplaceV2Contract();
            const bids = await contract.getActiveBidsForToken(tokenId);
            return bids.map((b: any) => ({
                bidId: b.bidId,
                bidder: b.bidder,
                tokenId: b.tokenId,
                amount: b.amount,
                expiration: b.expiration,
                active: b.active,
            }));
        } catch (err: any) {
            console.error('Error getting bids:', err);
            return [];
        }
    }, []);

    const getMyBids = useCallback(async (): Promise<Bid[]> => {
        if (!address) return [];
        try {
            const contract = getMarketplaceV2Contract();
            const bids = await contract.getBidsByBidder(address);
            return bids.map((b: any) => ({
                bidId: b.bidId,
                bidder: b.bidder,
                tokenId: b.tokenId,
                amount: b.amount,
                expiration: b.expiration,
                active: b.active,
            }));
        } catch (err: any) {
            console.error('Error getting my bids:', err);
            return [];
        }
    }, [address]);

    // ============ Auctions ============
    const createAuction = useCallback(async (
        tokenId: bigint,
        startPriceXTZ: string,
        reservePriceXTZ: string,
        durationDays: number
    ) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const nftContract = getNFTContract(signer);
            const contract = getMarketplaceV2Contract(signer);

            // Approve marketplace
            const approveTx = await nftContract.approve(CONTRACTS.MarketplaceV2, tokenId, {
                gasLimit: 100000n
            });
            await approveTx.wait();

            const startPrice = ethers.parseEther(startPriceXTZ);
            const reservePrice = ethers.parseEther(reservePriceXTZ);
            const duration = BigInt(durationDays * 24 * 60 * 60);

            const tx = await contract.createAuction(tokenId, startPrice, reservePrice, duration, {
                gasLimit: 400000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to create auction');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const bidOnAuction = useCallback(async (auctionId: bigint, amountInXTZ: string) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const amountWei = ethers.parseEther(amountInXTZ);

            const tx = await contract.bidOnAuction(auctionId, {
                value: amountWei,
                gasLimit: 300000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to bid on auction');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const finalizeAuction = useCallback(async (auctionId: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.finalizeAuction(auctionId, {
                gasLimit: 500000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to finalize auction');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const cancelAuction = useCallback(async (auctionId: bigint) => {
        setLoading(true);
        setError(null);
        try {
            const signer = await getSigner();
            const contract = getMarketplaceV2Contract(signer);

            const tx = await contract.cancelAuction(auctionId, {
                gasLimit: 300000n
            });
            await tx.wait();

            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to cancel auction');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [getSigner]);

    const getActiveAuctions = useCallback(async (): Promise<Auction[]> => {
        try {
            const contract = getMarketplaceV2Contract();
            const auctions = await contract.getActiveAuctions();
            return auctions.map((a: any) => ({
                auctionId: a.auctionId,
                seller: a.seller,
                tokenId: a.tokenId,
                startPrice: a.startPrice,
                reservePrice: a.reservePrice,
                highestBid: a.highestBid,
                highestBidder: a.highestBidder,
                startTime: a.startTime,
                endTime: a.endTime,
                status: a.status,
            }));
        } catch (err: any) {
            console.error('Error getting auctions:', err);
            return [];
        }
    }, []);

    // ============ History & Stats ============
    const getTokenSaleHistory = useCallback(async (tokenId: bigint): Promise<Sale[]> => {
        try {
            const contract = getMarketplaceV2Contract();
            const history = await contract.getTokenSaleHistory(tokenId);
            return history.map((s: any) => ({
                tokenId: s.tokenId,
                seller: s.seller,
                buyer: s.buyer,
                price: s.price,
                timestamp: s.timestamp,
                saleType: s.saleType,
            }));
        } catch (err: any) {
            console.error('Error getting sale history:', err);
            return [];
        }
    }, []);

    const getTokenStats = useCallback(async (tokenId: bigint): Promise<TokenStats | null> => {
        try {
            const contract = getMarketplaceV2Contract();
            const stats = await contract.getTokenStats(tokenId);
            return {
                totalSales: stats.totalSales,
                totalVolume: stats.totalVolume,
                highestSale: stats.highestSale,
                lowestSale: stats.lowestSale,
                lastSalePrice: stats.lastSalePrice,
                lastSaleTime: stats.lastSaleTime,
            };
        } catch (err: any) {
            console.error('Error getting token stats:', err);
            return null;
        }
    }, []);

    const getMarketplaceStats = useCallback(async (): Promise<MarketplaceStats | null> => {
        try {
            const contract = getMarketplaceV2Contract();
            const stats = await contract.getMarketplaceStats();
            return {
                totalListings: stats.totalListings,
                activeBids: stats.activeBids,
                activeAuctions: stats.activeAuctions,
                totalVolume: stats.totalVolume,
                totalSales: stats.totalSales,
            };
        } catch (err: any) {
            console.error('Error getting marketplace stats:', err);
            return null;
        }
    }, []);

    return {
        // State
        loading,
        error,
        isConnected,
        address,

        // Listings
        getActiveListings,
        listCard,
        buyCard,
        cancelListing,

        // Bids
        placeBid,
        cancelBid,
        acceptBid,
        getBidsForToken,
        getMyBids,

        // Auctions
        createAuction,
        bidOnAuction,
        finalizeAuction,
        cancelAuction,
        getActiveAuctions,

        // History & Stats
        getTokenSaleHistory,
        getTokenStats,
        getMarketplaceStats,

        // Utils
        formatXTZ,
    };
}
