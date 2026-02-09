// scripts/compile.js
// Compile Solidity contracts using solc

const solc = require("solc");
const fs = require("fs");
const path = require("path");

// Directories
const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const BUILD_DIR = path.join(__dirname, "..", "build");
const NODE_MODULES = path.join(__dirname, "..", "node_modules");

// Create build directory
if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
}

console.log("🔨 Compiling Fantasy YC Smart Contracts with solc...\n");

// Contract files to compile
const contractFiles = [
    "FantasyYC_NFT.sol",
    "PackOpener.sol",
    "TournamentManager.sol",
    "Marketplace.sol"
];

// Read contract sources
const sources = {};

// Import resolver for OpenZeppelin
function findImports(importPath) {
    try {
        let resolvedPath;

        if (importPath.startsWith("@openzeppelin/")) {
            resolvedPath = path.join(NODE_MODULES, importPath);
        } else {
            resolvedPath = path.join(CONTRACTS_DIR, importPath);
        }

        const content = fs.readFileSync(resolvedPath, "utf8");
        return { contents: content };
    } catch (error) {
        return { error: `File not found: ${importPath}` };
    }
}

// Load contract sources
for (const file of contractFiles) {
    const filePath = path.join(CONTRACTS_DIR, file);
    sources[file] = { content: fs.readFileSync(filePath, "utf8") };
    console.log(`📄 Loaded: ${file}`);
}

// Compiler input
const input = {
    language: "Solidity",
    sources: sources,
    settings: {
        optimizer: {
            enabled: true,
            runs: 200
        },
        evmVersion: "shanghai", // Osaka not yet in solc, use shanghai
        outputSelection: {
            "*": {
                "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "metadata"]
            }
        }
    }
};

console.log("\n⏳ Compiling...\n");

// Compile
const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
);

// Check for errors
if (output.errors) {
    let hasError = false;
    for (const error of output.errors) {
        if (error.severity === "error") {
            console.error(`❌ Error: ${error.formattedMessage}`);
            hasError = true;
        } else {
            console.warn(`⚠️  Warning: ${error.formattedMessage}`);
        }
    }
    if (hasError) {
        console.error("\n❌ Compilation failed!");
        process.exit(1);
    }
}

// Process compiled contracts
const compiledContracts = {};

for (const file of contractFiles) {
    const contractName = file.replace(".sol", "");

    if (output.contracts && output.contracts[file]) {
        const contract = output.contracts[file][contractName];

        if (contract) {
            compiledContracts[contractName] = {
                abi: contract.abi,
                bytecode: "0x" + contract.evm.bytecode.object,
                deployedBytecode: "0x" + contract.evm.deployedBytecode.object
            };

            // Save individual contract artifacts
            const artifactPath = path.join(BUILD_DIR, `${contractName}.json`);
            fs.writeFileSync(
                artifactPath,
                JSON.stringify(compiledContracts[contractName], null, 2)
            );

            console.log(`✅ Compiled: ${contractName}`);
            console.log(`   ABI entries: ${contract.abi.length}`);
            console.log(`   Bytecode size: ${(contract.evm.bytecode.object.length / 2).toLocaleString()} bytes`);
        }
    }
}

// Save combined artifacts
const allArtifacts = {
    timestamp: new Date().toISOString(),
    compiler: "solc 0.8.20",
    contracts: compiledContracts
};

fs.writeFileSync(
    path.join(BUILD_DIR, "contracts.json"),
    JSON.stringify(allArtifacts, null, 2)
);

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("🎉 COMPILATION COMPLETE!");
console.log("═══════════════════════════════════════════════════════════════");
console.log(`\n📁 Build artifacts saved to: ${BUILD_DIR}`);
console.log("\nFiles generated:");
console.log("   - FantasyYC_NFT.json");
console.log("   - PackOpener.json");
console.log("   - TournamentManager.json");
console.log("   - Marketplace.json");
console.log("   - contracts.json (combined)");
console.log("");
