const { ethers } = require('ethers');
require('dotenv').config();
const fs = require('fs');

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = 'https://node.shadownet.etherlink.com';

async function main() {
    console.log('🚀 Deploying MarketplaceV2...\n');

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('Deployer:', wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'XTZ\n');

    // Load deployment info to get NFT address
    const deploymentPath = './deployment-shadownet.json';
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const nftAddress = deployment.contracts.UnicornX_NFT;

    console.log('NFT Contract Address:', nftAddress);

    // Load compiled MarketplaceV2
    const MarketplaceV2 = JSON.parse(fs.readFileSync('./build/MarketplaceV2.json'));

    console.log('\n📝 Deploying MarketplaceV2...');
    const MarketplaceV2Factory = new ethers.ContractFactory(
        MarketplaceV2.abi,
        MarketplaceV2.bytecode,
        wallet
    );

    const marketplace = await MarketplaceV2Factory.deploy(
        nftAddress,
        wallet.address,
        { gasLimit: 5000000n }
    );
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();

    console.log('✅ MarketplaceV2 deployed:', marketplaceAddress);

    // Update deployment file
    deployment.contracts.MarketplaceV2 = marketplaceAddress;
    deployment.timestamp = new Date().toISOString();

    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('═══════════════════════════════════════════════');
    console.log('\nMarketplaceV2:', marketplaceAddress);
    console.log('\n✅ deployment-shadownet.json updated');
    console.log('\n⚠️  IMPORTANT: Update front/lib/contracts.ts with the new address!');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
