// Centralized blockchain error parser
// Converts raw RPC/contract errors into user-friendly messages

export interface ParsedError {
    message: string;
    details?: string; // raw error for "Show log"
}

export function parseTransactionError(err: any): ParsedError {
    const raw = extractRawMessage(err);

    // User rejected in wallet
    if (matches(raw, 'user rejected', 'user denied', 'ACTION_REJECTED', 'User rejected the request')) {
        return { message: 'Transaction cancelled' };
    }

    // Insufficient funds
    if (matches(raw, 'insufficient funds', 'not enough balance', 'exceeds balance')) {
        return { message: 'Not enough ETH in your wallet', details: raw };
    }

    // Gas estimation failed (generic revert)
    if (matches(raw, 'CALL_EXCEPTION', 'missing revert data', 'execution reverted')) {
        const reason = extractRevertReason(raw);
        if (reason) return { message: reason, details: raw };
        return { message: 'Transaction would fail. The contract rejected this action.', details: raw };
    }

    // Nonce issues
    if (matches(raw, 'nonce too', 'NONCE_EXPIRED', 'replacement transaction underpriced')) {
        return { message: 'Transaction conflict. Please try again.', details: raw };
    }

    // Network / RPC errors
    if (matches(raw, 'network error', 'failed to fetch', 'ETIMEDOUT', 'ECONNREFUSED', 'could not detect network', 'SERVER_ERROR')) {
        return { message: 'Network error. Check your connection and try again.', details: raw };
    }

    // Unpredictable gas limit (often means the tx will revert)
    if (matches(raw, 'UNPREDICTABLE_GAS_LIMIT', 'cannot estimate gas')) {
        return { message: 'Transaction would fail. Please check your inputs.', details: raw };
    }

    // Contract-specific errors
    if (matches(raw, 'NotCardOwner')) return { message: 'You do not own this card', details: raw };
    if (matches(raw, 'CardIsLocked')) return { message: 'Card is locked in a tournament', details: raw };
    if (matches(raw, 'CannotMergeLegendary')) return { message: 'Legendary cards cannot be merged', details: raw };
    if (matches(raw, 'RarityMismatch', '0x7c0aec15')) return { message: 'Cards have different rarities. Try refreshing your cards.', details: raw };
    if (matches(raw, 'BidTooLow', '0xa0d26eb6')) return { message: 'Bid too low', details: raw };
    if (matches(raw, 'AuctionHasBids')) return { message: 'Cannot cancel — auction already has bids', details: raw };
    if (matches(raw, 'TournamentNotActive', 'TournamentNotOpen')) return { message: 'Tournament is not active', details: raw };
    if (matches(raw, 'AlreadyEntered')) return { message: 'You already entered this tournament', details: raw };
    if (matches(raw, 'ListingNotActive')) return { message: 'This listing is no longer active', details: raw };
    if (matches(raw, 'InsufficientPayment')) return { message: 'Payment amount is not enough', details: raw };
    if (matches(raw, 'Paused', 'EnforcedPause')) return { message: 'Contract is paused. Try again later.', details: raw };

    // Fallback — unknown error
    return { message: 'Something went wrong. Please try again.', details: raw };
}

function matches(text: string, ...patterns: string[]): boolean {
    const lower = text.toLowerCase();
    return patterns.some(p => lower.includes(p.toLowerCase()));
}

function extractRawMessage(err: any): string {
    if (!err) return '';
    if (typeof err === 'string') return err;

    // ethers.js v6 error structure
    const msg = err.shortMessage || err.reason || err.message || '';

    // MetaMask nested data
    const nested = err?.data?.message || err?.error?.message || err?.info?.error?.message || '';

    // Combine for matching
    return `${msg} ${nested}`.trim();
}

function extractRevertReason(raw: string): string | null {
    // Try to find a human-readable revert reason
    const revertMatch = raw.match(/reverted with reason string ["'](.+?)["']/);
    if (revertMatch) return revertMatch[1];

    const reasonMatch = raw.match(/reason="(.+?)"/);
    if (reasonMatch) return reasonMatch[1];

    return null;
}
