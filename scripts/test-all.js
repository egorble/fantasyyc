// scripts/test-all.js
// Comprehensive test script for UnicornX Smart Contracts
// Tests: Pack purchase, card minting, tournaments, locking, metadata

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// ============ Configuration ============

const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployment-shadownet.json");
const BUILD_DIR = path.join(__dirname, "..", "build");

// Load deployment info
let deployment;
try {
    deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
    console.log("✅ Loaded deployment from:", DEPLOYMENT_FILE);
} catch (e) {
    console.error("❌ No deployment file found. Run deploy.js first!");
    process.exit(1);
}

// Contract addresses
const NFT_ADDRESS = deployment.contracts.UnicornX_NFT;
const PACK_OPENER_ADDRESS = deployment.contracts.PackOpener;
const TOURNAMENT_ADDRESS = deployment.contracts.TournamentManager;

// Load ABIs
const NFT_ABI = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, "UnicornX_NFT.json"), "utf8")).abi;
const PACK_ABI = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, "PackOpener.json"), "utf8")).abi;
const TOURNAMENT_ABI = JSON.parse(fs.readFileSync(path.join(BUILD_DIR, "TournamentManager.json"), "utf8")).abi;

// RPC
const RPC_URL = "https://node.shadownet.etherlink.com";

// ============ Helper Functions ============

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatXTZ(wei) {
    return ethers.formatEther(wei) + " XTZ";
}

function rarityToString(rarity) {
    const rarities = ["Common", "Rare", "Epic", "EpicRare", "Legendary"];
    return rarities[rarity] || "Unknown";
}

// ============ Test Results Tracking ============

const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, passed, details = "") {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`   ${status}: ${name}`);
    if (details) console.log(`      ${details}`);
    testResults.tests.push({ name, passed, details });
    if (passed) testResults.passed++;
    else testResults.failed++;
}

// ============ Main Test Function ============

