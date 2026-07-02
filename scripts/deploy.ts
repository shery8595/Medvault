const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
import { wireAllContracts, wireAutomationForwarder, ensureFhevmInitialized } from "./lib/timelockWiring";
import { deployAnonymousPatientRegistry } from "./lib/deployAnonymousPatientRegistry";

function resolveNetworkName(name: string) {
    return name === "sepolia" ? "sepolia" : "hardhat";
}

/** Block where the contract bytecode was first deployed (The Graph startBlock). */
async function deploymentStartBlock(contract: { deploymentTransaction: () => { hash: string } | null }) {
    const dep = contract.deploymentTransaction();
    if (!dep) return 0;
    const rec = await ethers.provider.getTransactionReceipt(dep.hash);
    return rec ? Number(rec.blockNumber) : 0;
}

/** Deploy a linked library contract and return its address. */
async function deployLibrary(libName: string, libraries: Record<string, string> = {}): Promise<string> {
    const factory = await ethers.getContractFactory(libName, { libraries });
    const lib = await factory.deploy();
    await lib.waitForDeployment();
    const address = await lib.getAddress();
    console.log(`✓ ${libName}              → ${address}`);
    return address;
}

async function deploySponsorIncentiveVaultLibraries(): Promise<Record<string, string>> {
    const vaultDistributionLibAddress = await deployLibrary("VaultDistributionLib");
    const vaultConfidentialLibAddress = await deployLibrary("VaultConfidentialLib");
    const vaultTimelockLibAddress = await deployLibrary("VaultTimelockLib");
    const vaultRegistrationLibAddress = await deployLibrary("VaultRegistrationLib");
    const vaultClaimLibAddress = await deployLibrary("VaultClaimLib");
    const vaultReclaimLibAddress = await deployLibrary("VaultReclaimLib", {
        VaultDistributionLib: vaultDistributionLibAddress,
    });
    const vaultChallengeLibAddress = await deployLibrary("VaultChallengeLib", {
        VaultDistributionLib: vaultDistributionLibAddress,
    });
    return {
        VaultDistributionLib: vaultDistributionLibAddress,
        VaultConfidentialLib: vaultConfidentialLibAddress,
        VaultTimelockLib: vaultTimelockLibAddress,
        VaultRegistrationLib: vaultRegistrationLibAddress,
        VaultClaimLib: vaultClaimLibAddress,
        VaultReclaimLib: vaultReclaimLibAddress,
        VaultChallengeLib: vaultChallengeLibAddress,
    };
}

