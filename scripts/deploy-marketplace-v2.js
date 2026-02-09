// scripts/deploy-marketplace-v2.js
// Deploy MarketplaceV2 to Etherlink Shadownet

require('dotenv').config({ path: __dirname + '/.env' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load compiled contract
const BUILD_DIR = path.join(__dirname, '..', 'build');
const marketplaceV2 = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, 'MarketplaceV2.json'), 'utf8'));

// Deployment config
const DEPLOYMENT_FILE = path.join(__dirname, '..', 'deployment-shadownet.json');

async function main() {
    console.log('🚀 Deploying MarketplaceV2 to Etherlink Shadownet...\n');

    // Load existing deployment
    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, 'utf8'));
    const nftAddress = deployment.contracts?.FantasyYC_NFT || deployment.FantasyYC_NFT;

    if (!nftAddress) {
        throw new Error('NFT contract address not found in deployment file');
    }

    console.log('📋 Using existing NFT contract:', nftAddress);

    // Setup provider and wallet
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    if (!PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY not found in .env');
    }

    const provider = new ethers.JsonRpcProvider('https://node.shadownet.etherlink.com');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log('👤 Deployer:', wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'XTZ\n');

    // Deploy MarketplaceV2
    console.log('⏳ Deploying MarketplaceV2...');

    const factory = new ethers.ContractFactory(
        marketplaceV2.abi,
        marketplaceV2.bytecode,
        wallet
    );

    const contract = await factory.deploy(nftAddress, wallet.address, {
        gasLimit: 5000000n
    });

    console.log('📝 TX Hash:', contract.deploymentTransaction()?.hash);
    console.log('⏳ Waiting for confirmation...');

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log('✅ MarketplaceV2 deployed at:', address);

    // Save to deployment file
    if (!deployment.contracts) deployment.contracts = {};
    deployment.contracts.MarketplaceV2 = address;
    deployment.lastUpdated = new Date().toISOString();

    fs.writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deployment, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('MarketplaceV2:', address);
    console.log('\n💡 Remember to update frontend contracts.ts with the new address!');
}

main().catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
});
