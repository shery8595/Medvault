/**
 * Fast apply-only pass: no FHEVM init, no scheduling. Re-run after timelock expires.
 * Usage: npx hardhat run scripts/apply-pending-wiring.ts --network sepolia --no-compile
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";
import { ensureDataAccessLogger } from "./data-access-log-wiring";

async function tryApply(label: string, apply: () => Promise<unknown>): Promise<void> {
    try {
        const tx = await apply();
        if (tx && typeof tx === "object" && "wait" in tx && typeof (tx as { wait: () => Promise<unknown> }).wait === "function") {
            await (tx as { wait: () => Promise<unknown> }).wait();
        }
        console.log(`✓ ${label}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Timelock active")) {
            console.warn(`  ${label}: timelock still active`);
        } else if (msg.includes("Nothing") || msg.includes("already") || msg.includes("No pending")) {
            console.log(`  ${label}: already done`);
        } else {
            console.error(`  ${label}: FAILED — ${msg.slice(0, 200)}`);
        }
    }
}

async function main() {
    const key = networkKeyFromHardhatName(hre.network.name);
    const a = loadAddresses(key);
    const [signer] = await ethers.getSigners();
    console.log(`Apply pending wiring on ${hre.network.name} as ${signer.address}\n`);

    const vault = await ethers.getContractAt("SponsorIncentiveVault", a.SponsorIncentiveVault);
    const milestoneManager = await ethers.getContractAt("TrialMilestoneManager", a.TrialMilestoneManager);
    const cETH = await ethers.getContractAt("ConfidentialETH", a.ConfidentialETH);
    const dataAccessLog = await ethers.getContractAt("DataAccessLog", a.DataAccessLog);

    await tryApply("Vault.applySponsorRegistry", () => vault.applySponsorRegistry());
    await tryApply("MilestoneManager.applyVault", () => milestoneManager.applyVault());
    await tryApply("cETH.applyContractAuth(vault)", () => cETH.applyContractAuth(a.SponsorIncentiveVault));
    if (a.StakingManager) {
        await tryApply("cETH.applyContractAuth(staking)", () => cETH.applyContractAuth(a.StakingManager));
    }
    await tryApply("Vault.applyDataAccessLog", () => vault.applyDataAccessLog());

    for (const logger of [
        a.EligibilityEngine,
        a.AnonymousPatientRegistry,
        a.SponsorIncentiveVault,
        a.ConsentManager,
        a.TrialMilestoneManager,
    ]) {
        if (logger) await ensureDataAccessLogger(dataAccessLog, logger, true);
    }
    console.log("✓ DataAccessLog loggers checked");

    const engine = await ethers.getContractAt("EligibilityEngine", a.EligibilityEngine);
    console.log("\n--- status ---");
    console.log("eligibilityVerifier:", await engine.eligibilityVerifier());
    console.log("eligibilityVerifierEncrypted:", await engine.eligibilityVerifierEncrypted());
    console.log("vault.sponsorRegistry:", await vault.sponsorRegistry());
    console.log("milestoneManager.vault:", await milestoneManager.vault());
    console.log("cETH vault auth:", await cETH.authorizedContracts(a.SponsorIncentiveVault));
}

main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
