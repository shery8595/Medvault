/**
 * Upgrade Noir attestation stack on Ethereum Sepolia (partial redeploy):
 * - HonkVerifier (plaintext) + HonkVerifierEncrypted (encrypted criteria)
 * - New EligibilityEngine + dependent registry/consent/leaderboard/vault
 *
 * Prefer `npm run deploy:sepolia` for greenfield. This script keeps existing TrialManager, APR, etc.
 *
 * Usage:
 *   npm run build:circuit
 *   npx hardhat run scripts/upgrade-attestation-sepolia.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ensureDataAccessLogger } from "./data-access-log-wiring";
import {
    advanceTimelockIfHardhat,
    ensureCethContractAuth,
    wireAllContracts,
} from "./lib/timelockWiring";

const SEMAPHORE_ADDRESS = process.env.SEMAPHORE_ADDRESS || "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D";
const VK_FINGERPRINT_FILE = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");

function networkKey(): string {
    return hre.network.name === "sepolia" ? "sepolia" : hre.network.name;
}

async function deployBlock(contract: { deploymentTransaction: () => { hash: string } | null }) {
    const dep = contract.deploymentTransaction();
    if (!dep) return await ethers.provider.getBlockNumber();
    const rec = await dep.wait();
    return rec ? Number(rec.blockNumber) : await ethers.provider.getBlockNumber();
}

async function deployLibrary(libName: string, libraries: Record<string, string> = {}): Promise<string> {
    const factory = await ethers.getContractFactory(libName, { libraries });
    const lib = await factory.deploy();
    await lib.waitForDeployment();
    const address = await lib.getAddress();
    console.log(`✓ ${libName}              → ${address}`);
    return address;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const key = networkKey();
    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const all = JSON.parse(fs.readFileSync(addressesPath, "utf8")) as Record<string, Record<string, string>>;
    const current = all[key];
    if (!current) throw new Error(`No addresses for "${key}"`);

    const OLD = {
        EligibilityEngine: current.EligibilityEngine,
        HonkVerifier: current.HonkVerifier || current.EligibilityVerifier,
        MedVaultRegistry: current.MedVaultRegistry,
        SponsorIncentiveVault: current.SponsorIncentiveVault,
        EncryptedConsentGate: current.EncryptedConsentGate,
        EncryptedScoreLeaderboard: current.EncryptedScoreLeaderboard,
    };

    const KEEP = {
        AnonymousPatientRegistry: current.AnonymousPatientRegistry,
        SponsorRegistry: current.SponsorRegistry,
        TrialManager: current.TrialManager,
        ConsentManager: current.ConsentManager,
        DataAccessLog: current.DataAccessLog,
        ConfidentialETH: current.ConfidentialETH,
        StakingManager: current.StakingManager,
        TrialMilestoneManager: current.TrialMilestoneManager,
        MedVaultAutomation: current.MedVaultAutomation,
    };

    console.log(`\nDeployer: ${deployer.address}`);
    console.log(`Network:  ${hre.network.name}\n`);

    const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
    const honkVerifier = await HonkVerifier.deploy();
    await honkVerifier.waitForDeployment();
    const honkVerifierAddress = await honkVerifier.getAddress();
    const honkBlock = await deployBlock(honkVerifier);
    console.log(`✓ HonkVerifier (plaintext)  → ${honkVerifierAddress} (block ${honkBlock})`);

    const HonkVerifierEncrypted = await ethers.getContractFactory("HonkVerifierEncrypted");
    const honkVerifierEncrypted = await HonkVerifierEncrypted.deploy();
    await honkVerifierEncrypted.waitForDeployment();
    const honkVerifierEncryptedAddress = await honkVerifierEncrypted.getAddress();
    const honkEncBlock = await deployBlock(honkVerifierEncrypted);
    console.log(`✓ HonkVerifierEncrypted       → ${honkVerifierEncryptedAddress} (block ${honkEncBlock})`);

    const EligibilityEngine = await ethers.getContractFactory("EligibilityEngine", {
        libraries: {
            EligibilityComputeLib: await deployLibrary("EligibilityComputeLib"),
            EligibilityProofLib: await deployLibrary("EligibilityProofLib"),
        },
    });
    const engine = await EligibilityEngine.deploy(
        KEEP.AnonymousPatientRegistry,
        KEEP.TrialManager,
        KEEP.ConsentManager
    );
    await engine.waitForDeployment();
    const engineAddress = await engine.getAddress();
    const engineBlock = await deployBlock(engine);
    console.log(`✓ EligibilityEngine       → ${engineAddress} (block ${engineBlock})`);

    const EncryptedConsentGate = await ethers.getContractFactory("EncryptedConsentGate");
    const consentGate = await EncryptedConsentGate.deploy(engineAddress, KEEP.ConsentManager);
    await consentGate.waitForDeployment();
    const consentGateAddress = await consentGate.getAddress();
    console.log(`✓ EncryptedConsentGate    → ${consentGateAddress}`);

    const EncryptedScoreLeaderboard = await ethers.getContractFactory("EncryptedScoreLeaderboard");
    const leaderboard = await EncryptedScoreLeaderboard.deploy(engineAddress);
    await leaderboard.waitForDeployment();
    const leaderboardAddress = await leaderboard.getAddress();
    console.log(`✓ EncryptedScoreLeaderboard → ${leaderboardAddress}`);

    const MedVaultRegistry = await ethers.getContractFactory("MedVaultRegistry");
    const medVaultRegistry = await MedVaultRegistry.deploy(
        SEMAPHORE_ADDRESS,
        KEEP.AnonymousPatientRegistry,
        engineAddress
    );
    await medVaultRegistry.waitForDeployment();
    const medVaultRegistryAddress = await medVaultRegistry.getAddress();
    const registryBlock = await deployBlock(medVaultRegistry);
    console.log(`✓ MedVaultRegistry        → ${medVaultRegistryAddress} (block ${registryBlock})`);

    const SponsorIncentiveVault = await ethers.getContractFactory("SponsorIncentiveVault");
    const vault = await SponsorIncentiveVault.deploy(
        KEEP.ConfidentialETH,
        KEEP.TrialManager,
        engineAddress
    );
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    const vaultBlock = await deployBlock(vault);
    console.log(`✓ SponsorIncentiveVault   → ${vaultAddress} (block ${vaultBlock})`);

    console.log("\nWiring contracts...");

    const anonymousRegistry = await ethers.getContractAt(
        "AnonymousPatientRegistry",
        KEEP.AnonymousPatientRegistry
    );
    const trialManager = await ethers.getContractAt("TrialManager", KEEP.TrialManager);
    const consentManager = await ethers.getContractAt("ConsentManager", KEEP.ConsentManager);
    const dataAccessLog = await ethers.getContractAt("DataAccessLog", KEEP.DataAccessLog);
    const cETH = await ethers.getContractAt("ConfidentialETH", KEEP.ConfidentialETH);
    const milestoneManager = await ethers.getContractAt(
        "TrialMilestoneManager",
        KEEP.TrialMilestoneManager
    );
    const automation = await ethers.getContractAt("MedVaultAutomation", KEEP.MedVaultAutomation);

    await advanceTimelockIfHardhat();

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
        honkVerifierEncryptedAddress,
        sponsorRegistryAddress: KEEP.SponsorRegistry,
        stakingManagerAddress: KEEP.StakingManager,
        trustedRelayer:
            process.env.TRUSTED_RELAYER_ADDRESS ||
            (process.env.RELAYER_PRIVATE_KEY
                ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address
                : undefined),
    });

    if (OLD.SponsorIncentiveVault) {
        try {
            await ensureCethContractAuth(cETH, OLD.SponsorIncentiveVault, false);
            console.log("✓ Deauthorized old vault on cETH");
        } catch {
            console.warn("  (skip cETH deauthorize old vault)");
        }
        try {
            await ensureDataAccessLogger(dataAccessLog, OLD.SponsorIncentiveVault, false);
        } catch {
            /* ignore */
        }
    }

    if (OLD.EligibilityEngine) {
        try {
            await ensureDataAccessLogger(dataAccessLog, OLD.EligibilityEngine, false);
        } catch {
            /* ignore */
        }
    }

    const inputCount = await engine.ELIGIBILITY_PUBLIC_INPUT_COUNT();
    const schemaHash = await engine.CRITERIA_SCHEMA_HASH();
    console.log(`\nOn-chain attestation check: publicInputs=${inputCount}, schema=${schemaHash}`);

    let vkPlainFingerprint: string | undefined;
    let vkEncryptedFingerprint: string | undefined;
    if (fs.existsSync(VK_FINGERPRINT_FILE)) {
        const fp = JSON.parse(fs.readFileSync(VK_FINGERPRINT_FILE, "utf8"));
        vkPlainFingerprint = fp.plaintext?.sha256 ?? fp.sha256;
        vkEncryptedFingerprint = fp.encrypted?.sha256;
    }

    const updated = {
        ...KEEP,
        MedVaultRegistry: medVaultRegistryAddress,
        EligibilityEngine: engineAddress,
        HonkVerifier: honkVerifierAddress,
        EligibilityVerifier: honkVerifierAddress,
        HonkVerifierEncrypted: honkVerifierEncryptedAddress,
        EncryptedConsentGate: consentGateAddress,
        EncryptedScoreLeaderboard: leaderboardAddress,
        SponsorIncentiveVault: vaultAddress,
        Semaphore: SEMAPHORE_ADDRESS,
        Reclaim: current.Reclaim,
        ReclaimSemaphore: current.ReclaimSemaphore,
        SemaphoreVerifier: current.SemaphoreVerifier,
        ...(vkPlainFingerprint ? { HonkVerifierVkFingerprint: vkPlainFingerprint } : {}),
        ...(vkEncryptedFingerprint ? { HonkVerifierEncryptedVkFingerprint: vkEncryptedFingerprint } : {}),
    };

    all[key] = { ...(all[key] || {}), ...updated };
    fs.writeFileSync(addressesPath, `${JSON.stringify(all, null, 4)}\n`);
    console.log(`\n✓ addresses.json updated (${key})`);

    const startBlocksPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
    const startBlocks = fs.existsSync(startBlocksPath)
        ? (JSON.parse(fs.readFileSync(startBlocksPath, "utf8")) as Record<string, number>)
        : {};
    startBlocks.EligibilityEngine = engineBlock;
    startBlocks.MedVaultRegistry = registryBlock;
    startBlocks.SponsorIncentiveVault = vaultBlock;
    const consentGateBlock = await deployBlock(consentGate);
    const leaderboardBlock = await deployBlock(leaderboard);
    startBlocks.EncryptedConsentGate = consentGateBlock;
    startBlocks.EncryptedScoreLeaderboard = leaderboardBlock;
    fs.writeFileSync(startBlocksPath, `${JSON.stringify(startBlocks, null, 4)}\n`);
    console.log("✓ sepolia-start-blocks.json updated for redeployed contracts");

    try {
        execSync(`node ${path.join(__dirname, "update-subgraph-yaml.js")} sepolia`, {
            stdio: "inherit",
            cwd: path.join(__dirname, ".."),
        });
    } catch (e) {
        console.warn("update-subgraph-yaml.js failed:", e);
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("     ATTESTATION UPGRADE COMPLETE (sepolia)");
    console.log("═══════════════════════════════════════════════");
    for (const [name, address] of Object.entries(updated)) {
        if (typeof address === "string" && address.startsWith("0x")) {
            console.log(`  ${name.padEnd(28)} ${address}`);
        }
    }
    console.log("═══════════════════════════════════════════════");
    console.log("\nOld contracts (retired):");
    for (const [name, address] of Object.entries(OLD)) {
        console.log(`  ${name.padEnd(28)} ${address}`);
    }
    console.log("\nNext: node scripts/redeploy-subgraph.js v0.1.1");
    console.log("Then update VITE_SUBGRAPH_URL in .env to the new Studio version.\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
