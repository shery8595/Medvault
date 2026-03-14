const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
    const network = "sepolia";

    const trialManagerAddress = addresses[network].TrialManager;
    const cETHAddress = addresses[network].ConfidentialETH;

    console.log("Starting Remaining Contracts Deployment...");

    // 1. Deploy SponsorRegistry
    console.log("\n1. Deploying SponsorRegistry...");
    const SponsorRegistry = await ethers.getContractFactory("SponsorRegistry");
    const sponsorRegistry = await SponsorRegistry.deploy();
    await sponsorRegistry.waitForDeployment();
    const sponsorRegistryAddress = await sponsorRegistry.getAddress();
    console.log(`SponsorRegistry deployed to: ${sponsorRegistryAddress}`);

    // 2. Deploy StakingManager
    console.log("\n2. Deploying StakingManager...");
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(cETHAddress);
    await stakingManager.waitForDeployment();
    const stakingManagerAddress = await stakingManager.getAddress();
    console.log(`StakingManager deployed to: ${stakingManagerAddress}`);

    // 3. Wiring
    console.log("\n3. Wiring...");

    // Link TrialManager to SponsorRegistry
    console.log("Linking TrialManager to SponsorRegistry...");
    const TrialManager = await ethers.getContractFactory("TrialManager");
    const trialManager = TrialManager.attach(trialManagerAddress);
    await (await trialManager.setSponsorRegistry(sponsorRegistryAddress)).wait();

    // Authorize StakingManager on ConfidentialETH
    console.log("Authorizing StakingManager on ConfidentialETH...");
    const ConfidentialETH = await ethers.getContractFactory("ConfidentialETH");
    const cETH = ConfidentialETH.attach(cETHAddress);
    await (await cETH.authorizeContract(stakingManagerAddress)).wait();

    console.log("✓ Wiring Complete.");

    // 4. Update addresses.json
    addresses[network].SponsorRegistry = sponsorRegistryAddress;
    addresses[network].StakingManager = stakingManagerAddress;

    fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 4));
    console.log("\n✓ addresses.json updated successfully.");

    console.log("\nRemaining Contracts Deployment Successful!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
