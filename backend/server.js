// Fantasy YC Metadata API Server
// Serves dynamic NFT metadata for OpenSea and other marketplaces

const express = require("express");
const cors = require("cors");
const path = require("path");
const { ethers } = require("ethers");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3001;

// Server URL for images (use env or localhost for dev)
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

// ============ Configuration ============

// Contract address (update after deployment)
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

// RPC endpoint
const RPC_URL = process.env.RPC_URL || "https://node.shadownet.etherlink.com";

// IPFS base URL for images (19 startup images)
const IPFS_IMAGE_BASE = process.env.IPFS_IMAGE_BASE || "ipfs://QmIMAGEPLACEHOLDER";

// ============ Startup Data ============

const STARTUPS = {
    1: { name: "Manus", slug: "manus", rarity: "Legendary", multiplier: 10, description: "AI-powered humanoid robots" },
    2: { name: "Lovable", slug: "lovable", rarity: "Legendary", multiplier: 10, description: "AI software engineer" },
    3: { name: "Cursor", slug: "cursor", rarity: "Legendary", multiplier: 10, description: "AI-first code editor" },
    4: { name: "Anthropic", slug: "anthropic", rarity: "Legendary", multiplier: 10, description: "AI safety company - Claude" },
    5: { name: "OpenAI", slug: "openai", rarity: "Epic Rare", multiplier: 8, description: "Leading AI research lab - GPT" },
    6: { name: "Browser Use", slug: "browser-use", rarity: "Epic", multiplier: 5, description: "AI browser automation" },
    7: { name: "Dedalus Labs", slug: "dedalus-labs", rarity: "Epic", multiplier: 5, description: "Decentralized infrastructure" },
    8: { name: "Autumn", slug: "autumn", rarity: "Epic", multiplier: 5, description: "Insurance automation" },
    9: { name: "Axiom", slug: "axiom", rarity: "Epic", multiplier: 5, description: "ZK coprocessor for Ethereum" },
    10: { name: "Multifactor", slug: "multifactor", rarity: "Rare", multiplier: 3, description: "Authentication platform" },
    11: { name: "Dome", slug: "dome", rarity: "Rare", multiplier: 3, description: "Smart home security" },
    12: { name: "GrazeMate", slug: "grazemate", rarity: "Rare", multiplier: 3, description: "AgTech for livestock" },
    13: { name: "Tornyol Systems", slug: "tornyol-systems", rarity: "Rare", multiplier: 3, description: "Industrial automation" },
    14: { name: "Axiom", slug: "axiom-rare", rarity: "Rare", multiplier: 3, description: "Data analytics platform" },
    15: { name: "Pocket", slug: "pocket", rarity: "Common", multiplier: 1, description: "Mobile savings app" },
    16: { name: "Caretta", slug: "caretta", rarity: "Common", multiplier: 1, description: "Fleet management" },
    17: { name: "AxionOrbital Space", slug: "axionorbital-space", rarity: "Common", multiplier: 1, description: "Space logistics" },
    18: { name: "Freeport Markets", slug: "freeport-markets", rarity: "Common", multiplier: 1, description: "DeFi marketplace" },
    19: { name: "Ruvo", slug: "ruvo", rarity: "Common", multiplier: 1, description: "Sustainable packaging" },
};

// ============ Dynamic Stats (simulated - would come from Grok API/DB) ============

const DYNAMIC_STATS = {
    1: { valuation: "$2.5B", partnerships: 12, funding: "$100M Series B" },
    2: { valuation: "$1.2B", partnerships: 8, funding: "$60M Series A" },
    3: { valuation: "$2.6B", partnerships: 15, funding: "$150M Series B" },
    4: { valuation: "$18B", partnerships: 25, funding: "$750M Series D" },
    5: { valuation: "$157B", partnerships: 50, funding: "$13B Total" },
    6: { valuation: "$50M", partnerships: 3, funding: "$5M Seed" },
    7: { valuation: "$80M", partnerships: 4, funding: "$12M Series A" },
    8: { valuation: "$120M", partnerships: 6, funding: "$20M Series A" },
    9: { valuation: "$200M", partnerships: 10, funding: "$30M Series B" },
    10: { valuation: "$30M", partnerships: 2, funding: "$4M Seed" },
    11: { valuation: "$25M", partnerships: 2, funding: "$3M Seed" },
    12: { valuation: "$15M", partnerships: 1, funding: "$2M Seed" },
    13: { valuation: "$20M", partnerships: 2, funding: "$3M Seed" },
    14: { valuation: "$35M", partnerships: 3, funding: "$5M Seed" },
    15: { valuation: "$8M", partnerships: 1, funding: "$1M Pre-seed" },
    16: { valuation: "$10M", partnerships: 1, funding: "$1.5M Pre-seed" },
    17: { valuation: "$12M", partnerships: 1, funding: "$2M Seed" },
    18: { valuation: "$7M", partnerships: 1, funding: "$1M Pre-seed" },
    19: { valuation: "$9M", partnerships: 1, funding: "$1.2M Pre-seed" },
};

