// Dynamic API base URL helper for multi-chain support
// To revert to Etherlink only: delete this file, replace apiUrl('/path') with '/api/path'

import { getActiveNetwork } from './networks';

/**
 * Returns the full API URL for a given path based on the active network.
 * Usage: fetch(apiUrl('/tournaments/active'))
 * Etherlink: /api/tournaments/active
 * MegaETH:   /api-mega/tournaments/active
 */
export function apiUrl(path: string): string {
    return `${getActiveNetwork().apiBase}${path}`;
}

/**
 * Returns the full metadata URL for a token based on the active network.
 * Usage: fetch(metadataUrl(`/${tokenId}`))
 * Etherlink: /metadata/1
 * MegaETH:   /metadata-mega/1
 */
export function metadataUrl(path: string): string {
    return `${getActiveNetwork().metadataBase}${path}`;
}
