// scripts/deploy-packnft-upgrade.js
// Deploy PackNFT (new contract) + Upgrade PackOpener & MarketplaceV2 + Configure cross-references
//
// Usage: node scripts/deploy-packnft-upgrade.js <network>
// Example: node scripts/deploy-packnft-upgrade.js shadownet

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const NETWORKS = {
    shadownet: {
        name: "Etherlink Shadownet Testnet",
        chainId: 127823,
        rpc: "https://node.shadownet.etherlink.com",
        explorer: "https://shadownet.explorer.etherlink.com"
    },
    mainnet: {
        name: "Etherlink Mainnet",
        chainId: 42793,
        rpc: "https://node.mainnet.etherlink.com",
        explorer: "https://explorer.etherlink.com"
    },
    megaeth: {
        name: "MegaETH Mainnet",
        chainId: 4326,
        rpc: "https://mainnet.megaeth.com/rpc",
        explorer: "https://megaeth.blockscout.com"
    }
};

async function main() {
    const networkArg = process.argv[2] || "shadownet";
    const network = NETWORKS[networkArg];

    if (!network) {
        console.error(`Unknown network: ${networkArg}`);
        process.exit(1);
    }

    console.log(`\n=== PackNFT Deploy + Upgrade (${network.name}) ===\n`);

    // Load deployment info
    const deploymentFile = path.join(__dirname, "..", `deployment-${networkArg}.json`);
    if (!fs.existsSync(deploymentFile)) {
        console.error(`Deployment file not found: deployment-${networkArg}.json`);
        console.error("Deploy the base contracts first with: node scripts/deploy.js " + networkArg);
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) { console.error("PRIVATE_KEY not set!"); process.exit(1); }

    const provider = new ethers.JsonRpcProvider(network.rpc);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`Deployer: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH/XTZ\n`);

    // Load build artifacts
    const buildDir = path.join(__dirname, "..", "build");
    const PackNFT = JSON.parse(fs.readFileSync(path.join(buildDir, "PackNFT.json"), "utf8"));
    const PackOpener = JSON.parse(fs.readFileSync(path.join(buildDir, "PackOpener.json"), "utf8"));
    const MarketplaceV2 = JSON.parse(fs.readFileSync(path.join(buildDir, "MarketplaceV2.json"), "utf8"));
    const ERC1967Proxy = JSON.parse(fs.readFileSync(path.join(buildDir, "ERC1967Proxy.json"), "utf8"));

    // ============ Step 1: Deploy PackNFT (new proxy) ============
    console.log("Step 1: Deploying PackNFT...");

    // Deploy implementation
    const packNftFactory = new ethers.ContractFactory(PackNFT.abi, PackNFT.bytecode, wallet);
    const packNftImpl = await packNftFactory.deploy();
    await packNftImpl.waitForDeployment();
    const packNftImplAddr = await packNftImpl.getAddress();
    console.log(`  Implementation: ${packNftImplAddr}`);

    // Encode initialize(owner)
    const packNftIface = new ethers.Interface(PackNFT.abi);
    const packNftInitData = packNftIface.encodeFunctionData("initialize", [wallet.address]);

    // Deploy proxy
    const proxyFactory = new ethers.ContractFactory(ERC1967Proxy.abi, ERC1967Proxy.bytecode, wallet);
    const packNftProxy = await proxyFactory.deploy(packNftImplAddr, packNftInitData);
    await packNftProxy.waitForDeployment();
    const packNftProxyAddr = await packNftProxy.getAddress();
    console.log(`  Proxy: ${packNftProxyAddr}`);
    console.log(`  Explorer: ${network.explorer}/address/${packNftProxyAddr}\n`);

    // ============ Step 2: Upgrade PackOpener ============
    console.log("Step 2: Upgrading PackOpener...");
    const packOpenerProxy = deployment.proxies.PackOpener;

    const poImplFactory = new ethers.ContractFactory(PackOpener.abi, PackOpener.bytecode, wallet);
    const poImpl = await poImplFactory.deploy();
    await poImpl.waitForDeployment();
    const poImplAddr = await poImpl.getAddress();
    console.log(`  New implementation: ${poImplAddr}`);

    const poContract = new ethers.Contract(packOpenerProxy, PackOpener.abi, wallet);
    const poTx = await poContract.upgradeToAndCall(poImplAddr, "0x");
    await poTx.wait();
    console.log(`  Upgrade confirmed: ${poTx.hash}\n`);

    // ============ Step 3: Upgrade MarketplaceV2 ============
    console.log("Step 3: Upgrading MarketplaceV2...");
    const marketplaceProxy = deployment.proxies.MarketplaceV2;

    const mpImplFactory = new ethers.ContractFactory(MarketplaceV2.abi, MarketplaceV2.bytecode, wallet);
    const mpImpl = await mpImplFactory.deploy();
    await mpImpl.waitForDeployment();
    const mpImplAddr = await mpImpl.getAddress();
    console.log(`  New implementation: ${mpImplAddr}`);

    const mpContract = new ethers.Contract(marketplaceProxy, MarketplaceV2.abi, wallet);
    const mpTx = await mpContract.upgradeToAndCall(mpImplAddr, "0x");
    await mpTx.wait();
    console.log(`  Upgrade confirmed: ${mpTx.hash}\n`);

    // ============ Step 4: Configure cross-references ============
    console.log("Step 4: Configuring cross-references...");

    const packNftContract = new ethers.Contract(packNftProxyAddr, PackNFT.abi, wallet);

    // 4a. Set PackOpener as authorized minter on PackNFT
    console.log("  Setting PackOpener as authorized minter on PackNFT...");
    const tx1 = await packNftContract.setAuthorizedMinter(packOpenerProxy, true);
    await tx1.wait();
    console.log("  Done.");

    // 4b. Set PackOpener as authorized burner on PackNFT
    console.log("  Setting PackOpener as authorized burner on PackNFT...");
    const tx2 = await packNftContract.setAuthorizedBurner(packOpenerProxy, true);
    await tx2.wait();
    console.log("  Done.");

    // 4c. Set PackNFT contract in PackOpener
    console.log("  Setting PackNFT in PackOpener...");
    const tx3 = await poContract.setPackNftContract(packNftProxyAddr);
    await tx3.wait();
    console.log("  Done.");

    // 4d. Set PackNFT contract in MarketplaceV2
    console.log("  Setting PackNFT in MarketplaceV2...");
    const tx4 = await mpContract.setPackNftContract(packNftProxyAddr);
    await tx4.wait();
    console.log("  Done.\n");

    // ============ Step 5: Update deployment file ============
    deployment.proxies.PackNFT = packNftProxyAddr;
    deployment.implementations.PackNFT = packNftImplAddr;
    deployment.implementations.PackOpener = poImplAddr;
    deployment.implementations.MarketplaceV2 = mpImplAddr;

    if (!deployment.upgradeHistory) deployment.upgradeHistory = [];
    deployment.upgradeHistory.push(
        { contract: "PackNFT", action: "deploy", proxy: packNftProxyAddr, implementation: packNftImplAddr, timestamp: new Date().toISOString() },
        { contract: "PackOpener", action: "upgrade", oldImplementation: deployment.implementations.PackOpener, newImplementation: poImplAddr, txHash: poTx.hash, timestamp: new Date().toISOString() },
        { contract: "MarketplaceV2", action: "upgrade", oldImplementation: deployment.implementations.MarketplaceV2, newImplementation: mpImplAddr, txHash: mpTx.hash, timestamp: new Date().toISOString() }
    );

    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log(`Updated ${path.basename(deploymentFile)}`);

    // ============ Summary ============
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("DEPLOYMENT + UPGRADE COMPLETE!");
    console.log("═══════════════════════════════════════════════════════════════\n");
    console.log(`PackNFT proxy:         ${packNftProxyAddr}`);
    console.log(`PackOpener proxy:      ${packOpenerProxy} (upgraded)`);
    console.log(`MarketplaceV2 proxy:   ${marketplaceProxy} (upgraded)`);
    console.log("");
    console.log("Cross-references configured:");
    console.log(`  PackNFT.authorizedMinter(PackOpener) = true`);
    console.log(`  PackNFT.authorizedBurner(PackOpener) = true`);
    console.log(`  PackOpener.packNftContract = ${packNftProxyAddr}`);
    console.log(`  MarketplaceV2.packNftContract = ${packNftProxyAddr}`);
    console.log("");
    console.log("IMPORTANT: Update front/lib/networks.ts with the PackNFT address:");
    console.log(`  PackNFT: '${packNftProxyAddr}'`);
    console.log("");
}

main()
    .then(() => { console.log("Done."); process.exit(0); })
    .catch((error) => { console.error("FAILED:", error); process.exit(1); });
