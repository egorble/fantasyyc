// NFT contract hook with metadata fetching
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getNFTContract, METADATA_API } from '../lib/contracts';
import { CardData, Rarity } from '../types';
import { blockchainCache, CacheKeys, CacheTTL } from '../lib/cache';

// Map rarity strings to enum
const RARITY_STRING_MAP: Record<string, Rarity> = {
    'Common': Rarity.COMMON,
    'Rare': Rarity.RARE,
    'Epic': Rarity.EPIC,
    'Epic Rare': Rarity.EPIC_RARE,
    'EpicRare': Rarity.EPIC_RARE,
    'Legendary': Rarity.LEGENDARY,
};

export function useNFT() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch metadata from backend API with caching
    const fetchMetadata = useCallback(async (tokenId: number): Promise<CardData | null> => {
        const key = CacheKeys.cardMetadata(tokenId);

        // Check cache first
        const cached = blockchainCache.get<CardData>(key);
        if (cached !== undefined) {
            return cached;
        }

        try {
            const response = await fetch(`${METADATA_API}/metadata/${tokenId}`);
            if (!response.ok) {
                console.error(`Failed to fetch metadata for token ${tokenId}:`, response.status);
                return null;
            }

            const data = await response.json();

            // Parse attributes
            const attributes = data.attributes || [];
            const getAttribute = (traitType: string) => {
                const attr = attributes.find((a: any) => a.trait_type === traitType);
                return attr?.value;
            };

            const rarityStr = getAttribute('Rarity') || 'Common';
            const multiplierStr = getAttribute('Multiplier') || '1x';
            const edition = parseInt(getAttribute('Edition')) || 1;
            const startupId = parseInt(getAttribute('Startup ID')) || 1;
            const isLocked = getAttribute('Locked') === 'Yes';

            const card: CardData = {
                tokenId,
                startupId,
                name: getAttribute('Startup') || data.name?.split(' #')[0] || 'Unknown',
                rarity: RARITY_STRING_MAP[rarityStr] || Rarity.COMMON,
                multiplier: parseInt(multiplierStr) || 1,
                isLocked,
                image: data.image || '',
                edition,
            };

            // Cache the result (long TTL - metadata is stable)
            blockchainCache.set(key, card);

            return card;
        } catch (e) {
            console.error(`Error fetching metadata for token ${tokenId}:`, e);
            return null;
        }
    }, []);

    // Get all tokens owned by address - with caching
    const getOwnedTokens = useCallback(async (address: string): Promise<number[]> => {
        const key = CacheKeys.ownedTokens(address);

        // Check cache first
        const cached = blockchainCache.get<number[]>(key);
        if (cached !== undefined) {
            // Background refresh if stale
            if (blockchainCache.isStale(key, CacheTTL.DEFAULT)) {
                blockchainCache.fetchInBackground(key, async () => {
                    const contract = getNFTContract();
                    const tokens = await contract.getOwnedTokens(address);
                    return tokens.map((t: bigint) => Number(t));
                });
            }
            return cached;
        }

        return blockchainCache.getOrFetch(key, async () => {
            const contract = getNFTContract();
            const tokens = await contract.getOwnedTokens(address);
            return tokens.map((t: bigint) => Number(t));
        }, CacheTTL.DEFAULT);
    }, []);

    // Get card info for a token (from API with proper metadata)
    const getCardInfo = useCallback(async (tokenId: number): Promise<CardData | null> => {
        return await fetchMetadata(tokenId);
    }, [fetchMetadata]);

    // Get all cards for an address
    const getCards = useCallback(async (address: string): Promise<CardData[]> => {
        setIsLoading(true);
        setError(null);

        try {
            const tokenIds = await getOwnedTokens(address);
            console.log('📋 Fetching cards for', address, '- found', tokenIds.length, 'tokens');

            // Fetch metadata for all tokens in parallel
            const cardPromises = tokenIds.map(id => fetchMetadata(id));
            const cards = await Promise.all(cardPromises);

            // Filter out nulls
            const validCards = cards.filter((c): c is CardData => c !== null);
            console.log('   Loaded', validCards.length, 'cards');

            return validCards;
        } catch (e: any) {
            setError(e.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [getOwnedTokens, fetchMetadata]);

    // Merge 3 cards into 1 higher rarity
    const mergeCards = useCallback(async (
        signer: ethers.Signer,
        tokenIds: [number, number, number]
    ): Promise<{ success: boolean; newTokenId?: number; error?: string }> => {
        setIsLoading(true);
        setError(null);

        try {
            const contract = getNFTContract(signer);
            console.log('🔥 Merging cards:', tokenIds);

            const tx = await contract.mergeCards(tokenIds);
            const receipt = await tx.wait();

            // Parse CardsMerged event to get new token ID
            let newTokenId: number | undefined;
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    if (parsed?.name === 'CardsMerged') {
                        newTokenId = Number(parsed.args.newTokenId);
                        console.log('   New token ID:', newTokenId);
                        break;
                    }
                } catch { }
            }

            // Clear cache for merged cards and invalidate user's card list
            tokenIds.forEach(id => blockchainCache.invalidate(CacheKeys.cardMetadata(id)));
            const signerAddress = await signer.getAddress();
            blockchainCache.invalidatePrefix(`nft:owned:${signerAddress}`);
            blockchainCache.invalidatePrefix(`nft:cards:${signerAddress}`);

            return { success: true, newTokenId };
        } catch (e: any) {
            const msg = e.reason || e.message || 'Merge failed';
            console.error('❌ Merge error:', msg);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check if token is locked
    const isLocked = useCallback(async (tokenId: number): Promise<boolean> => {
        try {
            const contract = getNFTContract();
            return await contract.isLocked(tokenId);
        } catch {
            return false;
        }
    }, []);

    // Clear all NFT-related cache
    const clearCache = useCallback(() => {
        blockchainCache.invalidatePrefix('nft:');
    }, []);

    return {
        isLoading,
        error,
        getOwnedTokens,
        getCardInfo,
        getCards,
        mergeCards,
        isLocked,
        clearCache,
    };
}
