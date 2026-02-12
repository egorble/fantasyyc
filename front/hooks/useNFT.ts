// NFT contract hook with metadata fetching
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getNFTContract, METADATA_API, STARTUPS } from '../lib/contracts';
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

// Fetch items in batches (used as fallback when batch endpoint fails)
async function fetchInBatches<T>(
    items: number[],
    fn: (id: number) => Promise<T>,
    batchSize = 5,
    delayMs = 200
): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(fn));
        results.push(...batchResults);
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
    return results;
}

// Deduplication for in-flight batch requests — prevents duplicate fetches from React re-renders
let pendingBatchRequest: Promise<Record<number, any>> | null = null;
let pendingBatchIds: string = '';

// Parse single token metadata response into CardData
function parseMetadataResponse(tokenId: number, data: any): CardData {
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

    return {
        tokenId,
        startupId,
        name: getAttribute('Startup') || data.name?.split(' #')[0] || 'Unknown',
        rarity: RARITY_STRING_MAP[rarityStr] || Rarity.COMMON,
        multiplier: parseInt(multiplierStr) || 1,
        isLocked,
        image: `/images/${startupId}.png`,
        edition,
        fundraising: data.fundraising || null,
        description: data.description || null,
    };
}

export function useNFT() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch metadata from backend API with caching + request deduplication
    // Uses getOrFetch() so concurrent callers for the same tokenId share one request
    const fetchMetadata = useCallback(async (tokenId: number): Promise<CardData | null> => {
        const key = CacheKeys.cardMetadata(tokenId);

        const result = await blockchainCache.getOrFetch(key, async () => {
            try {
                const response = await fetch(`${METADATA_API}/metadata/${tokenId}`);
                if (!response.ok) return null;
                const data = await response.json();
                return parseMetadataResponse(tokenId, data);
            } catch (e) {
                console.error(`Error fetching metadata for token ${tokenId}:`, e);
                return null;
            }
        }, CacheTTL.LONG);

        if (result === null) {
            blockchainCache.invalidate(key);
        }
        return result;
    }, []);

    // Batch fetch: single request for all tokens, populates individual cache entries
    // Uses module-level dedup to prevent duplicate requests from React re-renders
    const fetchMetadataBatch = useCallback(async (tokenIds: number[]): Promise<(CardData | null)[]> => {
        if (tokenIds.length === 0) return [];

        // Check cache first — only fetch uncached tokens
        const results: (CardData | null)[] = new Array(tokenIds.length).fill(null);
        const uncachedIndices: number[] = [];

        for (let i = 0; i < tokenIds.length; i++) {
            const cached = blockchainCache.get<CardData>(CacheKeys.cardMetadata(tokenIds[i]));
            if (cached !== undefined) {
                results[i] = cached;
            } else {
                uncachedIndices.push(i);
            }
        }

        if (uncachedIndices.length === 0) {
            console.log('   All', tokenIds.length, 'cards served from cache');
            return results;
        }

        const uncachedIds = uncachedIndices.map(i => tokenIds[i]);
        const batchKey = uncachedIds.sort((a, b) => a - b).join(',');

        try {
            let batchData: Record<string, any>;

            // Dedup: if identical batch is already in-flight, reuse it
            if (pendingBatchRequest && pendingBatchIds === batchKey) {
                console.log('   Dedup: reusing in-flight batch request');
                batchData = await pendingBatchRequest;
            } else {
                console.log('   Batch fetching', uncachedIds.length, 'tokens (', tokenIds.length - uncachedIds.length, 'cached)');
                const request = fetch(`${METADATA_API}/metadata/batch?tokenIds=${uncachedIds.join(',')}`)
                    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
                pendingBatchIds = batchKey;
                pendingBatchRequest = request;
                batchData = await request;
                pendingBatchRequest = null;
                pendingBatchIds = '';
            }

            const { tokens, errors } = batchData;

            for (const idx of uncachedIndices) {
                const tid = tokenIds[idx];
                const tokenMeta = tokens[tid];
                if (tokenMeta) {
                    const card = parseMetadataResponse(tid, tokenMeta);
                    results[idx] = card;
                    blockchainCache.set(CacheKeys.cardMetadata(tid), card);
                } else if (errors?.[tid]) {
                    console.warn(`   Token ${tid}: ${errors[tid]}`);
                }
            }

            return results;
        } catch (e) {
            pendingBatchRequest = null;
            pendingBatchIds = '';
            console.warn('Batch fetch failed, falling back to individual requests:', e);
            const fallbackCards = await fetchInBatches(uncachedIds, fetchMetadata, 5, 200);
            for (let fi = 0; fi < uncachedIndices.length; fi++) {
                results[uncachedIndices[fi]] = fallbackCards[fi];
            }
            return results;
        }
    }, [fetchMetadata]);

    // Get all tokens owned by address - with caching and polling
    const getOwnedTokens = useCallback(async (address: string): Promise<number[]> => {
        const key = CacheKeys.ownedTokens(address);

        // Check cache first
        const cached = blockchainCache.get<number[]>(key);
        if (cached !== undefined) {
            // Subscribe for updates if not already done (will handle polling)
            // We don't need a persistent subscription here as the hook consumer
            // should use usePollingData for that. This just ensures fresh data if stale
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

    // Fallback: read card info directly from the smart contract when metadata server is down
    const fetchCardFromContract = useCallback(async (tokenId: number): Promise<CardData | null> => {
        try {
            const contract = getNFTContract();
            const info = await contract.getCardInfo(tokenId);
            const startupId = Number(info.startupId);
            const startup = STARTUPS[startupId];
            if (!startup) return null;

            const rarityEnum = Number(info.rarity);
            const rarity = [Rarity.COMMON, Rarity.RARE, Rarity.EPIC, Rarity.EPIC_RARE, Rarity.LEGENDARY][rarityEnum] || Rarity.COMMON;

            return {
                tokenId,
                startupId,
                name: startup.name,
                rarity,
                multiplier: Number(info.multiplier),
                isLocked: info.isLocked,
                image: `/images/${startupId}.png`,
                edition: Number(info.edition),
                fundraising: null,
                description: null,
            };
        } catch (e) {
            console.error(`Contract fallback failed for token ${tokenId}:`, e);
            return null;
        }
    }, []);

    // Get card info with retries + contract fallback (for merge results where metadata may be delayed)
    const getCardInfoWithRetry = useCallback(async (tokenId: number, retries = 3, delayMs = 2000): Promise<CardData | null> => {
        for (let i = 0; i < retries; i++) {
            const card = await fetchMetadata(tokenId);
            if (card) return card;
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, delayMs));
            }
        }
        // All retries failed — fall back to contract data
        console.log(`⚡ Metadata unavailable for token ${tokenId}, reading from contract`);
        return fetchCardFromContract(tokenId);
    }, [fetchMetadata, fetchCardFromContract]);

    // Get card info for a token (from API with proper metadata)
    const getCardInfo = useCallback(async (tokenId: number): Promise<CardData | null> => {
        return await fetchMetadata(tokenId);
    }, [fetchMetadata]);

    // Get all cards for an address — uses batch endpoint for speed
    const getCards = useCallback(async (address: string): Promise<CardData[]> => {
        setIsLoading(true);
        setError(null);

        try {
            const tokenIds = await getOwnedTokens(address);
            console.log('📋 Fetching cards for', address, '- found', tokenIds.length, 'tokens');

            // Single batch request for all tokens (fallback to individual inside fetchMetadataBatch)
            const cards = await fetchMetadataBatch(tokenIds);

            // For tokens where metadata failed, fall back to contract data
            const nullIndices = cards.map((c, i) => c === null ? i : -1).filter(i => i >= 0);
            if (nullIndices.length > 0) {
                console.log(`⚡ ${nullIndices.length} cards missing metadata, falling back to contract`);
                const fallbacks = await fetchInBatches(
                    nullIndices.map(i => tokenIds[i]),
                    fetchCardFromContract, 5, 100
                );
                fallbacks.forEach((card, fi) => {
                    if (card) cards[nullIndices[fi]] = card;
                });
            }

            // Filter out nulls
            const validCards = cards.filter((c): c is CardData => c !== null);

            // Verify isLocked from contract in batches (metadata cache may be stale)
            const contract = getNFTContract();
            const checkLock = async (idx: number) => {
                const card = validCards[idx];
                try {
                    const locked = await contract.isLocked(card.tokenId);
                    if (card.isLocked !== locked) {
                        card.isLocked = locked;
                        blockchainCache.set(CacheKeys.cardMetadata(card.tokenId), { ...card });
                    }
                } catch {}
                return idx;
            };
            const indices = validCards.map((_, i) => i);
            await fetchInBatches(indices, checkLock, 5, 100);

            console.log('   Loaded', validCards.length, 'cards');

            return validCards;
        } catch (e: any) {
            setError(e.message);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [getOwnedTokens, fetchMetadataBatch, fetchCardFromContract]);

    // Rarity names for logging
    const RARITY_NAMES = ['Common', 'Rare', 'Epic', 'EpicRare', 'Legendary'];

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

            // Pre-merge on-chain rarity verification to prevent RarityMismatch errors
            // The cached/metadata rarity might not match on-chain state after upgrades
            try {
                const readContract = getNFTContract(); // read-only provider
                const cardInfos = await Promise.all(
                    tokenIds.map(id => readContract.getCardInfo(id))
                );
                const onChainRarities = cardInfos.map(info => Number(info.rarity));
                console.log('   On-chain rarities:', onChainRarities.map(r => RARITY_NAMES[r] || `Unknown(${r})`));

                // Check all cards have the same on-chain rarity
                if (onChainRarities[0] !== onChainRarities[1] || onChainRarities[0] !== onChainRarities[2]) {
                    const details = tokenIds.map((id, i) =>
                        `Token #${id}: ${RARITY_NAMES[onChainRarities[i]] || 'Unknown'}`
                    ).join(', ');
                    const errorMsg = `On-chain rarity mismatch! ${details}. The contract startups data may need re-initialization.`;
                    console.error('❌', errorMsg);
                    setError(errorMsg);
                    return { success: false, error: errorMsg };
                }

                // Also check that multipliers are not all 0 (indicates startups mapping is uninitialized)
                const allMultipliersZero = cardInfos.every(info => Number(info.multiplier) === 0);
                if (allMultipliersZero) {
                    const errorMsg = 'Contract startup data appears uninitialized (all multipliers are 0). Admin must call reinitializeStartups().';
                    console.error('❌', errorMsg);
                    setError(errorMsg);
                    return { success: false, error: errorMsg };
                }
            } catch (verifyError: any) {
                console.warn('⚠️ Pre-merge verification failed, proceeding anyway:', verifyError.message);
            }

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

            // Clear cache for merged (burned) cards and invalidate user's card list
            tokenIds.forEach(id => blockchainCache.invalidate(CacheKeys.cardMetadata(id)));
            // Also invalidate the new card's cache to force fresh fetch
            if (newTokenId) {
                blockchainCache.invalidate(CacheKeys.cardMetadata(newTokenId));
            }
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
        getCardInfoWithRetry,
        getCards,
        mergeCards,
        isLocked,
        clearCache,
    };
}