async function runTests() {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🧪 UNICORN X - COMPREHENSIVE TEST SUITE");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log("📍 Network: Etherlink Shadownet Testnet");
    console.log("📍 NFT Contract:", NFT_ADDRESS);
    console.log("📍 PackOpener:", PACK_OPENER_ADDRESS);
    console.log("📍 TournamentManager:", TOURNAMENT_ADDRESS);
    console.log("");

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL, {
        chainId: 127823,
        name: "Etherlink Shadownet"
    });

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ PRIVATE_KEY not set in .env");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log("👤 Tester address:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("💰 Balance:", formatXTZ(balance));
    console.log("");

    // Connect to contracts
    const nftContract = new ethers.Contract(NFT_ADDRESS, NFT_ABI, wallet);
    const packContract = new ethers.Contract(PACK_OPENER_ADDRESS, PACK_ABI, wallet);
    const tournamentContract = new ethers.Contract(TOURNAMENT_ADDRESS, TOURNAMENT_ABI, wallet);

    // Display contract balances
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 CONTRACT BALANCES");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let nftBalance = await provider.getBalance(NFT_ADDRESS);
    let packBalance = await provider.getBalance(PACK_OPENER_ADDRESS);
    let tournamentBalance = await provider.getBalance(TOURNAMENT_ADDRESS);

    console.log(`   NFT Contract:        ${formatXTZ(nftBalance)}`);
    console.log(`   PackOpener:          ${formatXTZ(packBalance)}`);
    console.log(`   TournamentManager:   ${formatXTZ(tournamentBalance)}`);

    // Withdraw any existing funds from contracts to wallet
    if (packBalance > 0n || tournamentBalance > 0n) {
        console.log("\n   💸 Withdrawing funds from contracts...");

        // Withdraw from PackOpener
        if (packBalance > 0n) {
            try {
                const tx = await packContract.withdraw();
                await tx.wait();
                console.log(`   ✅ Withdrew ${formatXTZ(packBalance)} from PackOpener`);
            } catch (e) {
                console.log(`   ⚠️  PackOpener withdraw failed: ${e.message.slice(0, 50)}...`);
            }
        }

        // Withdraw from TournamentManager (emergency withdraw)
        if (tournamentBalance > 0n) {
            try {
                const tx = await tournamentContract.emergencyWithdraw(tournamentBalance, wallet.address);
                await tx.wait();
                console.log(`   ✅ Withdrew ${formatXTZ(tournamentBalance)} from TournamentManager`);
            } catch (e) {
                console.log(`   ⚠️  TournamentManager withdraw failed: ${e.message.slice(0, 50)}...`);
            }
        }

        // Show updated balances
        const newBalance = await provider.getBalance(wallet.address);
        console.log(`\n   💰 Your new balance: ${formatXTZ(newBalance)}`);
    }
    console.log("");

    // ============ TEST 1: Contract State ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 1: Contract Initial State");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        const maxSupply = await nftContract.MAX_SUPPLY();
        logTest("MAX_SUPPLY = 10000", maxSupply === 10000n, `Value: ${maxSupply}`);

        const totalStartups = await nftContract.TOTAL_STARTUPS();
        logTest("TOTAL_STARTUPS = 19", totalStartups === 19n, `Value: ${totalStartups}`);

        const name = await nftContract.name();
        logTest("Name = 'UnicornX Cards'", name === "UnicornX Cards", `Value: ${name}`);

        const symbol = await nftContract.symbol();
        logTest("Symbol = 'FYC'", symbol === "FYC", `Value: ${symbol}`);

        const baseURI = await nftContract.baseURI();
        logTest("BaseURI is set", baseURI.length > 0, `Value: ${baseURI}`);

        const packPrice = await packContract.PACK_PRICE();
        logTest("Pack Price = 5 XTZ", packPrice === ethers.parseEther("5"), `Value: ${formatXTZ(packPrice)}`);

        const maxPacks = await packContract.MAX_PACKS();
        logTest("Max Packs = 10000", maxPacks === 10000n, `Value: ${maxPacks}`);
    } catch (error) {
        logTest("Contract State Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 2: Startup Data ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 2: Startup Data (19 startups)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        // Test a few startups
        const manus = await nftContract.getStartupInfo(1);
        logTest("Startup 1: Manus (Legendary, 10x)",
            manus.name === "Manus" && manus.multiplier === 10n,
            `${manus.name}, ${rarityToString(Number(manus.rarity))}, ${manus.multiplier}x`);

        const openai = await nftContract.getStartupInfo(5);
        logTest("Startup 5: OpenAI (EpicRare, 8x)",
            openai.name === "OpenAI" && openai.multiplier === 8n,
            `${openai.name}, ${rarityToString(Number(openai.rarity))}, ${openai.multiplier}x`);

        const pocket = await nftContract.getStartupInfo(15);
        logTest("Startup 15: Pocket (Common, 1x)",
            pocket.name === "Pocket" && pocket.multiplier === 1n,
            `${pocket.name}, ${rarityToString(Number(pocket.rarity))}, ${pocket.multiplier}x`);

        // Test invalid startup
        try {
            await nftContract.getStartupInfo(0);
            logTest("Invalid startup ID (0) reverts", false, "Should have reverted");
        } catch (e) {
            logTest("Invalid startup ID (0) reverts", true, "Correctly reverted");
        }

        try {
            await nftContract.getStartupInfo(20);
            logTest("Invalid startup ID (20) reverts", false, "Should have reverted");
        } catch (e) {
            logTest("Invalid startup ID (20) reverts", true, "Correctly reverted");
        }
    } catch (error) {
        logTest("Startup Data Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 3: Authorization ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 3: Authorization Checks");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        const packIsAuthorizedMinter = await nftContract.authorizedMinters(PACK_OPENER_ADDRESS);
        logTest("PackOpener is authorized minter", packIsAuthorizedMinter === true);

        const tournamentIsAuthorizedLocker = await nftContract.authorizedLockers(TOURNAMENT_ADDRESS);
        logTest("TournamentManager is authorized locker", tournamentIsAuthorizedLocker === true);

        const randomIsNotMinter = await nftContract.authorizedMinters(wallet.address);
        logTest("Random address is NOT authorized minter", randomIsNotMinter === false);

        // Test unauthorized mint
        try {
            await nftContract.mint.staticCall(wallet.address, 1);
            logTest("Unauthorized mint reverts", false, "Should have reverted");
        } catch (e) {
            logTest("Unauthorized mint reverts", true, "Correctly reverted");
        }
    } catch (error) {
        logTest("Authorization Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 4: Pack Purchase & Opening ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 4: Pack Purchase & Opening (LIVE TRANSACTION)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let mintedTokenIds = [];

    try {
        const packsRemaining = await packContract.getPacksRemaining();
        console.log(`   📦 Packs remaining: ${packsRemaining}`);

        const supplyBefore = await nftContract.totalSupply();
        console.log(`   📊 Total supply before: ${supplyBefore}`);

        // Test insufficient payment
        try {
            await packContract.buyAndOpenPack.staticCall({ value: ethers.parseEther("1") });
            logTest("Insufficient payment (1 XTZ) reverts", false, "Should have reverted");
        } catch (e) {
            logTest("Insufficient payment (1 XTZ) reverts", true, "Correctly reverted");
        }

        // Buy and open a pack
        console.log("\n   💳 Buying and opening pack (5 XTZ)...");
        const tx = await packContract.buyAndOpenPack({
            value: ethers.parseEther("5"),
            gasLimit: 3000000  // Explicit gas limit to prevent estimation issues
        });
        console.log(`   📝 Transaction: ${tx.hash}`);

        const receipt = await tx.wait();
        logTest("buyAndOpenPack() transaction succeeded", receipt.status === 1, `Gas used: ${receipt.gasUsed}`);

        // Parse events to get minted token IDs
        for (const log of receipt.logs) {
            try {
                const parsed = nftContract.interface.parseLog(log);
                if (parsed && parsed.name === "CardMinted") {
                    mintedTokenIds.push(Number(parsed.args.tokenId));
                }
            } catch (e) { }
        }

        console.log(`   🎴 Minted token IDs: ${mintedTokenIds.join(", ")}`);
        logTest("Received 5 cards from pack", mintedTokenIds.length === 5, `Got ${mintedTokenIds.length} cards`);

        const supplyAfter = await nftContract.totalSupply();
        logTest("Total supply increased by 5", supplyAfter - supplyBefore === 5n, `Before: ${supplyBefore}, After: ${supplyAfter}`);

        // Check card ownership
        if (mintedTokenIds.length > 0) {
            const owner = await nftContract.ownerOf(mintedTokenIds[0]);
            logTest("User owns minted cards", owner === wallet.address);
        }

        // Withdraw from PackOpener to recover test funds (treasury = wallet)
        console.log("\n   💰 Withdrawing from PackOpener...");
        const packBalance = await provider.getBalance(PACK_OPENER_ADDRESS);
        if (packBalance > 0n) {
            const withdrawTx = await packContract.withdraw();
            await withdrawTx.wait();
            console.log(`   ✅ Withdrawn ${formatXTZ(packBalance)} from PackOpener to treasury`);
        }
    } catch (error) {
        logTest("Pack Purchase Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 5: Card Info & Metadata ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 5: Card Info & Metadata (ALL CARDS)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        if (mintedTokenIds.length > 0) {
            console.log("\n   🎴 YOUR MINTED CARDS:");
            console.log("   ┌─────────┬────────────────────┬────────────┬────────┬────────┐");
            console.log("   │ TokenID │ Startup            │ Rarity     │ Multi  │ Locked │");
            console.log("   ├─────────┼────────────────────┼────────────┼────────┼────────┤");

            // Check ALL minted cards
            for (const tokenId of mintedTokenIds) {
                const cardInfo = await nftContract.getCardInfo(tokenId);
                const rarity = rarityToString(Number(cardInfo.rarity));
                const name = cardInfo.name.padEnd(18);
                const rarityPad = rarity.padEnd(10);
                const multi = (cardInfo.multiplier + "x").padEnd(6);
                const locked = cardInfo.isLocked ? "Yes" : "No ";

                console.log(`   │ #${String(tokenId).padEnd(6)} │ ${name} │ ${rarityPad} │ ${multi} │ ${locked}    │`);

                // Validate each card
                logTest(`Card #${tokenId} has valid startupId`,
                    cardInfo.startupId >= 1n && cardInfo.startupId <= 19n,
                    `${cardInfo.name} (ID: ${cardInfo.startupId})`);
            }

            console.log("   └─────────┴────────────────────┴────────────┴────────┴────────┘\n");

            // Test tokenURI for first card
            const tokenURI = await nftContract.tokenURI(mintedTokenIds[0]);
            logTest("tokenURI is generated correctly",
                tokenURI.includes(mintedTokenIds[0].toString()),
                `URI: ${tokenURI}`);
        }
    } catch (error) {
        logTest("Card Info Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 6: Tournament Creation ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 6: Tournament Creation (Admin only)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    let tournamentId = 0;

    try {
        const now = Math.floor(Date.now() / 1000);
        const registrationStart = now; // Registration open now
        const startTime = now + 300; // Start in 5 minutes
        const endTime = now + 3600; // End in 1 hour

        console.log("   🏆 Creating tournament with registration period...");
        console.log(`      Registration: ${new Date(registrationStart * 1000).toLocaleTimeString()}`);
        console.log(`      Start: ${new Date(startTime * 1000).toLocaleTimeString()}`);
        console.log(`      End: ${new Date(endTime * 1000).toLocaleTimeString()}`);

        const tx = await tournamentContract.createTournament(registrationStart, startTime, endTime);
        const receipt = await tx.wait();
        logTest("createTournament() succeeded", receipt.status === 1, `Gas: ${receipt.gasUsed}`);

        // Parse event to get tournament ID
        for (const log of receipt.logs) {
            try {
                const parsed = tournamentContract.interface.parseLog(log);
                if (parsed && parsed.name === "TournamentCreated") {
                    tournamentId = Number(parsed.args.tournamentId);
                }
            } catch (e) { }
        }

        console.log(`   🎯 Tournament ID: ${tournamentId}`);
        logTest("Tournament ID assigned", tournamentId > 0);

        const tournament = await tournamentContract.getTournament(tournamentId);
        logTest("Registration start set",
            Number(tournament.registrationStart) === registrationStart);

        logTest("Tournament start time set correctly",
            Number(tournament.startTime) === startTime,
            `Start: ${new Date(Number(tournament.startTime) * 1000).toISOString()}`);

        logTest("Tournament end time set correctly",
            Number(tournament.endTime) === endTime);

        logTest("Tournament status is Created", tournament.status === 0n);

        // Test getTournamentPhase
        const phase = await tournamentContract.getTournamentPhase(tournamentId);
        logTest("Tournament phase is 'Registration'", phase === "Registration", `Phase: ${phase}`);

        // Test canRegister
        const canReg = await tournamentContract.canRegister(tournamentId, wallet.address);
        logTest("canRegister() returns true", canReg === true);
    } catch (error) {
        logTest("Tournament Creation Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 7: Tournament Registration (NFT Freeze) ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 7: Tournament Registration (NFT Freeze - requires 5 cards)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        if (mintedTokenIds.length >= 5 && tournamentId > 0) {
            const lineupCards = mintedTokenIds.slice(0, 5);
            console.log(`   🎴 Entering with cards: ${lineupCards.join(", ")}`);

            // Enter tournament (NFTs will be frozen/locked)
            console.log("\n   🎯 Registering lineup (NFTs will be frozen)...");
            const tx = await tournamentContract.enterTournament(
                tournamentId,
                lineupCards
            );
            const receipt = await tx.wait();
            logTest("enterTournament() succeeded", receipt.status === 1, `Gas: ${receipt.gasUsed}`);

            // Check NFTs are STILL owned by user (not transferred)
            for (const tokenId of lineupCards) {
                const owner = await nftContract.ownerOf(tokenId);
                if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
                    logTest("NFTs still owned by user", false, `Token ${tokenId} not owned`);
                    break;
                }
            }
            logTest("All 5 NFTs still owned by user", true);

            // Check NFTs are locked/frozen
            let allFrozen = true;
            for (const tokenId of lineupCards) {
                const isLocked = await nftContract.isLocked(tokenId);
                if (!isLocked) {
                    allFrozen = false;
                    logTest("NFTs are frozen", false, `Token ${tokenId} not frozen`);
                    break;
                }
            }
            if (allFrozen) {
                logTest("All 5 NFTs are frozen (locked)", true);
            }

            // Check lineup stored
            const lineup = await tournamentContract.getUserLineup(tournamentId, wallet.address);
            logTest("Lineup stored correctly",
                lineup.owner.toLowerCase() === wallet.address.toLowerCase(),
                `Owner: ${lineup.owner.slice(0, 10)}...`);

            // Test cannot transfer frozen card
            try {
                await nftContract.transferFrom.staticCall(
                    wallet.address,
                    "0x0000000000000000000000000000000000000001",
                    lineupCards[0]
                );
                logTest("Cannot transfer frozen NFT", false, "Should have reverted");
            } catch (e) {
                logTest("Cannot transfer frozen NFT", true, "Correctly reverted");
            }

            // Test cannot enter twice
            try {
                await tournamentContract.enterTournament.staticCall(
                    tournamentId,
                    lineupCards
                );
                logTest("Cannot enter tournament twice", false, "Should have reverted");
            } catch (e) {
                logTest("Cannot enter tournament twice", true, "Correctly reverted");
            }

            // Test canCancelEntry
            const canCancel = await tournamentContract.canCancelEntry(tournamentId, wallet.address);
            logTest("canCancelEntry() returns true (before start)", canCancel === true);
        } else {
            console.log("   ⚠️  Skipping: Need 5 cards and valid tournament ID");
        }
    } catch (error) {
        logTest("Tournament Registration Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 8: Tournament Entry Count & Participants ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 8: Tournament Participants");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        if (tournamentId > 0) {
            // Check tournament entry count
            const tournament = await tournamentContract.getTournament(tournamentId);
            logTest("Tournament has 1 entry", tournament.entryCount === 1n);

            const participants = await tournamentContract.getTournamentParticipants(tournamentId);
            logTest("Participant recorded",
                participants.some(p => p.toLowerCase() === wallet.address.toLowerCase()),
                `Participants: ${participants.length}`);

            // Check active entry count
            const activeCount = await tournamentContract.getActiveEntryCount(tournamentId);
            logTest("getActiveEntryCount() works", activeCount === 1n, `Active: ${activeCount}`);
        }
    } catch (error) {
        logTest("Lineup Validation Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 9: View Functions ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 9: View Functions");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        const ownedTokens = await nftContract.getOwnedTokens(wallet.address);
        logTest("getOwnedTokens() works", ownedTokens.length >= 5, `Owns ${ownedTokens.length} tokens`);

        const userPacks = await packContract.getUserPacks(wallet.address);
        logTest("getUserPacks() works", userPacks.length >= 1, `Has ${userPacks.length} packs`);

        const packInfo = await packContract.getPackInfo(userPacks[0]);
        logTest("getPackInfo() works", packInfo.buyer === wallet.address);

        const unopenedCount = await packContract.getUnopenedPackCount(wallet.address);
        logTest("getUnopenedPackCount() works", unopenedCount >= 0n, `Unopened: ${unopenedCount}`);
    } catch (error) {
        logTest("View Functions Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 10: Prize Pool Tokenomics ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 10: Prize Pool Tokenomics (90/10 Split)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        // Check PRIZE_POOL_PERCENT and TREASURY_PERCENT constants
        const prizePoolPercent = await packContract.PRIZE_POOL_PERCENT();
        logTest("PRIZE_POOL_PERCENT = 90", prizePoolPercent === 90n, `Value: ${prizePoolPercent}%`);

        const treasuryPercent = await packContract.TREASURY_PERCENT();
        logTest("TREASURY_PERCENT = 10", treasuryPercent === 10n, `Value: ${treasuryPercent}%`);

        // Step 1: Set TournamentManager in PackOpener
        console.log("\n   🔗 Setting up cross-contract references...");

        let tx = await packContract.setTournamentManager(TOURNAMENT_ADDRESS);
        await tx.wait();
        logTest("setTournamentManager() succeeded", true);

        const tmAddress = await packContract.tournamentManager();
        logTest("TournamentManager address set correctly",
            tmAddress.toLowerCase() === TOURNAMENT_ADDRESS.toLowerCase());

        // Step 2: Set PackOpener in TournamentManager
        tx = await tournamentContract.setPackOpener(PACK_OPENER_ADDRESS);
        await tx.wait();
        logTest("setPackOpener() succeeded", true);

        const poAddress = await tournamentContract.packOpener();
        logTest("PackOpener address set correctly",
            poAddress.toLowerCase() === PACK_OPENER_ADDRESS.toLowerCase());

        // Step 3: Create tournament for prize pool
        console.log("\n   🏆 Creating tournament for prize pool test...");
        const now = Math.floor(Date.now() / 1000);
        const registrationStart = now; // Open now
        const startTime = now + 120;
        const endTime = now + 7200;

        tx = await tournamentContract.createTournament(registrationStart, startTime, endTime);
        const receipt = await tx.wait();

        let testTournamentId = 0;
        for (const log of receipt.logs) {
            try {
                const parsed = tournamentContract.interface.parseLog(log);
                if (parsed && parsed.name === "TournamentCreated") {
                    testTournamentId = Number(parsed.args.tournamentId);
                }
            } catch (e) { }
        }
        logTest("Tournament created for prize pool", testTournamentId > 0, `Tournament ID: ${testTournamentId}`);

        // Step 4: Set active tournament in PackOpener
        tx = await packContract.setActiveTournament(testTournamentId);
        await tx.wait();

        const activeTournament = await packContract.activeTournamentId();
        logTest("setActiveTournament() works", activeTournament === BigInt(testTournamentId), `Active: ${activeTournament}`);

        // Step 5: Get balances before pack purchase
        const prizePoolBefore = (await tournamentContract.getTournament(testTournamentId)).prizePool;
        const packBalanceBefore = await provider.getBalance(PACK_OPENER_ADDRESS);
        console.log(`\n   📊 Before pack purchase:`);
        console.log(`      Prize Pool: ${formatXTZ(prizePoolBefore)}`);
        console.log(`      PackOpener: ${formatXTZ(packBalanceBefore)}`);

        // Step 6: Buy a pack and verify split
        console.log("\n   💳 Buying pack to test 90/10 split...");
        tx = await packContract.buyAndOpenPack({
            value: ethers.parseEther("5"),
            gasLimit: 3000000
        });
        await tx.wait();

        // Step 7: Check balances after
        const prizePoolAfter = (await tournamentContract.getTournament(testTournamentId)).prizePool;
        const packBalanceAfter = await provider.getBalance(PACK_OPENER_ADDRESS);

        console.log(`\n   📊 After pack purchase:`);
        console.log(`      Prize Pool: ${formatXTZ(prizePoolAfter)}`);
        console.log(`      PackOpener: ${formatXTZ(packBalanceAfter)}`);

        const prizePoolIncrease = prizePoolAfter - prizePoolBefore;
        const packBalanceIncrease = packBalanceAfter - packBalanceBefore;

        console.log(`\n   📈 Increases:`);
        console.log(`      Prize Pool: +${formatXTZ(prizePoolIncrease)} (expected: 4.5 XTZ)`);
        console.log(`      PackOpener: +${formatXTZ(packBalanceIncrease)} (expected: 0.5 XTZ)`);

        // 5 XTZ pack: 90% = 4.5 XTZ to prize pool, 10% = 0.5 XTZ to treasury
        logTest("90% (4.5 XTZ) went to Prize Pool",
            prizePoolIncrease === ethers.parseEther("4.5"),
            `Increase: ${formatXTZ(prizePoolIncrease)}`);

        logTest("10% (0.5 XTZ) stayed in PackOpener",
            packBalanceIncrease === ethers.parseEther("0.5"),
            `Increase: ${formatXTZ(packBalanceIncrease)}`);

        // Step 8: Test manual addToPrizePool
        console.log("\n   💰 Testing manual addToPrizePool...");
        tx = await tournamentContract.addToPrizePool(testTournamentId, { value: ethers.parseEther("1") });
        await tx.wait();

        const prizePoolManual = (await tournamentContract.getTournament(testTournamentId)).prizePool;
        logTest("Manual addToPrizePool works",
            prizePoolManual === prizePoolAfter + ethers.parseEther("1"),
            `New prize pool: ${formatXTZ(prizePoolManual)}`);

        // Step 9: Test withdrawFromPrizePool
        console.log("\n   💸 Testing withdrawFromPrizePool...");
        const withdrawAmount = ethers.parseEther("0.5");
        tx = await tournamentContract.withdrawFromPrizePool(testTournamentId, withdrawAmount, wallet.address);
        await tx.wait();

        const prizePoolWithdrawn = (await tournamentContract.getTournament(testTournamentId)).prizePool;
        logTest("withdrawFromPrizePool works",
            prizePoolWithdrawn === prizePoolManual - withdrawAmount,
            `After withdraw: ${formatXTZ(prizePoolWithdrawn)}`);

    } catch (error) {
        logTest("Prize Pool Tokenomics Tests", false, error.message);
    }
    console.log("");

    // ============ TEST 11: NFT Merge ============
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 TEST 11: NFT Merge (3 same rarity → 1 higher rarity)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
        // Buy another pack to get fresh cards for merge
        console.log("   📦 Buying pack to get merge-ready cards...");
        const mergeTx = await packContract.buyAndOpenPack({
            value: ethers.parseEther("5"),
            gasLimit: 3000000
        });
        const mergeReceipt = await mergeTx.wait();

        let newCardIds = [];
        for (const log of mergeReceipt.logs) {
            try {
                const parsed = nftContract.interface.parseLog(log);
                if (parsed && parsed.name === "CardMinted") {
                    newCardIds.push(Number(parsed.args.tokenId));
                }
            } catch (e) { }
        }
        console.log(`   🎴 New cards: ${newCardIds.join(", ")}`);

        // Find 3 Common cards from ALL owned tokens
        const allTokens = await nftContract.getOwnedTokens(wallet.address);
        const commonCards = [];

        for (const tokenId of allTokens) {
            try {
                const cardInfo = await nftContract.getCardInfo(tokenId);
                // Check if Common (rarity = 0) and not locked
                if (cardInfo.rarity === 0n && !cardInfo.isLocked && commonCards.length < 3) {
                    commonCards.push(Number(tokenId));
                }
            } catch (e) { }
        }

        if (commonCards.length >= 3) {
            console.log(`   🔀 Merging 3 Common cards: ${commonCards.join(", ")}`);

            const supplyBefore = await nftContract.totalSupply();

            const tx = await nftContract.mergeCards(commonCards);
            const receipt = await tx.wait();
            logTest("mergeCards() succeeded", receipt.status === 1, `Gas: ${receipt.gasUsed}`);

            // Parse CardsMerged event
            let mergedNewTokenId = 0;
            for (const log of receipt.logs) {
                try {
                    const parsed = nftContract.interface.parseLog(log);
                    if (parsed && parsed.name === "CardsMerged") {
                        mergedNewTokenId = Number(parsed.args.newTokenId);
                    }
                } catch (e) { }
            }

            logTest("New token minted", mergedNewTokenId > 0, `New Token ID: ${mergedNewTokenId}`);

            // Verify new card is Rare
            if (mergedNewTokenId > 0) {
                const newCardInfo = await nftContract.getCardInfo(mergedNewTokenId);
                logTest("New card is Rare (rarity 1)", newCardInfo.rarity === 1n,
                    `${newCardInfo.name} - ${["Common", "Rare", "Epic", "EpicRare", "Legendary"][Number(newCardInfo.rarity)]}`);
            }

            // Verify old cards are burned (supply decreased by 2: -3 burned +1 minted)
            const supplyAfter = await nftContract.totalSupply();
            logTest("Supply decreased by 2 (3 burned, 1 minted)",
                supplyAfter === supplyBefore - 2n,
                `Before: ${supplyBefore}, After: ${supplyAfter}`);

            // Verify burned cards no longer exist
            try {
                await nftContract.ownerOf(commonCards[0]);
                logTest("Burned cards no longer exist", false, "Should have reverted");
            } catch (e) {
                logTest("Burned cards no longer exist", true, "Correctly reverted");
            }
        } else {
            console.log(`   ⚠️  Not enough Common cards (have ${commonCards.length}, need 3)`);
        }

    } catch (error) {
        logTest("NFT Merge Tests", false, error.message);
    }
    console.log("");


    // ============ TEST SUMMARY ============
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("📊 TEST SUMMARY");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log(`   ✅ PASSED: ${testResults.passed}`);
    console.log(`   ❌ FAILED: ${testResults.failed}`);
    console.log(`   📊 TOTAL:  ${testResults.passed + testResults.failed}`);
    console.log("");

    if (testResults.failed === 0) {
        console.log("   🎉 ALL TESTS PASSED!");
    } else {
        console.log("   ⚠️  Some tests failed. Check details above.");
        console.log("\n   Failed tests:");
        testResults.tests.filter(t => !t.passed).forEach(t => {
            console.log(`   - ${t.name}: ${t.details}`);
        });
    }
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");

    // Save test results
    const resultsFile = path.join(__dirname, "..", "test-results.json");
    fs.writeFileSync(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        network: "Etherlink Shadownet Testnet",
        summary: {
            passed: testResults.passed,
            failed: testResults.failed,
            total: testResults.passed + testResults.failed
        },
        tests: testResults.tests
    }, null, 2));
    console.log(`\n📁 Results saved to: test-results.json`);

    // Final cleanup: withdraw any remaining funds from contracts
    console.log("\n💰 Final cleanup: withdrawing remaining funds...");
    try {
        const packBalance = await provider.getBalance(PACK_OPENER_ADDRESS);
        if (packBalance > 0n) {
            const tx1 = await packContract.withdraw();
            await tx1.wait();
            console.log(`   ✅ Withdrawn ${formatXTZ(packBalance)} from PackOpener`);
        }

        const tmBalance = await provider.getBalance(TOURNAMENT_ADDRESS);
        if (tmBalance > 0n) {
            const tx2 = await tournamentContract.emergencyWithdraw(tmBalance, wallet.address);
            await tx2.wait();
            console.log(`   ✅ Withdrawn ${formatXTZ(tmBalance)} from TournamentManager`);
        }

        const finalBalance = await provider.getBalance(wallet.address);
        console.log(`   💰 Final wallet balance: ${formatXTZ(finalBalance)}`);
    } catch (e) {
        console.log(`   ⚠️  Cleanup error: ${e.message}`);
    }
}

// Run tests
runTests()
    .then(() => process.exit(0))
    .catch(error => {
        console.error("❌ Test suite error:", error);
        process.exit(1);
    });