async function main() {
    console.log("Starting full MedVault deployment (all contracts + wiring)...\n");

    const networkName = resolveNetworkName(hre.network.name);
    const SEMAPHORE_ADDRESS = process.env.SEMAPHORE_ADDRESS || "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Network: ${hre.network.name} (${networkName})\n`);

    await ensureFhevmInitialized();

    const anonymousRegistry = await deployAnonymousPatientRegistry();
    const anonymousRegistryAddress = await anonymousRegistry.getAddress();
    console.log(`✓ AnonymousPatientRegistry → ${anonymousRegistryAddress}`);

    const SponsorRegistry = await ethers.getContractFactory("SponsorRegistry");
    const sponsorRegistry = await SponsorRegistry.deploy();
    await sponsorRegistry.waitForDeployment();
    const sponsorRegistryAddress = await sponsorRegistry.getAddress();
    console.log(`✓ SponsorRegistry         → ${sponsorRegistryAddress}`);

    const isTestnet = hre.network.name !== "mainnet";
    const AAVE_POOL = process.env.AAVE_POOL || "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
    const WETH_GATEWAY = process.env.WETH_GATEWAY || "0x20040a64612555042335926d72B4E5F667a67fA1";
    const AWETH = process.env.AWETH || "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";

    const TrialManager = await ethers.getContractFactory("TrialManager");
    const trialManager = await TrialManager.deploy(sponsorRegistryAddress, isTestnet);
    await trialManager.waitForDeployment();
    const trialManagerAddress = await trialManager.getAddress();
    console.log(`✓ TrialManager            → ${trialManagerAddress}`);

    const ConsentManager = await ethers.getContractFactory("ConsentManager");
    const consentManager = await ConsentManager.deploy(isTestnet);
    await consentManager.waitForDeployment();
    const consentManagerAddress = await consentManager.getAddress();
    console.log(`✓ ConsentManager          → ${consentManagerAddress}`);

    const DataAccessLog = await ethers.getContractFactory("DataAccessLog");
    const dataAccessLog = await DataAccessLog.deploy();
    await dataAccessLog.waitForDeployment();
    const dataAccessLogAddress = await dataAccessLog.getAddress();
    console.log(`✓ DataAccessLog           → ${dataAccessLogAddress}`);

    const eligibilityComputeLibAddress = await deployLibrary("EligibilityComputeLib");
    const eligibilityProofLibAddress = await deployLibrary("EligibilityProofLib");
    const EligibilityEngine = await ethers.getContractFactory("EligibilityEngine", {
        libraries: {
            EligibilityComputeLib: eligibilityComputeLibAddress,
            EligibilityProofLib: eligibilityProofLibAddress,
        },
    });
    const engine = await EligibilityEngine.deploy(anonymousRegistryAddress, trialManagerAddress, consentManagerAddress);
    await engine.waitForDeployment();
    const engineAddress = await engine.getAddress();
    console.log(`✓ EligibilityEngine       → ${engineAddress}`);

    const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
    const honkVerifier = await HonkVerifier.deploy();
    await honkVerifier.waitForDeployment();
    const honkVerifierAddress = await honkVerifier.getAddress();
    console.log(`✓ HonkVerifier (plaintext)  → ${honkVerifierAddress}`);

    const HonkVerifierEncrypted = await ethers.getContractFactory("HonkVerifierEncrypted");
    const honkVerifierEncrypted = await HonkVerifierEncrypted.deploy();
    await honkVerifierEncrypted.waitForDeployment();
    const honkVerifierEncryptedAddress = await honkVerifierEncrypted.getAddress();
    console.log(`✓ HonkVerifierEncrypted       → ${honkVerifierEncryptedAddress}`);

    const EncryptedConsentGate = await ethers.getContractFactory("EncryptedConsentGate");
    const consentGate = await EncryptedConsentGate.deploy(engineAddress, consentManagerAddress);
    await consentGate.waitForDeployment();
    const consentGateAddress = await consentGate.getAddress();
    console.log(`✓ EncryptedConsentGate    → ${consentGateAddress}`);

    const EncryptedScoreLeaderboard = await ethers.getContractFactory("EncryptedScoreLeaderboard");
    const leaderboard = await EncryptedScoreLeaderboard.deploy(engineAddress);
    await leaderboard.waitForDeployment();
    const leaderboardAddress = await leaderboard.getAddress();
    console.log(`✓ EncryptedScoreLeaderboard → ${leaderboardAddress}`);

    const ConfidentialETH7984 = await ethers.getContractFactory("ConfidentialETH7984");
    const cETH = await ConfidentialETH7984.deploy();
    await cETH.waitForDeployment();
    const cETHAddress = await cETH.getAddress();
    console.log(`✓ ConfidentialETH7984 (IERC7984) → ${cETHAddress}`);

    const vaultLibraries = await deploySponsorIncentiveVaultLibraries();
    const SponsorIncentiveVault = await ethers.getContractFactory("SponsorIncentiveVault", {
        libraries: vaultLibraries,
    });
    const vault = await SponsorIncentiveVault.deploy(cETHAddress, trialManagerAddress, engineAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✓ SponsorIncentiveVault   → ${vaultAddress}`);

    const TrialMilestoneManager = await ethers.getContractFactory("TrialMilestoneManager");
    const milestoneManager = await TrialMilestoneManager.deploy(trialManagerAddress);
    await milestoneManager.waitForDeployment();
    const milestoneManagerAddress = await milestoneManager.getAddress();
    console.log(`✓ TrialMilestoneManager   → ${milestoneManagerAddress}`);

    const PatientDocumentStore = await ethers.getContractFactory("PatientDocumentStore");
    const patientDocumentStore = await PatientDocumentStore.deploy(trialManagerAddress);
    await patientDocumentStore.waitForDeployment();
    const patientDocumentStoreAddress = await patientDocumentStore.getAddress();
    console.log(`✓ PatientDocumentStore    → ${patientDocumentStoreAddress}`);

    const chainlinkForwarder =
        process.env.CHAINLINK_FORWARDER?.trim() || deployer.address;
    const MedVaultAutomation = await ethers.getContractFactory("MedVaultAutomation");
    const automation = await MedVaultAutomation.deploy(trialManagerAddress, vaultAddress, chainlinkForwarder);
    await automation.waitForDeployment();
    const automationAddress = await automation.getAddress();
    console.log(`✓ MedVaultAutomation      → ${automationAddress} (forwarder: ${chainlinkForwarder})`);

    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(cETHAddress, AAVE_POOL, WETH_GATEWAY, AWETH);
    await stakingManager.waitForDeployment();
    const stakingManagerAddress = await stakingManager.getAddress();
    console.log(`✓ StakingManager          → ${stakingManagerAddress}`);

    let medVaultRegistryAddress = ethers.ZeroAddress;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let medVaultRegistry: any = null;
    if (hre.network.name !== "hardhat") {
        const MedVaultRegistry = await ethers.getContractFactory("MedVaultRegistry");
        medVaultRegistry = await MedVaultRegistry.deploy(SEMAPHORE_ADDRESS, anonymousRegistryAddress, engineAddress);
        await medVaultRegistry.waitForDeployment();
        medVaultRegistryAddress = await medVaultRegistry.getAddress();
        console.log(`✓ MedVaultRegistry        → ${medVaultRegistryAddress}`);
    } else {
        console.log("⊘ MedVaultRegistry        → SKIPPED on hardhat network");
    }

    const subgraphStartBlocks: Record<string, number> = {
        AnonymousPatientRegistry: await deploymentStartBlock(anonymousRegistry),
        SponsorRegistry: await deploymentStartBlock(sponsorRegistry),
        TrialManager: await deploymentStartBlock(trialManager),
        ConsentManager: await deploymentStartBlock(consentManager),
        DataAccessLog: await deploymentStartBlock(dataAccessLog),
        EligibilityEngine: await deploymentStartBlock(engine),
        SponsorIncentiveVault: await deploymentStartBlock(vault),
        TrialMilestoneManager: await deploymentStartBlock(milestoneManager),
        StakingManager: await deploymentStartBlock(stakingManager),
        ConfidentialETH: await deploymentStartBlock(cETH),
        MedVaultAutomation: await deploymentStartBlock(automation),
        EncryptedConsentGate: await deploymentStartBlock(consentGate),
        EncryptedScoreLeaderboard: await deploymentStartBlock(leaderboard),
        PatientDocumentStore: await deploymentStartBlock(patientDocumentStore),
    };
    if (medVaultRegistry) {
        subgraphStartBlocks.MedVaultRegistry = await deploymentStartBlock(medVaultRegistry);
    }

    console.log("\nWiring contracts (timelocked setters; hardhat auto-applies after 2d skip)...");

    const trustedRelayer =
        process.env.TRUSTED_RELAYER_ADDRESS ||
        (process.env.RELAYER_PRIVATE_KEY
            ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address
            : "");

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
        patientDocumentStore,
        honkVerifierAddress,
        honkVerifierEncryptedAddress,
        sponsorRegistryAddress,
        stakingManagerAddress,
        trustedRelayer: trustedRelayer && ethers.isAddress(trustedRelayer) ? trustedRelayer : undefined,
    });

    const realForwarder = process.env.CHAINLINK_FORWARDER?.trim();
    if (realForwarder && ethers.isAddress(realForwarder) && realForwarder !== chainlinkForwarder) {
        await wireAutomationForwarder(automation, realForwarder);
    }

    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const existing = fs.existsSync(addressesPath) ? JSON.parse(fs.readFileSync(addressesPath, "utf8")) : {};

    const newAddresses = {
        AnonymousPatientRegistry: anonymousRegistryAddress,
        SponsorRegistry: sponsorRegistryAddress,
        TrialManager: trialManagerAddress,
        ConsentManager: consentManagerAddress,
        DataAccessLog: dataAccessLogAddress,
        MedVaultRegistry: medVaultRegistryAddress,
        EligibilityEngine: engineAddress,
        HonkVerifier: honkVerifierAddress,
        EligibilityVerifier: honkVerifierAddress,
        HonkVerifierEncrypted: honkVerifierEncryptedAddress,
        EncryptedConsentGate: consentGateAddress,
        EncryptedScoreLeaderboard: leaderboardAddress,
        SponsorIncentiveVault: vaultAddress,
        TrialMilestoneManager: milestoneManagerAddress,
        MedVaultAutomation: automationAddress,
        ConfidentialETH: cETHAddress,
        StakingManager: stakingManagerAddress,
        PatientDocumentStore: patientDocumentStoreAddress,
        EligibilityComputeLib: eligibilityComputeLibAddress,
        EligibilityProofLib: eligibilityProofLibAddress,
        ...vaultLibraries,
        Semaphore: SEMAPHORE_ADDRESS
    };

    existing[networkName] = {
        ...(existing[networkName] || {}),
        ...newAddresses
    };

    fs.writeFileSync(addressesPath, JSON.stringify(existing, null, 4));
    console.log(`\n✓ addresses.json updated (${networkName})`);

    if (networkName === "sepolia" && hre.network.name === "sepolia") {
        const sbFile = "sepolia-start-blocks.json";
        const sbPath = path.join(__dirname, "../subgraph", sbFile);
        fs.writeFileSync(sbPath, JSON.stringify(subgraphStartBlocks, null, 4));
        console.log(`✓ subgraph/${sbFile} written (deployment start blocks)`);
        try {
            execSync(`node ${path.join(__dirname, "update-subgraph-yaml.js")}`, {
                stdio: "inherit",
                cwd: path.join(__dirname, "..")
            });
        } catch (e) {
            console.warn("update-subgraph-yaml.js failed (subgraph will need manual startBlock/address update):", e);
        }
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log(`         DEPLOYMENT COMPLETE (${networkName})`);
    console.log("═══════════════════════════════════════════════");
    for (const [name, address] of Object.entries(newAddresses)) {
        console.log(`  ${name.padEnd(26)} ${address}`);
    }
    console.log("═══════════════════════════════════════════════");
    if (hre.network.name === "sepolia") {
        console.log("\nNote: timelocked wiring may need scripts/finish-wiring.ts after 6 hours on live networks.");
    }
    console.log("");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
