// Network configuration — MegaETH only

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
    metadataBase: string;
    packPrice: bigint;
    icon: string;
    deployed: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
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
        apiBase: '/api',
        metadataBase: '/metadata',
        packPrice: BigInt('10000000000000000'),    // 0.01 ETH
        icon: '',
        deployed: true,
    },
};

let _activeId: string = 'megaeth';
if (typeof localStorage !== 'undefined') localStorage.setItem('unicornx:network', _activeId);

export function getActiveNetwork(): NetworkConfig {
    return NETWORKS.megaeth;
}

export function setActiveNetwork(id: string) {
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
    return [NETWORKS.megaeth];
}

/** Short currency symbol for the active network */
export function currencySymbol(): string {
    return getActiveNetwork().nativeCurrency.symbol;
}
