// Pack opener contract hook
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getPackOpenerContract, getNFTContract, METADATA_API } from '../lib/contracts';
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

// Fetch metadata from API
async function fetchCardMetadata(tokenId: number): Promise<CardData | null> {
    try {
        const response = await fetch(`${METADATA_API}/metadata/${tokenId}`);
        if (!response.ok) return null;

        const data = await response.json();

        const attributes = data.attributes || [];
        const getAttribute = (traitType: string) => {
            const attr = attributes.find((a: any) => a.trait_type === traitType);
            return attr?.value;
        };

        const rarityStr = getAttribute('Rarity') || 'Common';
        const multiplierStr = getAttribute('Multiplier') || '1x';

        return {
            tokenId,
            startupId: parseInt(getAttribute('Startup ID')) || 1,
            name: getAttribute('Startup') || data.name?.split(' #')[0] || 'Unknown',
            rarity: RARITY_STRING_MAP[rarityStr] || Rarity.COMMON,
            multiplier: parseInt(multiplierStr) || 1,
            isLocked: getAttribute('Locked') === 'Yes',
            image: data.image || '',
            edition: parseInt(getAttribute('Edition')) || 1,
        };
    } catch (e) {
        console.error(`Error fetching metadata for token ${tokenId}:`, e);
        return null;
    }
}

export function usePacks() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get current pack price - cache first, refresh in background
    const getPackPrice = useCallback(async (): Promise<bigint> => {
        const key = CacheKeys.packPrice();

        // Try cache first
        const cached = blockchainCache.get<bigint>(key);
        if (cached !== undefined) {
            // Refresh in background if stale
            if (blockchainCache.isStale(key, CacheTTL.DEFAULT)) {
                blockchainCache.fetchInBackground(key, async () => {
                    const contract = getPackOpenerContract();
                    return await contract.currentPackPrice();
                });
            }
            return cached;
        }

        // Fetch fresh
        return blockchainCache.getOrFetch(key, async () => {
            const contract = getPackOpenerContract();
            return await contract.currentPackPrice();
        }, CacheTTL.DEFAULT);
    }, []);

    // Get packs sold - cache first
    const getPacksSold = useCallback(async (): Promise<number> => {
        const key = CacheKeys.packsSold();

        // Try cache first
        const cached = blockchainCache.get<number>(key);
        if (cached !== undefined) {
            // Refresh in background if stale
            if (blockchainCache.isStale(key, CacheTTL.SHORT)) {
                blockchainCache.fetchInBackground(key, async () => {
                    const contract = getPackOpenerContract();
                    return Number(await contract.packsSold());
                });
            }
            return cached;
        }

        // Fetch fresh
        return blockchainCache.getOrFetch(key, async () => {
            const contract = getPackOpenerContract();
            return Number(await contract.packsSold());
        }, CacheTTL.SHORT);
    }, []);

    // Buy AND Open pack in one transaction - returns 5 cards with metadata
    const buyAndOpenPack = useCallback(async (
        signer: ethers.Signer
    ): Promise<{ success: boolean; cards?: CardData[]; error?: string }> => {
        setIsLoading(true);
        setError(null);

        try {
            const packContract = getPackOpenerContract(signer);
            const nftContract = getNFTContract(signer);
            const price = await packContract.currentPackPrice();

            console.log('📦 Buying and opening pack...');
            console.log('   Price:', ethers.formatEther(price), 'XTZ');
            console.log('   Price (wei):', price.toString());

            // Single transaction: buy and open pack
            // Pass value explicitly to ensure wallet displays it
            const tx = await packContract.buyAndOpenPack({
                value: BigInt(price.toString())
            });
            console.log('   TX sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('   TX confirmed!');

            // Parse CardMinted events to get token IDs
            const tokenIds: number[] = [];
            for (const log of receipt.logs) {
                try {
                    const parsed = nftContract.interface.parseLog(log);
                    if (parsed?.name === 'CardMinted') {
                        tokenIds.push(Number(parsed.args.tokenId));
                    }
                } catch { }
            }

            console.log('   Minted token IDs:', tokenIds);

            // Invalidate cache after purchase
            const signerAddress = await signer.getAddress();
            blockchainCache.invalidate(CacheKeys.packsSold());
            blockchainCache.invalidatePrefix(`nft:owned:${signerAddress}`);
            blockchainCache.invalidatePrefix(`nft:cards:${signerAddress}`);
            blockchainCache.invalidatePrefix(`pack:user:${signerAddress}`);

            // Fetch metadata for each card from the API
            const cards: CardData[] = [];
            for (const tokenId of tokenIds) {
                const card = await fetchCardMetadata(tokenId);
                if (card) {
                    cards.push(card);
                    // Cache the new card metadata
                    blockchainCache.set(CacheKeys.cardMetadata(tokenId), card);
                }
            }

            console.log('   Cards loaded:', cards.length);
            return { success: true, cards };
        } catch (e: any) {
            const msg = e.reason || e.message || 'Failed to buy pack';
            console.error('❌ Buy pack error:', msg);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Get user's unopened packs count
    const getUnopenedPackCount = useCallback(async (address: string): Promise<number> => {
        try {
            const contract = getPackOpenerContract();
            return Number(await contract.getUnopenedPackCount(address));
        } catch {
            return 0;
        }
    }, []);

    // Get user's pack history
    const getUserPacks = useCallback(async (address: string): Promise<number[]> => {
        try {
            const contract = getPackOpenerContract();
            const packs = await contract.getUserPacks(address);
            return packs.map((p: bigint) => Number(p));
        } catch {
            return [];
        }
    }, []);

    return {
        isLoading,
        error,
        getPackPrice,
        getPacksSold,
        buyAndOpenPack,
        getUnopenedPackCount,
        getUserPacks,
    };
}
