/**
 * Complete wiring for a partial upgrade-attestation-sepolia run.
 * Set env vars or edit DEFAULTS below, then:
 *   npx hardhat run scripts/finish-attestation-upgrade-sepolia.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ensureDataAccessLogger } from "./data-access-log-wiring";

const VK_FINGERPRINT_FILE = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");

/** Contracts deployed in the interrupted 2026-06-26 upgrade run */
const DEFAULTS = {
    HonkVerifier: "0xb4894e3E62D634561Ce8cA0b47e50A88822A169b",
    EligibilityEngine: "0x7d70b8DCecb1F7E0E291cf7Fd8EEc6be2dEA9B1e",
    EncryptedConsentGate: "0x142A5Fe5138B77aa912616c53a98841b4a557714",
    EncryptedScoreLeaderboard: "0xDFd6d59eC9d02F66b52120CE432476b05F316d32",
    MedVaultRegistry: "0x345fc2C0EBa204cBD741A17fb173a38396c8987A",
    SponsorIncentiveVault: "0x24b5917Ba2Ffa6c3C25c6619419969CA02763a4E",
    EligibilityEngineBlock: 11141136,
    MedVaultRegistryBlock: 11141139,
    SponsorIncentiveVaultBlock: 11141140,
};

function networkKey(): string {
    return hre.network.name === "sepolia" ? "sepolia" : hre.network.name;
}

