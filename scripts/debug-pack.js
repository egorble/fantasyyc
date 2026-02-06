// scripts/debug-pack.js
// Debug script to find why buyAndOpenPack is reverting

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployment-shadownet.json");
const BUILD_DIR = path.join(__dirname, "..", "build");

async function debug() {
    console.log("\n🔍 DEBUGGING PACK OPENER...\n");

    // Load deployment
    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
    const NFT_ADDRESS = deployment.contracts.FantasyYC_NFT;
    const PACK_ADDRESS = deployment.contracts.PackOpener;

    // Load ABIs
    const NFT_ABI = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, "FantasyYC_NFT.json"), "utf8")).abi;
    const PACK_ABI = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, "PackOpener.json"), "utf8")).abi;

    // Setup
    const provider = new ethers.JsonRpcProvider("https://node.shadownet.etherlink.com", {
        chainId: 127823,
        name: "Etherlink Shadownet"
    });

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, wallet);
    const packContract = new ethers.Contract(PACK_ADDRESS, PACK_ABI, wallet);

    console.log("📍 NFT Contract:", NFT_ADDRESS);
    console.log("📍 Pack Opener:", PACK_ADDRESS);
    console.log("👤 Wallet:", wallet.address);
    console.log("");

    // Check 1: Is PackOpener authorized?
    console.log("━━━ CHECK 1: Authorization ━━━");
    const isAuthorized = await nftContract.authorizedMinters(PACK_ADDRESS);
    console.log("PackOpener is authorized minter:", isAuthorized);
    if (!isAuthorized) {
        console.log("❌ PackOpener is NOT authorized to mint! This is the problem.");
        return;
    }

    // Check 2: Pack contract state
    console.log("\n━━━ CHECK 2: Pack Contract State ━━━");
    const packPrice = await packContract.PACK_PRICE();
    console.log("Pack Price:", ethers.formatEther(packPrice), "XTZ");

    const maxPacks = await packContract.MAX_PACKS();
    const packsSold = await packContract.packsSold();
    console.log("Packs Sold:", packsSold.toString(), "/", maxPacks.toString());

    const packsRemaining = await packContract.getPacksRemaining();
    console.log("Packs Remaining:", packsRemaining.toString());

    const isPaused = await packContract.paused();
    console.log("Contract Paused:", isPaused);
    if (isPaused) {
        console.log("❌ Contract is PAUSED! This is the problem.");
        return;
    }

    // Check 3: NFT contract state
    console.log("\n━━━ CHECK 3: NFT Contract State ━━━");
    const totalSupply = await nftContract.totalSupply();
    const maxSupply = await nftContract.MAX_SUPPLY();
    console.log("Total Supply:", totalSupply.toString(), "/", maxSupply.toString());

    // Check 4: Startup data
    console.log("\n━━━ CHECK 4: Startup Data ━━━");
    for (let i = 1; i <= 5; i++) {
        try {
            const startup = await nftContract.getStartupInfo(i);
            console.log(`Startup ${i}: ${startup.name}, Rarity: ${startup.rarity}, Multiplier: ${startup.multiplier}x`);
        } catch (e) {
            console.log(`❌ Startup ${i}: ERROR - ${e.message}`);
        }
    }

    // Check 5: Wallet balance
    console.log("\n━━━ CHECK 5: Wallet Balance ━━━");
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "XTZ");
    if (balance < packPrice) {
        console.log("❌ Insufficient balance to buy pack!");
        return;
    }

    // Check 6: Try static call to see revert reason
    console.log("\n━━━ CHECK 6: Static Call Test ━━━");
    try {
        const result = await packContract.buyAndOpenPack.staticCall({
            value: ethers.parseEther("5"),
            gasLimit: 3000000
        });
        console.log("✅ Static call succeeded! Result:", result);
    } catch (e) {
        console.log("❌ Static call failed!");
        console.log("Error:", e.message);

        // Try to get more details
        if (e.data) {
            console.log("Error data:", e.data);
        }
        if (e.reason) {
            console.log("Reason:", e.reason);
        }
        if (e.revert) {
            console.log("Revert:", e.revert);
        }
    }

    // Check 7: Try calling with explicit gas limit
    console.log("\n━━━ CHECK 7: Estimate Gas ━━━");
    try {
        const gasEstimate = await packContract.buyAndOpenPack.estimateGas({
            value: ethers.parseEther("5")
        });
        console.log("Estimated gas:", gasEstimate.toString());
    } catch (e) {
        console.log("❌ Gas estimation failed:", e.message);
    }

    // Check 8: Check if there's an issue with specific functions
    console.log("\n━━━ CHECK 8: NFT Contract Functions ━━━");
    try {
        const nftAddress = await packContract.nftContract();
        console.log("NFT address in PackOpener:", nftAddress);
        console.log("Expected NFT address:", NFT_ADDRESS);
        console.log("Addresses match:", nftAddress.toLowerCase() === NFT_ADDRESS.toLowerCase());
    } catch (e) {
        console.log("❌ Failed to get nftContract:", e.message);
    }

    console.log("\n━━━ DIAGNOSIS COMPLETE ━━━");
}

debug()
    .then(() => process.exit(0))
    .catch(e => {
        console.error("Debug error:", e);
        process.exit(1);
    });
