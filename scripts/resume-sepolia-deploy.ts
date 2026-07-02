/**
 * Resume a partial Sepolia deploy after RPC disconnect.
 * Update PARTIAL below if re-running from a different checkpoint.
 */
const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
import { wireAllContracts } from "./lib/timelockWiring";

const SEMAPHORE_ADDRESS = process.env.SEMAPHORE_ADDRESS || "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";

const PARTIAL = {
    AnonymousPatientRegistry: "0x7cd9Eae8A4935B9e1c0DC673B312Fa6aB0d33a6E",
    SponsorRegistry: "0xb7A1705B9b38C7B074eBdE995D4565b0088948A3",
    TrialManager: "0x3E0DF9f3b8B70D50b7De9a0bA485A9Df7895C8D9",
    ConsentManager: "0xBD0b094285E89eFc1035340326BCD525acA07c8c",
    DataAccessLog: "0xD34D36438802B03774E96E671a04dA2c9f12AAfC",
    EligibilityEngine: "0x07CC826AfE24246710fE5bA3AD257A2E3e8fa44f",
    HonkVerifier: "0x63C09C8aDF955e13B56dA9CdC8eEF7782A558927",
    EncryptedConsentGate: "0x6f748863802df739b7687c524A5b1DA33a44c06D",
    EncryptedScoreLeaderboard: "0x3Eb582f677938a1C13b3E4aA29a2a5B6649310e4",
    ConfidentialETH: "0x2EdE161DA46750AFce5717Ec29e78909deaDB84c",
};

async function deploymentStartBlock(contract: { deploymentTransaction: () => { hash: string } | null }) {
    const dep = contract.deploymentTransaction();
    if (!dep) return 0;
    const rec = await ethers.provider.getTransactionReceipt(dep.hash);
    return rec ? Number(rec.blockNumber) : 0;
}

