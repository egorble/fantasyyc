// scripts/deploy.js
// Deployment script for Fantasy YC Smart Contracts on Etherlink using ethers.js

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

    console.log("🚀 Starting Fantasy YC deployment...\n");
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

    // Load compiled contracts
    const buildDir = path.join(__dirname, "..", "build");

    const FantasyYC_NFT = JSON.parse(
        fs.readFileSync(path.join(buildDir, "FantasyYC_NFT.json"), "utf8")
    );
    const PackOpener = JSON.parse(
        fs.readFileSync(path.join(buildDir, "PackOpener.json"), "utf8")
    );
    const TournamentManager = JSON.parse(
        fs.readFileSync(path.join(buildDir, "TournamentManager.json"), "utf8")
    );

    console.log("📦 Loaded compiled contracts from build/\n");

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(network.rpc, {
        chainId: network.chainId,
        name: network.name
    });

    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("📍 Deployer address:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Deployer balance:", ethers.formatEther(balance), "XTZ\n");

    if (balance === 0n) {
        console.error("❌ Deployer has no XTZ!");
        if (network.faucet) {
            console.error(`   Get testnet XTZ from: ${network.faucet}`);
        }
        process.exit(1);
    }

    // Configuration
    const TREASURY_ADDRESS = wallet.address; // Change to your treasury
    const OWNER_ADDRESS = wallet.address;    // Change to your owner

    console.log("⚙️  Configuration:");
    console.log("   Owner:", OWNER_ADDRESS);
    console.log("   Treasury:", TREASURY_ADDRESS);
    console.log("");

    // ============ Step 1: Deploy FantasyYC_NFT ============
    console.log("📦 Step 1: Deploying FantasyYC_NFT...");

    const nftFactory = new ethers.ContractFactory(
        FantasyYC_NFT.abi,
        FantasyYC_NFT.bytecode,
        wallet
    );

    const nftContract = await nftFactory.deploy(OWNER_ADDRESS);
    await nftContract.waitForDeployment();

    const nftAddress = await nftContract.getAddress();
    console.log("✅ FantasyYC_NFT deployed to:", nftAddress);
    console.log(`   Explorer: ${network.explorer}/address/${nftAddress}`);
    console.log("");

    // ============ Step 2: Deploy PackOpener ============
    console.log("📦 Step 2: Deploying PackOpener...");

    const packFactory = new ethers.ContractFactory(
        PackOpener.abi,
        PackOpener.bytecode,
        wallet
    );

    const packOpener = await packFactory.deploy(
        nftAddress,
        TREASURY_ADDRESS,
        OWNER_ADDRESS
    );
    await packOpener.waitForDeployment();

    const packAddress = await packOpener.getAddress();
    console.log("✅ PackOpener deployed to:", packAddress);
    console.log(`   Explorer: ${network.explorer}/address/${packAddress}`);
    console.log("");

    // ============ Step 3: Deploy TournamentManager ============
    console.log("📦 Step 3: Deploying TournamentManager...");

    const tournamentFactory = new ethers.ContractFactory(
        TournamentManager.abi,
        TournamentManager.bytecode,
        wallet
    );

    const tournamentManager = await tournamentFactory.deploy(
        nftAddress,
        OWNER_ADDRESS
    );
    await tournamentManager.waitForDeployment();

    const tournamentAddress = await tournamentManager.getAddress();
    console.log("✅ TournamentManager deployed to:", tournamentAddress);
    console.log(`   Explorer: ${network.explorer}/address/${tournamentAddress}`);
    console.log("");

    // ============ Step 4: Authorize PackOpener as Minter ============
    console.log("🔐 Step 4: Authorizing PackOpener as minter...");

    const authMinterTx = await nftContract.setAuthorizedMinter(packAddress, true);
    await authMinterTx.wait();
    console.log("✅ PackOpener authorized as minter");
    console.log("");

    // ============ Step 5: Authorize TournamentManager as Locker ============
    console.log("🔐 Step 5: Authorizing TournamentManager as locker...");

    const authLockerTx = await nftContract.setAuthorizedLocker(tournamentAddress, true);
    await authLockerTx.wait();
    console.log("✅ TournamentManager authorized as locker");
    console.log("");

    // ============ Step 6: Link PackOpener to TournamentManager ============
    console.log("🔗 Step 6: Linking PackOpener to TournamentManager...");

    const setTmTx = await packOpener.setTournamentManager(tournamentAddress);
    await setTmTx.wait();
    console.log("✅ PackOpener → TournamentManager linked");
    console.log("");

    // ============ Step 7: Link TournamentManager to PackOpener ============
    console.log("🔗 Step 7: Linking TournamentManager to PackOpener...");

    const setPoTx = await tournamentManager.setPackOpener(packAddress);
    await setPoTx.wait();
    console.log("✅ TournamentManager → PackOpener linked");
    console.log("");

    // ============ Deployment Summary ============
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("📋 Contract Addresses:");
    console.log("   FantasyYC_NFT:      ", nftAddress);
    console.log("   PackOpener:         ", packAddress);
    console.log("   TournamentManager:  ", tournamentAddress);
    console.log("");
    console.log("📋 Network:");
    console.log("   Name:               ", network.name);
    console.log("   Chain ID:           ", network.chainId);
    console.log("   Explorer:           ", network.explorer);
    console.log("");
    console.log("📋 Configuration:");
    console.log("   Owner:              ", OWNER_ADDRESS);
    console.log("   Treasury:           ", TREASURY_ADDRESS);
    console.log("   Pack Price:         ", "5 XTZ");
    console.log("   Max Supply:         ", "10,000 NFTs");
    console.log("");
    console.log("🔒 Authorizations:");
    console.log("   PackOpener → can mint NFTs");
    console.log("   TournamentManager → can freeze/unfreeze NFTs for tournaments");
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
            FantasyYC_NFT: nftAddress,
            PackOpener: packAddress,
            TournamentManager: tournamentAddress
        },
        configuration: {
            owner: OWNER_ADDRESS,
            treasury: TREASURY_ADDRESS
        }
    };

    const deploymentFile = path.join(__dirname, "..", `deployment-${networkArg}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`📁 Deployment info saved to: deployment-${networkArg}.json`);
    console.log("");

    console.log("📝 Next Steps:");
    console.log("   1. Update baseURI with your IPFS metadata CID");
    console.log("   2. Test pack purchase on testnet");
    console.log("   3. Create and test a tournament");
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
