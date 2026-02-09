// hooks/useMarketplace.ts
// Hook for interacting with the NFT Marketplace contract

import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { getMarketplaceContract, getNFTContract, CONTRACTS, formatXTZ } from '../lib/contracts';
import { blockchainCache } from '../lib/cache';

export interface MarketListing {
    listingId: number;
    seller: string;
    tokenId: number;
    price: bigint;
    priceFormatted: string;
    listedAt: number;
    active: boolean;
    // Card metadata (populated separately)
    cardName?: string;
    cardImage?: string;
    rarity?: string;
    multiplier?: number;
}

interface MarketplaceState {
    listings: MarketListing[];
    myListings: MarketListing[];
    isLoading: boolean;
    error: string | null;
}

export function useMarketplace() {
    const [state, setState] = useState<MarketplaceState>({
        listings: [],
        myListings: [],
        isLoading: false,
        error: null,
    });

    // Fetch all active listings
    const getActiveListings = useCallback(async (): Promise<MarketListing[]> => {
        const cacheKey = 'marketplace:listings';
        const cached = blockchainCache.get<MarketListing[]>(cacheKey);
        if (cached) return cached;

        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));
            const contract = getMarketplaceContract();
            const rawListings = await contract.getActiveListings();

            const listings: MarketListing[] = rawListings.map((l: any) => ({
                listingId: Number(l.listingId),
                seller: l.seller,
                tokenId: Number(l.tokenId),
                price: l.price,
                priceFormatted: formatXTZ(l.price),
                listedAt: Number(l.listedAt),
                active: l.active,
            }));

            blockchainCache.set(cacheKey, listings); // 30 sec default cache
            setState(prev => ({ ...prev, listings, isLoading: false }));
            return listings;
        } catch (e: any) {
            console.error('Failed to get listings:', e);
            setState(prev => ({ ...prev, error: e.message, isLoading: false }));
            return [];
        }
    }, []);

    // Get listings by seller
    const getMyListings = useCallback(async (address: string): Promise<MarketListing[]> => {
        const cacheKey = `marketplace:seller:${address}`;
        const cached = blockchainCache.get<MarketListing[]>(cacheKey);
        if (cached) return cached;

        try {
            const contract = getMarketplaceContract();
            const rawListings = await contract.getListingsBySeller(address);

            const listings: MarketListing[] = rawListings.map((l: any) => ({
                listingId: Number(l.listingId),
                seller: l.seller,
                tokenId: Number(l.tokenId),
                price: l.price,
                priceFormatted: formatXTZ(l.price),
                listedAt: Number(l.listedAt),
                active: l.active,
            }));

            blockchainCache.set(cacheKey, listings);
            setState(prev => ({ ...prev, myListings: listings }));
            return listings;
        } catch (e: any) {
            console.error('Failed to get my listings:', e);
            return [];
        }
    }, []);

    // Check if token is listed
    const isTokenListed = useCallback(async (tokenId: number): Promise<boolean> => {
        try {
            const contract = getMarketplaceContract();
            return await contract.isTokenListed(tokenId);
        } catch {
            return false;
        }
    }, []);

    // List a card for sale
    const listCard = useCallback(async (
        signer: ethers.Signer,
        tokenId: number,
        priceInXTZ: string
    ): Promise<{ success: boolean; listingId?: number; error?: string }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            // First approve marketplace to transfer NFT
            const nftContract = getNFTContract(signer);
            const approveTx = await nftContract.approve(CONTRACTS.Marketplace, tokenId, { gasLimit: 100000n });
            await approveTx.wait();

            // Then list the card
            const marketplace = getMarketplaceContract(signer);
            const priceWei = ethers.parseEther(priceInXTZ);
            const tx = await marketplace.listCard(tokenId, priceWei, { gasLimit: 500000n });
            const receipt = await tx.wait();

            // Get listing ID from event
            const event = receipt.logs.find((log: any) => {
                try {
                    const parsed = marketplace.interface.parseLog(log);
                    return parsed?.name === 'CardListed';
                } catch { return false; }
            });
            const listingId = event ? Number(marketplace.interface.parseLog(event)?.args?.listingId) : undefined;

            // Invalidate cache
            blockchainCache.invalidatePrefix('marketplace:');

            setState(prev => ({ ...prev, isLoading: false }));
            return { success: true, listingId };
        } catch (e: any) {
            console.error('Failed to list card:', e);
            setState(prev => ({ ...prev, error: e.message, isLoading: false }));
            return { success: false, error: e.message };
        }
    }, []);

    // Buy a listed card
    const buyCard = useCallback(async (
        signer: ethers.Signer,
        listingId: number,
        price: bigint
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const marketplace = getMarketplaceContract(signer);
            const tx = await marketplace.buyCard(listingId, { value: price, gasLimit: 1000000n });
            await tx.wait();

            // Invalidate caches
            blockchainCache.invalidatePrefix('marketplace:');
            blockchainCache.invalidatePrefix('nft:');

            setState(prev => ({ ...prev, isLoading: false }));
            return { success: true };
        } catch (e: any) {
            console.error('Failed to buy card:', e);
            setState(prev => ({ ...prev, error: e.message, isLoading: false }));
            return { success: false, error: e.message };
        }
    }, []);

    // Cancel a listing
    const cancelListing = useCallback(async (
        signer: ethers.Signer,
        listingId: number
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true, error: null }));

            const marketplace = getMarketplaceContract(signer);
            const tx = await marketplace.cancelListing(listingId, { gasLimit: 300000n });
            await tx.wait();

            // Invalidate caches
            blockchainCache.invalidatePrefix('marketplace:');
            blockchainCache.invalidatePrefix('nft:');

            setState(prev => ({ ...prev, isLoading: false }));
            return { success: true };
        } catch (e: any) {
            console.error('Failed to cancel listing:', e);
            setState(prev => ({ ...prev, error: e.message, isLoading: false }));
            return { success: false, error: e.message };
        }
    }, []);

    // Get marketplace fee
    const getMarketplaceFee = useCallback(async (): Promise<number> => {
        try {
            const contract = getMarketplaceContract();
            const fee = await contract.marketplaceFee();
            return Number(fee) / 100; // Convert basis points to percentage
        } catch {
            return 0;
        }
    }, []);

    return {
        ...state,
        getActiveListings,
        getMyListings,
        isTokenListed,
        listCard,
        buyCard,
        cancelListing,
        getMarketplaceFee,
    };
}