async function main() {
    const key = networkKey();
    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const all = JSON.parse(fs.readFileSync(addressesPath, "utf8")) as Record<string, Record<string, string>>;
    const current = all[key];
    if (!current) throw new Error(`No addresses for "${key}"`);

    const OLD_VAULT = current.SponsorIncentiveVault;
    const OLD_ENGINE = current.EligibilityEngine;

    const honkVerifierAddress = process.env.HONK_VERIFIER_ADDRESS || DEFAULTS.HonkVerifier;
    const engineAddress = process.env.ELIGIBILITY_ENGINE_ADDRESS || DEFAULTS.EligibilityEngine;
    const consentGateAddress = process.env.ENCRYPTED_CONSENT_GATE_ADDRESS || DEFAULTS.EncryptedConsentGate;
    const leaderboardAddress = process.env.ENCRYPTED_SCORE_LEADERBOARD_ADDRESS || DEFAULTS.EncryptedScoreLeaderboard;
    const medVaultRegistryAddress = process.env.MEDVAULT_REGISTRY_ADDRESS || DEFAULTS.MedVaultRegistry;
    const vaultAddress = process.env.SPONSOR_INCENTIVE_VAULT_ADDRESS || DEFAULTS.SponsorIncentiveVault;

    const KEEP = {
        AnonymousPatientRegistry: current.AnonymousPatientRegistry,
        SponsorRegistry: current.SponsorRegistry,
        TrialManager: current.TrialManager,
        ConsentManager: current.ConsentManager,
        DataAccessLog: current.DataAccessLog,
        ConfidentialETH: current.ConfidentialETH,
        TrialMilestoneManager: current.TrialMilestoneManager,
        MedVaultAutomation: current.MedVaultAutomation,
    };

    const [deployer] = await ethers.getSigners();
    console.log(`\nFinishing upgrade wiring on ${hre.network.name}`);
    console.log(`Deployer: ${deployer.address}\n`);

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
    const engine = await ethers.getContractAt("EligibilityEngine", engineAddress);
    const vault = await ethers.getContractAt("SponsorIncentiveVault", vaultAddress);
    const medVaultRegistry = await ethers.getContractAt("MedVaultRegistry", medVaultRegistryAddress);
    const leaderboard = await ethers.getContractAt("EncryptedScoreLeaderboard", leaderboardAddress);
    const consentGate = await ethers.getContractAt("EncryptedConsentGate", consentGateAddress);

    await (await anonymousRegistry.setAuthorizedEngine(engineAddress)).wait();
    await (await anonymousRegistry.setAuthorizedRegistry(medVaultRegistryAddress)).wait();
    console.log("✓ AnonymousPatientRegistry wiring");

    await (await vault.setMilestoneManager(KEEP.TrialMilestoneManager)).wait();
    await (await vault.setDataAccessLog(KEEP.DataAccessLog)).wait();
    await (await vault.setAutomationContract(KEEP.MedVaultAutomation)).wait();
    if (KEEP.SponsorRegistry) {
        await (await vault.setSponsorRegistry(KEEP.SponsorRegistry)).wait();
    }
    console.log("✓ SponsorIncentiveVault wiring");

    await (await milestoneManager.setVault(vaultAddress)).wait();
    try {
        await (await milestoneManager.setDataAccessLog(KEEP.DataAccessLog)).wait();
    } catch {
        console.warn("  (skip TrialMilestoneManager.setDataAccessLog)");
    }
    await (await automation.setVault(vaultAddress)).wait();
    try {
        await (await trialManager.setAutomationContract(KEEP.MedVaultAutomation)).wait();
    } catch {
        console.warn("  (skip TrialManager.setAutomationContract — already set)");
    }
    console.log("✓ Milestone manager + automation vault pointers");

    if (OLD_VAULT && OLD_VAULT !== vaultAddress) {
        try {
            await (await cETH.deauthorizeContract(OLD_VAULT)).wait();
            console.log("✓ Deauthorized old vault on cETH");
        } catch {
            console.warn("  (skip cETH deauthorize old vault)");
        }
        try {
            await ensureDataAccessLogger(dataAccessLog, OLD_VAULT, false);
        } catch {
            /* ignore */
        }
    }
    try {
        await (await cETH.authorizeContract(vaultAddress)).wait();
        console.log("✓ ConfidentialETH authorized new vault");
    } catch {
        console.warn("  (skip cETH authorize new vault — already authorized)");
    }

    if (OLD_ENGINE && OLD_ENGINE !== engineAddress) {
        try {
            await ensureDataAccessLogger(dataAccessLog, OLD_ENGINE, false);
        } catch {
            /* ignore */
        }
    }
    await ensureDataAccessLogger(dataAccessLog, engineAddress, true);
    await ensureDataAccessLogger(dataAccessLog, KEEP.AnonymousPatientRegistry, true);
    await ensureDataAccessLogger(dataAccessLog, vaultAddress, true);
    console.log("✓ DataAccessLog loggers (scheduled or applied)");

    await (await leaderboard.authorizeCaller(engineAddress)).wait();
    await (await consentGate.authorizeComputer(engineAddress)).wait();
    console.log("✓ Leaderboard + ConsentGate authorizations");

    const trustedRelayer =
        process.env.TRUSTED_RELAYER_ADDRESS ||
        (process.env.RELAYER_PRIVATE_KEY
            ? new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address
            : "");
    if (trustedRelayer && ethers.isAddress(trustedRelayer)) {
        await (await medVaultRegistry.setTrustedRelayer(trustedRelayer)).wait();
        await (await cETH.authorizeContract(trustedRelayer)).wait();
        console.log(`✓ Relayer authorized: ${trustedRelayer}`);
    }

    const inputCount = await engine.ELIGIBILITY_PUBLIC_INPUT_COUNT();
    console.log(`\nOn-chain attestation check: publicInputs=${inputCount}`);

    let vkFingerprint: string | undefined;
    if (fs.existsSync(VK_FINGERPRINT_FILE)) {
        vkFingerprint = JSON.parse(fs.readFileSync(VK_FINGERPRINT_FILE, "utf8")).sha256;
    }

    const updated = {
        ...KEEP,
        MedVaultRegistry: medVaultRegistryAddress,
        EligibilityEngine: engineAddress,
        HonkVerifier: honkVerifierAddress,
        EligibilityVerifier: honkVerifierAddress,
        EncryptedConsentGate: consentGateAddress,
        EncryptedScoreLeaderboard: leaderboardAddress,
        SponsorIncentiveVault: vaultAddress,
        Semaphore: current.Semaphore,
        Reclaim: current.Reclaim,
        ReclaimSemaphore: current.ReclaimSemaphore,
        SemaphoreVerifier: current.SemaphoreVerifier,
        StakingManager: current.StakingManager,
        ...(vkFingerprint ? { HonkVerifierVkFingerprint: vkFingerprint } : {}),
    };

    all[key] = { ...(all[key] || {}), ...updated };
    fs.writeFileSync(addressesPath, `${JSON.stringify(all, null, 4)}\n`);
    console.log(`\n✓ addresses.json updated (${key})`);

    const startBlocksPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
    const startBlocks = fs.existsSync(startBlocksPath)
        ? (JSON.parse(fs.readFileSync(startBlocksPath, "utf8")) as Record<string, number>)
        : {};
    startBlocks.EligibilityEngine = Number(
        process.env.ELIGIBILITY_ENGINE_BLOCK || DEFAULTS.EligibilityEngineBlock
    );
    startBlocks.MedVaultRegistry = Number(
        process.env.MEDVAULT_REGISTRY_BLOCK || DEFAULTS.MedVaultRegistryBlock
    );
    startBlocks.SponsorIncentiveVault = Number(
        process.env.SPONSOR_INCENTIVE_VAULT_BLOCK || DEFAULTS.SponsorIncentiveVaultBlock
    );
    fs.writeFileSync(startBlocksPath, `${JSON.stringify(startBlocks, null, 4)}\n`);
    console.log("✓ sepolia-start-blocks.json updated");

    try {
        execSync(`node ${path.join(__dirname, "update-subgraph-yaml.js")} sepolia`, {
            stdio: "inherit",
            cwd: path.join(__dirname, ".."),
        });
    } catch (e) {
        console.warn("update-subgraph-yaml.js failed:", e);
    }

    try {
        execSync("node scripts/sync-sdk-assets.mjs", {
            stdio: "inherit",
            cwd: path.join(__dirname, ".."),
        });
    } catch {
        /* optional */
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("     ATTESTATION UPGRADE WIRING COMPLETE");
    console.log("═══════════════════════════════════════════════");
    for (const [name, address] of Object.entries(updated)) {
        if (typeof address === "string" && address.startsWith("0x")) {
            console.log(`  ${name.padEnd(28)} ${address}`);
        }
    }
    console.log("\nRelayer env: REGISTRY_ADDRESS, SPONSOR_INCENTIVE_VAULT_ADDRESS");
    console.log("Subgraph: npm run subgraph:deploy:near-head (or redeploy-subgraph.js)\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