// ============ Contract ABI (minimal for reading) ============

const NFT_ABI = [
    "function tokenToStartup(uint256 tokenId) view returns (uint256)",
    "function tokenToEdition(uint256 tokenId) view returns (uint256)",
    "function startupMintCount(uint256 startupId) view returns (uint256)",
    "function isLocked(uint256 tokenId) view returns (bool)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function totalSupply() view returns (uint256)"
];

// ============ Provider & Contract ============

let provider = null;
let nftContract = null;

function initContract() {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        if (NFT_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
            nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, provider);
            console.log("✅ Connected to NFT contract:", NFT_CONTRACT_ADDRESS);
        } else {
            console.log("⚠️  No contract address set - using mock data for testing");
        }
    } catch (error) {
        console.error("❌ Failed to connect to RPC:", error.message);
    }
}

// ============ Middleware ============

app.use(cors());
app.use(express.json());

// Serve static files (images)
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// ============ Mock Data for Testing ============

// Simulates contract data before deployment
const MOCK_TOKENS = {};

function generateMockToken(tokenId) {
    // Simulate random distribution like the pack opener
    const seed = tokenId * 12345;
    const rarityRoll = seed % 100;

    let startupId;
    if (rarityRoll < 70) {
        // Common: IDs 15-19
        startupId = 15 + (seed % 5);
    } else if (rarityRoll < 95) {
        // Rare: IDs 10-14
        startupId = 10 + ((seed / 100) % 5);
    } else {
        // Epic/Legendary: IDs 1-9
        startupId = 1 + ((seed / 1000) % 9);
    }

    // Calculate edition based on how many of this startup we've "seen"
    const edition = Math.floor(tokenId / 19) + 1;

    return {
        startupId,
        edition,
        isLocked: false,
        totalMinted: edition * 3 // Simulated total
    };
}

// ============ API Routes ============

/**
 * Health check
 */
app.get("/", (req, res) => {
    res.json({
        name: "Fantasy YC Metadata API",
        version: "1.0.0",
        status: "running",
        contract: NFT_CONTRACT_ADDRESS,
        network: RPC_URL.includes("shadownet") ? "Etherlink Shadownet" : "Unknown"
    });
});

/**
 * Get metadata for a specific token
 * OpenSea and marketplaces call this endpoint
 */
