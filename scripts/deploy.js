// scripts/deploy.js
// Deployment script for UnicornX Smart Contracts on Etherlink using ethers.js

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Network configurations
const NETWORKS = {
    shadownet: {
        name: "Etherlink Shadownet Testnet",
        chainId: 127823,
        rpc: "https://node.shadownet.etherlink.com",
        explorer: "https://shadownet.explorer.etherlink.com",
        faucet: "https://shadownet.faucet.etherlink.com/"
    },
    mainnet: {
        name: "Etherlink Mainnet",
        chainId: 42793,
        rpc: "https://node.mainnet.etherlink.com",
        explorer: "https://explorer.etherlink.com"
    }
};

async function main() {
    // Get network from command line
    const networkArg = process.argv[2] || "shadownet";
    const network = NETWORKS[networkArg];

    if (!network) {
        console.error(`❌ Unknown network: ${networkArg}`);
        console.error(`   Available networks: ${Object.keys(NETWORKS).join(", ")}`);
        process.exit(1);
    }

    console.log('🚀 Deploying UnicornX Smart Contracts to Etherlink Shadownet...\n');
    console.log(`📍 Network: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   RPC: ${network.rpc}`);
    console.log("");

    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ PRIVATE_KEY environment variable not set!");
        console.error("   Usage: PRIVATE_KEY=0x... node scripts/deploy.js shadownet");
        process.exit(1);
    }

    // Initialize Provider and Wallet
    const provider = new ethers.JsonRpcProvider(network.rpc);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`👤 Deployer: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} XTZ`);
    console.log("");

    // Load compiled contracts
    const buildDir = path.join(__dirname, "..", "build");

    const UnicornX_NFT = JSON.parse(
        fs.readFileSync(path.join(buildDir, "UnicornX_NFT.json"), "utf8")
    );
    const PackOpener = JSON.parse(
        fs.readFileSync(path.join(buildDir, "PackOpener.json"), "utf8")
    );
    const TournamentManager = JSON.parse(
        fs.readFileSync(path.join(buildDir, "TournamentManager.json"), "utf8")
    );
    const MarketplaceV2 = JSON.parse(
        fs.readFileSync(path.join(buildDir, "MarketplaceV2.json"), "utf8")
    );

    // Check if build artifacts exist
    if (!UnicornX_NFT || !PackOpener || !TournamentManager || !MarketplaceV2) {
        console.error("❌ Build artifacts not found! Run 'node scripts/compile.js' first.");
        process.exit(1);
    }

    // Config (Hardcoded for now, can be moved to a config file)
    const TREASURY_ADDRESS = "0x233c8C54F25734B744E522bdC1Eed9cbc8C97D0c";

    console.log("⚙️  Configuration:");
    console.log("   Treasury:", TREASURY_ADDRESS);
    console.log("");

    // ============ Step 1: Deploy UnicornX_NFT ============
    console.log('⏳ Deploying 1/4: UnicornX_NFT...');

    const nftFactory = new ethers.ContractFactory(
        UnicornX_NFT.abi,
        UnicornX_NFT.bytecode,
        wallet
    );

    const nftContract = await nftFactory.deploy(wallet.address);
    console.log('📝 TX Hash:', nftContract.deploymentTransaction().hash);
    await nftContract.waitForDeployment();

    const nftAddress = await nftContract.getAddress();
    console.log('✅ UnicornX_NFT deployed at:', nftAddress);
    console.log(`   Explorer: ${network.explorer}/address/${nftAddress}`);
    console.log("");

    // ============ Step 2: Deploy TournamentManager ============
    console.log("📦 Step 2: Deploying TournamentManager...");

    const tournamentFactory = new ethers.ContractFactory(
        TournamentManager.abi,
        TournamentManager.bytecode,
        wallet
    );

    // Constructor: address _nftContract
    const tournamentContract = await tournamentFactory.deploy(nftAddress);
    await tournamentContract.waitForDeployment();

    const tournamentAddress = await tournamentContract.getAddress();
    console.log("✅ TournamentManager deployed to:", tournamentAddress);
    console.log("");

    // ============ Step 3: Deploy PackOpener ============
    console.log("📦 Step 3: Deploying PackOpener...");

    const packFactory = new ethers.ContractFactory(
        PackOpener.abi,
        PackOpener.bytecode,
        wallet
    );

    // Constructor: address _nftContract, address _treasury, address initialOwner
    const packContract = await packFactory.deploy(nftAddress, TREASURY_ADDRESS, wallet.address);
    await packContract.waitForDeployment();

    const packAddress = await packContract.getAddress();
    console.log("✅ PackOpener deployed to:", packAddress);
    console.log("");

    // ============ Step 4: Configuration ============
    console.log("🛠️ Step 4: Configuring Contracts...");

    // 1. Set PackOpener as authorized minter (BEFORE transferring ownership!)
    console.log("   Setting PackOpener as authorized minter...");
    const tx1 = await nftContract.setAuthorizedMinter(packAddress, true);
    await tx1.wait();
    console.log("   ✅ PackOpener is now authorized minter");

    // 2. Set TournamentManager as authorized locker
    console.log("   Setting TournamentManager as authorized locker...");
    const tx2 = await nftContract.setAuthorizedLocker(tournamentAddress, true);
    await tx2.wait();
    console.log("   ✅ TournamentManager is now authorized locker");

    // 3. Set TournamentManager reference in PackOpener for prize pool distribution
    console.log("   Setting TournamentManager in PackOpener...");
    const tx3 = await packContract.setTournamentManager(tournamentAddress);
    await tx3.wait();
    console.log("   ✅ TournamentManager set in PackOpener");

    // 4. Set PackOpener reference in TournamentManager
    console.log("   Setting PackOpener in TournamentManager...");
    const tx4 = await tournamentContract.setPackOpener(packAddress);
    await tx4.wait();
    console.log("   ✅ PackOpener set in TournamentManager");

    console.log("   ⚠️ NFT ownership kept with Deployer for flexibility");

    // ============ Step 5: Deploy MarketplaceV2 ============
    console.log("");
    console.log("📦 Step 5: Deploying MarketplaceV2...");

    const marketplaceFactory = new ethers.ContractFactory(
        MarketplaceV2.abi,
        MarketplaceV2.bytecode,
        wallet
    );

    // Constructor: address _nftContract, address _feeRecipient
    const marketplaceContract = await marketplaceFactory.deploy(nftAddress, TREASURY_ADDRESS);
    await marketplaceContract.waitForDeployment();

    const marketplaceAddress = await marketplaceContract.getAddress();
    console.log("✅ MarketplaceV2 deployed at:", marketplaceAddress);

    // ============ Summary ============
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("📋 Contract Addresses:");
    console.log('   UnicornX_NFT:       ', nftAddress);
    console.log("   PackOpener:         ", packAddress);
    console.log("   TournamentManager:  ", tournamentAddress);
    console.log("   MarketplaceV2:      ", marketplaceAddress);
    console.log("");

    // Save deployment info
    const deploymentInfo = {
        network: networkArg,
        networkName: network.name,
        chainId: network.chainId,
        explorer: network.explorer,
        timestamp: new Date().toISOString(),
        deployer: wallet.address,
        contracts: {
            UnicornX_NFT: nftAddress,
            PackOpener: packAddress,
            TournamentManager: tournamentAddress,
            MarketplaceV2: marketplaceAddress
        },
        configuration: {
            owner: wallet.address,
            treasury: TREASURY_ADDRESS
        }
    };

    const deploymentFile = path.join(__dirname, "..", `deployment-${networkArg}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📁 Deployment info saved to: deployment - ${networkArg}.json`);
    console.log("");

    console.log("📝 Next Steps:");
    console.log("   1. Update baseURI with your IPFS metadata CID");
    console.log("   2. Run scripts/deploy-marketplace-v2.js to deploy the marketplace");
    console.log("   3. Test pack purchase on testnet");
    console.log("   4. Create and test a tournament");
    console.log("");

    return deploymentInfo;
}

// Run deployment
main()
    .then(() => {
        console.log("✅ Deployment script completed successfully");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
