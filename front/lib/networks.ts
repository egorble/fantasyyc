// Multi-chain network registry
// To revert to Etherlink only: delete this file and remove imports

export interface NetworkConfig {
    id: string;
    name: string;
    shortName: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    contracts: {
        UnicornX_NFT: string;
        PackOpener: string;
        TournamentManager: string;
        MarketplaceV2: string;
    };
    apiBase: string;
    metadataBase: string;   // prefix for metadata server routes
    icon: string;
    deployed: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
    etherlink: {
        id: 'etherlink',
        name: 'Etherlink Shadownet Testnet',
        shortName: 'Etherlink',
        chainId: 127823,
        rpcUrl: 'https://node.shadownet.etherlink.com',
        explorerUrl: 'https://shadownet.explorer.etherlink.com',
        nativeCurrency: { name: 'XTZ', symbol: 'XTZ', decimals: 18 },
        contracts: {
            UnicornX_NFT: '0x172aC7aa7a6774559b1588E2F4426F7303a97cf1',
            PackOpener: '0x78b602DE1721FF85C0c07F2Db5CF253c73590BaF',
            TournamentManager: '0xc367886000da37447AC592fc3571ceb63184BF1b',
            MarketplaceV2: '0x5BCf9A613C117dacD5C74199b288CCDdc7f5aa82',
        },
        apiBase: '/api',
        metadataBase: '/metadata',
        icon: '',
        deployed: true,
    },
    megaeth: {
        id: 'megaeth',
        name: 'MegaETH Testnet',
        shortName: 'MegaETH',
        chainId: 6343,
        rpcUrl: 'https://carrot.megaeth.com/rpc',
        explorerUrl: 'https://megaeth-testnet-v2.blockscout.com',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        contracts: {
            UnicornX_NFT: '0x45E817D93915D484bac01d27E26d19F30715B6Bc',
            PackOpener: '0x8146c0f42824566373f146A200DE85c40d561b9e',
            TournamentManager: '0xbccAFD09B909bb2Ca87F10067cBCF10212C562B3',
            MarketplaceV2: '0x04Cd3Ce1639b9b2Ca63dbd9bE6ec3a4B5f4Dd161',
        },
        apiBase: '/api-mega',
        metadataBase: '/metadata-mega',
        icon: '',
        deployed: true,
    },
};

// Hash aliases: #mega → megaeth, #etherlink → etherlink
const HASH_MAP: Record<string, string> = { mega: 'megaeth', megaeth: 'megaeth', etherlink: 'etherlink' };

function resolveInitialNetwork(): string {
    // Priority: URL hash > localStorage > default
    if (typeof window !== 'undefined' && window.location.hash) {
        const h = window.location.hash.slice(1).toLowerCase();
        if (HASH_MAP[h]) return HASH_MAP[h];
    }
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('unicornx:network');
        if (saved && NETWORKS[saved]) return saved;
    }
    return 'etherlink';
}

// Module-level active network state
let _activeId: string = resolveInitialNetwork();
// Sync localStorage with resolved network (hash may have overridden it)
if (typeof localStorage !== 'undefined') localStorage.setItem('unicornx:network', _activeId);

export function getActiveNetwork(): NetworkConfig {
    return NETWORKS[_activeId] || NETWORKS.etherlink;
}

// Reverse map: network id → short hash slug
const ID_TO_HASH: Record<string, string> = { megaeth: 'mega', etherlink: 'etherlink' };

export function setActiveNetwork(id: string) {
    if (!NETWORKS[id]) return;
    _activeId = id;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('unicornx:network', id);
    }
    if (typeof window !== 'undefined') {
        const slug = ID_TO_HASH[id] || id;
        history.replaceState(null, '', `#${slug}`);
    }
}

export function getActiveNetworkId(): string {
    return _activeId;
}

export function getAllNetworks(): NetworkConfig[] {
    return Object.values(NETWORKS);
}

/** Short currency symbol for the active network (e.g. "XTZ" or "ETH") */
export function currencySymbol(): string {
    return getActiveNetwork().nativeCurrency.symbol;
}
