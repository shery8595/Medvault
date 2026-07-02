/**
 * Complete timelock wiring for contracts already deployed on Sepolia.
 * Updates addresses.json and subgraph start blocks when wiring succeeds.
 *
 * Usage:
 *   npx hardhat run scripts/wire-sepolia.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";
import { ensureFhevmInitialized, wireAllContracts, wireAutomationForwarder } from "./lib/timelockWiring";

async function fetchCreationBlock(address: string): Promise<number> {
    const url = `https://api-sepolia.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}`;
    const res = await fetch(url);
    const json = (await res.json()) as { status: string; result: Array<{ txHash: string }> };
    if (json.status !== "1" || !json.result?.[0]?.txHash) return 0;
    const rec = await ethers.provider.getTransactionReceipt(json.result[0].txHash);
    return rec ? Number(rec.blockNumber) : 0;
}

async function main() {
    const key = networkKeyFromHardhatName(hre.network.name);
    if (key !== "sepolia") {
        throw new Error(`wire-sepolia.ts is for Sepolia only (got ${hre.network.name})`);
    }

    await ensureFhevmInitialized();

    const addressesPath = path.join(__dirname, "../src/lib/contracts/addresses.json");
    const all = JSON.parse(fs.readFileSync(addressesPath, "utf8")) as Record<string, Record<string, string>>;
    const a = loadAddresses(key);

    const [deployer] = await ethers.getSigners();
    console.log(`Wiring Sepolia deployment as ${deployer.address}\n`);

    const anonymousRegistry = await ethers.getContractAt("AnonymousPatientRegistry", a.AnonymousPatientRegistry);
    const trialManager = await ethers.getContractAt("TrialManager", a.TrialManager);
    const engine = await ethers.getContractAt("EligibilityEngine", a.EligibilityEngine);
    const consentManager = await ethers.getContractAt("ConsentManager", a.ConsentManager);
    const vault = await ethers.getContractAt("SponsorIncentiveVault", a.SponsorIncentiveVault);
    const milestoneManager = await ethers.getContractAt("TrialMilestoneManager", a.TrialMilestoneManager);
    const automation = await ethers.getContractAt("MedVaultAutomation", a.MedVaultAutomation);
    const cETH = await ethers.getContractAt("ConfidentialETH", a.ConfidentialETH);
    const dataAccessLog = await ethers.getContractAt("DataAccessLog", a.DataAccessLog);
    const leaderboard = await ethers.getContractAt("EncryptedScoreLeaderboard", a.EncryptedScoreLeaderboard);
    const consentGate = await ethers.getContractAt("EncryptedConsentGate", a.EncryptedConsentGate);
    const medVaultRegistry = a.MedVaultRegistry
        ? await ethers.getContractAt("MedVaultRegistry", a.MedVaultRegistry)
        : null;

    const honkVerifierAddress = a.HonkVerifier || a.EligibilityVerifier;
    const honkVerifierEncryptedAddress = a.HonkVerifierEncrypted;
    const patientDocumentStore = a.PatientDocumentStore
        ? await ethers.getContractAt("PatientDocumentStore", a.PatientDocumentStore)
        : null;
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
        patientDocumentStore,
        honkVerifierAddress,
        honkVerifierEncryptedAddress,
        sponsorRegistryAddress: a.SponsorRegistry,
        stakingManagerAddress: a.StakingManager,
        trustedRelayer,
    });

    const realForwarder = process.env.CHAINLINK_FORWARDER?.trim();
    if (realForwarder && ethers.isAddress(realForwarder)) {
        const currentForwarder = await automation.chainlinkForwarder();
        if (realForwarder.toLowerCase() !== String(currentForwarder).toLowerCase()) {
            await wireAutomationForwarder(automation, realForwarder);
        }
    }

    const vkPath = path.join(__dirname, "../src/lib/circuits/vk_fingerprint.json");
    const vkFp = fs.existsSync(vkPath) ? JSON.parse(fs.readFileSync(vkPath, "utf8")) : null;
    const vkFingerprint = vkFp?.plaintext?.sha256 ?? vkFp?.sha256 ?? all.sepolia?.HonkVerifierVkFingerprint;
    const vkEncryptedFingerprint =
        vkFp?.encrypted?.sha256 ?? all.sepolia?.HonkVerifierEncryptedVkFingerprint;

    all.sepolia = {
        ...all.sepolia,
        ...a,
        EligibilityVerifier: honkVerifierAddress,
        ...(honkVerifierEncryptedAddress ? { HonkVerifierEncrypted: honkVerifierEncryptedAddress } : {}),
        ...(vkFingerprint ? { HonkVerifierVkFingerprint: vkFingerprint } : {}),
        ...(vkEncryptedFingerprint ? { HonkVerifierEncryptedVkFingerprint: vkEncryptedFingerprint } : {}),
    };
    fs.writeFileSync(addressesPath, `${JSON.stringify(all, null, 4)}\n`);
    console.log("\n✓ addresses.json updated");

    const startBlocksPath = path.join(__dirname, "../subgraph/sepolia-start-blocks.json");
    const startBlocks: Record<string, number> = fs.existsSync(startBlocksPath)
        ? JSON.parse(fs.readFileSync(startBlocksPath, "utf8"))
        : {};

    const toIndex = [
        "AnonymousPatientRegistry",
        "SponsorRegistry",
        "TrialManager",
        "ConsentManager",
        "DataAccessLog",
        "EligibilityEngine",
        "SponsorIncentiveVault",
        "TrialMilestoneManager",
        "StakingManager",
        "MedVaultRegistry",
    ] as const;

    console.log("\nFetching subgraph start blocks...");
    for (const name of toIndex) {
        const addr = a[name];
        if (!addr) continue;
        const block = await fetchCreationBlock(addr);
        if (block > 0) {
            startBlocks[name] = block;
            console.log(`  ${name}: ${block}`);
        }
    }
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

    console.log("\nWiring complete. If any timelocks did not apply, re-run after 6 hours:");
    console.log("  npm run deploy:wiring:sepolia");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