app.get("/metadata/:tokenId", async (req, res) => {
    try {
        const tokenId = parseInt(req.params.tokenId);

        if (isNaN(tokenId) || tokenId < 1) {
            return res.status(400).json({ error: "Invalid token ID" });
        }

        let startupId, edition, isLocked, totalMinted;

        // Try to get data from contract, fallback to mock
        if (nftContract) {
            try {
                startupId = Number(await nftContract.tokenToStartup(tokenId));
                edition = Number(await nftContract.tokenToEdition(tokenId));
                isLocked = await nftContract.isLocked(tokenId);
                totalMinted = Number(await nftContract.startupMintCount(startupId));
            } catch (contractError) {
                console.log(`⚠️  Token ${tokenId} not found on chain, using mock data`);
                const mock = generateMockToken(tokenId);
                startupId = mock.startupId;
                edition = mock.edition;
                isLocked = mock.isLocked;
                totalMinted = mock.totalMinted;
            }
        } else {
            // Use mock data for testing
            const mock = generateMockToken(tokenId);
            startupId = mock.startupId;
            edition = mock.edition;
            isLocked = mock.isLocked;
            totalMinted = mock.totalMinted;
        }

        // Get startup info
        const startup = STARTUPS[startupId];
        if (!startup) {
            return res.status(404).json({ error: "Startup not found" });
        }

        // Get dynamic stats
        const stats = DYNAMIC_STATS[startupId] || {};

        // Build OpenSea-compatible metadata
        // Use server URL for images (or IPFS if configured)
        const imageUrl = IPFS_IMAGE_BASE.startsWith("ipfs://") && !IPFS_IMAGE_BASE.includes("PLACEHOLDER")
            ? `${IPFS_IMAGE_BASE}/${startup.slug}.png`
            : `${SERVER_URL}/images/${startup.slug}.png`;

        const metadata = {
            name: `${startup.name} #${edition}`,
            description: `${startup.rarity} YC startup card - ${startup.description}. Edition ${edition} of ${totalMinted} minted.`,
            image: imageUrl,
            external_url: `https://fantasyyc.app/card/${tokenId}`,
            attributes: [
                {
                    trait_type: "Startup",
                    value: startup.name
                },
                {
                    trait_type: "Startup ID",
                    value: startupId.toString()
                },
                {
                    trait_type: "Rarity",
                    value: startup.rarity
                },
                {
                    trait_type: "Multiplier",
                    value: startup.multiplier.toString() + "x"
                },
                {
                    trait_type: "Edition",
                    value: edition.toString(),
                    display_type: "number"
                },
                {
                    trait_type: "Total Minted",
                    value: totalMinted,
                    display_type: "number"
                },
                {
                    trait_type: "Locked",
                    value: isLocked ? "Yes" : "No"
                },
                {
                    trait_type: "Valuation",
                    value: stats.valuation || "N/A"
                },
                {
                    trait_type: "Partnerships",
                    value: stats.partnerships || 0,
                    display_type: "number"
                },
                {
                    trait_type: "Funding",
                    value: stats.funding || "N/A"
                },
                {
                    trait_type: "Last Updated",
                    value: new Date().toISOString().split("T")[0]
                }
            ]
        };

        // Set cache headers (1 hour for dynamic data)
        res.set("Cache-Control", "public, max-age=3600");
        res.json(metadata);

    } catch (error) {
        console.error("Error generating metadata:", error);
        res.status(500).json({ error: "Failed to generate metadata" });
    }
});

/**
 * Get all startup information
 */
app.get("/startups", (req, res) => {
    res.json(STARTUPS);
});

/**
 * Get specific startup info
 */
app.get("/startups/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const startup = STARTUPS[id];

    if (!startup) {
        return res.status(404).json({ error: "Startup not found" });
    }

    res.json({
        ...startup,
        id,
        stats: DYNAMIC_STATS[id] || {}
    });
});

/**
 * Get contract stats
 */
app.get("/stats", async (req, res) => {
    try {
        let totalSupply = 0;

        if (nftContract) {
            try {
                totalSupply = Number(await nftContract.totalSupply());
            } catch (e) {
                totalSupply = 0;
            }
        }

        res.json({
            totalSupply,
            maxSupply: 10000,
            totalStartups: 19,
            contractAddress: NFT_CONTRACT_ADDRESS,
            network: RPC_URL.includes("shadownet") ? "Etherlink Shadownet Testnet" : "Unknown"
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ============ Start Server ============

initContract();

app.listen(PORT, () => {
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🚀 Fantasy YC Metadata API Server");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
    console.log(`📍 Server running at: http://localhost:${PORT}`);
    console.log("");
    console.log("📋 Endpoints:");
    console.log(`   GET http://localhost:${PORT}/                  - Health check`);
    console.log(`   GET http://localhost:${PORT}/metadata/:tokenId - Token metadata`);
    console.log(`   GET http://localhost:${PORT}/startups          - All startups`);
    console.log(`   GET http://localhost:${PORT}/startups/:id      - Startup by ID`);
    console.log(`   GET http://localhost:${PORT}/stats             - Contract stats`);
    console.log("");
    console.log("🧪 Test URLs:");
    console.log(`   http://localhost:${PORT}/metadata/1`);
    console.log(`   http://localhost:${PORT}/metadata/100`);
    console.log(`   http://localhost:${PORT}/metadata/3421`);
    console.log("");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("");
});