async function fetchCreationBlock(address: string): Promise<number> {
    const url = `https://api-sepolia.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
    const res = await fetch(url);
    const json = (await res.json()) as { status: string; result: Array<{ contractAddress: string; txHash: string }> };
    if (json.status !== "1" || !json.result?.[0]?.txHash) return 0;
    const rec = await ethers.provider.getTransactionReceipt(json.result[0].txHash);
    return rec ? Number(rec.blockNumber) : 0;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Resuming deploy as ${deployer.address} on ${hre.network.name}\n`);

    const {
        AnonymousPatientRegistry: anonymousRegistryAddress,
        SponsorRegistry: sponsorRegistryAddress,
        TrialManager: trialManagerAddress,
        ConsentManager: consentManagerAddress,
        DataAccessLog: dataAccessLogAddress,
        EligibilityEngine: engineAddress,
        HonkVerifier: honkVerifierAddress,
        EncryptedConsentGate: consentGateAddress,
        EncryptedScoreLeaderboard: leaderboardAddress,
        ConfidentialETH: cETHAddress,
    } = PARTIAL;

    const SponsorIncentiveVault = await ethers.getContractFactory("SponsorIncentiveVault");
    const vault = await SponsorIncentiveVault.deploy(cETHAddress, trialManagerAddress, engineAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✓ SponsorIncentiveVault   → ${vaultAddress}`);

    const TrialMilestoneManager = await ethers.getContractFactory("TrialMilestoneManager");
    const milestoneManager = await TrialMilestoneManager.deploy(trialManagerAddress);
    await milestoneManager.waitForDeployment();
    const milestoneManagerAddress = await milestoneManager.getAddress();
    console.log(`✓ TrialMilestoneManager   → ${milestoneManagerAddress}`);

    const MedVaultAutomation = await ethers.getContractFactory("MedVaultAutomation");
    const chainlinkForwarder =
        process.env.CHAINLINK_FORWARDER?.trim() || deployer.address;
    const automation = await MedVaultAutomation.deploy(trialManagerAddress, vaultAddress, chainlinkForwarder);
    await automation.waitForDeployment();
    const automationAddress = await automation.getAddress();
    console.log(`✓ MedVaultAutomation      → ${automationAddress} (forwarder: ${chainlinkForwarder})`);

    const StakingManager = await ethers.getContractFactory("StakingManager");
    const AAVE_POOL = process.env.AAVE_POOL || "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
    const WETH_GATEWAY = process.env.WETH_GATEWAY || "0x20040a64612555042335926d72B4E5F667a67fA1";
    const AWETH = process.env.AWETH || "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";
    const stakingManager = await StakingManager.deploy(cETHAddress, AAVE_POOL, WETH_GATEWAY, AWETH);
    await stakingManager.waitForDeployment();
    const stakingManagerAddress = await stakingManager.getAddress();
    console.log(`✓ StakingManager          → ${stakingManagerAddress}`);

    const MedVaultRegistry = await ethers.getContractFactory("MedVaultRegistry");
    const medVaultRegistry = await MedVaultRegistry.deploy(
        SEMAPHORE_ADDRESS,
        anonymousRegistryAddress,
        engineAddress
    );
    await medVaultRegistry.waitForDeployment();
    const medVaultRegistryAddress = await medVaultRegistry.getAddress();
    console.log(`✓ MedVaultRegistry        → ${medVaultRegistryAddress}`);

    const subgraphStartBlocks: Record<string, number> = {
        SponsorIncentiveVault: await deploymentStartBlock(vault),
        TrialMilestoneManager: await deploymentStartBlock(milestoneManager),
        StakingManager: await deploymentStartBlock(stakingManager),
        MedVaultRegistry: await deploymentStartBlock(medVaultRegistry),
    };

    console.log("Fetching deployment blocks for partial contracts...");
    for (const [name, addr] of Object.entries(PARTIAL)) {
        if (subgraphStartBlocks[name] != null) continue;
        const block = await fetchCreationBlock(addr);
        if (block > 0) subgraphStartBlocks[name] = block;
        console.log(`  ${name}: ${block || "unknown"}`);
    }

    console.log("\nWiring contracts (timelocked setters)...");
    const anonymousRegistry = await ethers.getContractAt("AnonymousPatientRegistry", anonymousRegistryAddress);
    const trialManager = await ethers.getContractAt("TrialManager", trialManagerAddress);
    const engine = await ethers.getContractAt("EligibilityEngine", engineAddress);
    const cETH = await ethers.getContractAt("ConfidentialETH", cETHAddress);
    const dataAccessLog = await ethers.getContractAt("DataAccessLog", dataAccessLogAddress);
    const leaderboard = await ethers.getContractAt("EncryptedScoreLeaderboard", leaderboardAddress);
    const consentGate = await ethers.getContractAt("EncryptedConsentGate", consentGateAddress);
    const consentManager = await ethers.getContractAt("ConsentManager", consentManagerAddress);

    const trustedRelayer =
        process.env.TRUSTED_RELAYER_ADDRESS ||
        (process.env.RELAYER_PRIVATE_KEY
            ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address
            : undefined);

    await wireAllContracts({
        anonymousRegistry,
        trialManager,
        engine,
        consentManager,
        vault,
        milestoneManager,
        automation,
        cETH,
        dataAccessLog,
        leaderboard,
        consentGate,
        medVaultRegistry,
        honkVerifierAddress,
        sponsorRegistryAddress,
        stakingManagerAddress,
        trustedRelayer,
    });

    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const existing = fs.existsSync(addressesPath) ? JSON.parse(fs.readFileSync(addressesPath, "utf8")) : {};

    const newAddresses = {
        ...PARTIAL,
        MedVaultRegistry: medVaultRegistryAddress,
        EligibilityVerifier: honkVerifierAddress,
        SponsorIncentiveVault: vaultAddress,
        TrialMilestoneManager: milestoneManagerAddress,
        MedVaultAutomation: automationAddress,
        StakingManager: stakingManagerAddress,
        Semaphore: SEMAPHORE_ADDRESS,
    };

    existing.sepolia = { ...(existing.sepolia || {}), ...newAddresses };
    fs.writeFileSync(addressesPath, JSON.stringify(existing, null, 4));
    console.log("\n✓ addresses.json updated (sepolia)");

    const sbPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
    let startBlocks: Record<string, number> = {};
    if (fs.existsSync(sbPath)) {
        startBlocks = JSON.parse(fs.readFileSync(sbPath, "utf8"));
    }
    Object.assign(startBlocks, subgraphStartBlocks);
    fs.writeFileSync(sbPath, JSON.stringify(startBlocks, null, 4));

    try {
        execSync(`node ${path.join(__dirname, "update-subgraph-yaml.js")} sepolia`, {
            stdio: "inherit",
            cwd: path.join(__dirname, ".."),
        });
    } catch (e) {
        console.warn("update-subgraph-yaml.js failed:", e);
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("         RESUME DEPLOYMENT COMPLETE (sepolia)");
    console.log("═══════════════════════════════════════════════");
    for (const [name, address] of Object.entries(newAddresses)) {
        console.log(`  ${name.padEnd(26)} ${address}`);
    }
    console.log("═══════════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
