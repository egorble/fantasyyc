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
        PackNFT: string;
        PackOpener: string;
        TournamentManager: string;
        MarketplaceV2: string;
    };
    apiBase: string;
    metadataBase: string;   // prefix for metadata server routes
    packPrice: bigint;      // default pack price in wei (avoids RPC call on load)
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
            PackNFT: '0xBc587d87D0c170aAbB2a92884ABafda8d4B7328B',
            PackOpener: '0x78b602DE1721FF85C0c07F2Db5CF253c73590BaF',
            TournamentManager: '0xc367886000da37447AC592fc3571ceb63184BF1b',
            MarketplaceV2: '0x5BCf9A613C117dacD5C74199b288CCDdc7f5aa82',
        },
        apiBase: '/api',
        metadataBase: '/metadata',
        packPrice: BigInt('5000000000000000000'),  // 5 XTZ
        icon: '',
        deployed: true,
    },
    megaeth: {
        id: 'megaeth',
        name: 'MegaETH',
        shortName: 'MegaETH',
        chainId: 4326,
        rpcUrl: 'https://mainnet.megaeth.com/rpc',
        explorerUrl: 'https://megaeth.blockscout.com',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        contracts: {
            UnicornX_NFT: '0x45E817D93915D484bac01d27E26d19F30715B6Bc',
            PackNFT: '',  // TODO: deploy PackNFT and set address here
            PackOpener: '0x8146c0f42824566373f146A200DE85c40d561b9e',
            TournamentManager: '0xbccAFD09B909bb2Ca87F10067cBCF10212C562B3',
            MarketplaceV2: '0x04Cd3Ce1639b9b2Ca63dbd9bE6ec3a4B5f4Dd161',
        },
        apiBase: '/api-mega',
        metadataBase: '/metadata-mega',
        packPrice: BigInt('10000000000000000'),    // 0.01 ETH
        icon: '',
        deployed: true,
    },
};

// Hash aliases: #mega → megaeth, #etherlink → etherlink
const HASH_MAP: Record<string, string> = { mega: 'megaeth', megaeth: 'megaeth', etherlink: 'etherlink' };

function resolveInitialNetwork(): string {
    // Locked to Etherlink only — MegaETH switching disabled
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
    // Locked to Etherlink only — ignore any other network
    if (id !== 'etherlink') return;
    if (!NETWORKS[id]) return;
    _activeId = id;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('unicornx:network', id);
    }
}

export function getActiveNetworkId(): string {
    return _activeId;
}

export function getAllNetworks(): NetworkConfig[] {
    // Return only Etherlink — MegaETH hidden
    return [NETWORKS.etherlink];
}

/** Short currency symbol for the active network (e.g. "XTZ" or "ETH") */
export function currencySymbol(): string {
    return getActiveNetwork().nativeCurrency.symbol;
}
