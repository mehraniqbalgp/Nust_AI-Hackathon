/**
 * Deploy TruthToken and RumorLedger contracts
 */

const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    console.log("");

    // Deploy TruthToken
    console.log("📦 Deploying TruthToken...");
    const TruthToken = await ethers.getContractFactory("TruthToken");
    const initialSupply = 1000000; // 1 million tokens
    const truthToken = await TruthToken.deploy(initialSupply);
    await truthToken.waitForDeployment();
    const truthTokenAddress = await truthToken.getAddress();
    console.log("   ✅ TruthToken deployed to:", truthTokenAddress);
    console.log("   Initial supply:", initialSupply, "TRUTH");
    console.log("");

    // Deploy RumorLedger
    console.log("📦 Deploying RumorLedger...");
    const RumorLedger = await ethers.getContractFactory("RumorLedger");
    const rumorLedger = await RumorLedger.deploy();
    await rumorLedger.waitForDeployment();
    const rumorLedgerAddress = await rumorLedger.getAddress();
    console.log("   ✅ RumorLedger deployed to:", rumorLedgerAddress);
    console.log("");

    // Summary
    console.log("═══════════════════════════════════════════════");
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("═══════════════════════════════════════════════");
    console.log("");
    console.log("TruthToken:   ", truthTokenAddress);
    console.log("RumorLedger:  ", rumorLedgerAddress);
    console.log("");
    console.log("Add to your .env file:");
    console.log(`TRUTH_TOKEN_ADDRESS=${truthTokenAddress}`);
    console.log(`RUMOR_LEDGER_ADDRESS=${rumorLedgerAddress}`);
    console.log("");

    // Verify on block explorer (if not local)
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 31337n) {
        console.log("⏳ Waiting for block confirmations...");
        await truthToken.deploymentTransaction().wait(5);
        await rumorLedger.deploymentTransaction().wait(5);

        console.log("🔍 Verifying contracts on block explorer...");

        try {
            await hre.run("verify:verify", {
                address: truthTokenAddress,
                constructorArguments: [initialSupply]
            });
            console.log("   ✅ TruthToken verified");
        } catch (e) {
            console.log("   ⚠️ TruthToken verification failed:", e.message);
        }

        try {
            await hre.run("verify:verify", {
                address: rumorLedgerAddress,
                constructorArguments: []
            });
            console.log("   ✅ RumorLedger verified");
        } catch (e) {
            console.log("   ⚠️ RumorLedger verification failed:", e.message);
        }
    }

    console.log("");
    console.log("🎉 Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
