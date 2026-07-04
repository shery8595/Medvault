/**
 * Apply pending timelock wiring on an existing deployment.
 * Re-run after READER_CHANGE_DELAY (6 hours) if deploy scheduled but did not apply.
 *
 * Usage:
 *   npx hardhat run scripts/finish-wiring.ts --network sepolia
 */
import hre from "hardhat";
import { ethers } from "hardhat";
import { loadAddresses, networkKeyFromHardhatName } from "./lib/networkAddresses";
import {
    advanceTimelockIfHardhat,
    ensureCethContractAuth,
    ensureFhevmInitialized,
    scheduleAndApply,
    wireAutomationForwarder,
    wireAutomationVault,
    wireConsentManagerGate,
    wireEngineReader,
    wireMilestoneManagerVault,
    wireTrialManagerAutomation,
    wireTrialManagerEligibilityEngine,
    wireVaultAutomation,
    wireVaultMilestoneManager,
    wireVaultSponsorRegistry,
    ENGINE_READER_ROLES,
} from "./lib/timelockWiring";
import { ensureDataAccessLogger } from "./data-access-log-wiring";

async function tryApply(label: string, apply: () => Promise<unknown>): Promise<void> {
    try {
        await apply();
        console.log(`✓ ${label}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Timelock active")) {
            console.warn(`  ${label}: timelock still active — wait and re-run`);
        } else if (msg.includes("Nothing") || msg.includes("already")) {
            console.log(`  ${label}: skipped (${msg.slice(0, 60)})`);
        } else {
            throw e;
        }
    }
}

async function main() {
    const key = networkKeyFromHardhatName(hre.network.name);
    const addresses = loadAddresses(key);
    console.log(`Applying pending timelock wiring on ${hre.network.name}...\n`);

    try {
        await ensureFhevmInitialized();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`FHEVM init skipped (non-fatal for timelock apply): ${msg.slice(0, 120)}`);
    }
    await advanceTimelockIfHardhat();

    const trialManager = await ethers.getContractAt("TrialManager", addresses.TrialManager);
    const engine = await ethers.getContractAt("EligibilityEngine", addresses.EligibilityEngine);
    const consentManager = await ethers.getContractAt("ConsentManager", addresses.ConsentManager);
    const vault = await ethers.getContractAt("SponsorIncentiveVault", addresses.SponsorIncentiveVault);
    const milestoneManager = await ethers.getContractAt("TrialMilestoneManager", addresses.TrialMilestoneManager);
    const automation = await ethers.getContractAt("MedVaultAutomation", addresses.MedVaultAutomation);
    const cETH = await ethers.getContractAt("ConfidentialETH", addresses.ConfidentialETH);
    const dataAccessLog = await ethers.getContractAt("DataAccessLog", addresses.DataAccessLog);

    await tryApply("TrialManager.applyAutomationContract", async () => {
        await (await trialManager.applyAutomationContract()).wait();
    });
    await tryApply("TrialManager.applyEligibilityEngine", async () => {
        await (await trialManager.applyEligibilityEngine()).wait();
    });

    for (const [name, role] of Object.entries(ENGINE_READER_ROLES)) {
        await tryApply(`EligibilityEngine.applyAuthorizedReader(${name})`, async () => {
            await (await engine.applyAuthorizedReader(role)).wait();
        });
    }

    await tryApply("ConsentManager.applyConsentGate", async () => {
        await (await consentManager.applyConsentGate()).wait();
    });

    await tryApply("Vault.applyAutomationContract", async () => {
        await (await vault.applyAutomationContract()).wait();
    });
    await tryApply("Vault.applyMilestoneManager", async () => {
        await (await vault.applyMilestoneManager()).wait();
    });
    if (addresses.SponsorRegistry) {
        await tryApply("Vault.applySponsorRegistry", async () => {
            await (await vault.applySponsorRegistry()).wait();
        });
    }

    await tryApply("MilestoneManager.applyVault", async () => {
        await (await milestoneManager.applyVault()).wait();
    });

    await tryApply("Automation.applyVault", async () => {
        await (await automation.applyVault()).wait();
    });

    const pendingForwarder = await automation.pendingChainlinkForwarder();
    const forwarderEta = await automation.forwarderChangeEta();
    const block = await ethers.provider.getBlock("latest");
    const now = BigInt(block?.timestamp ?? Math.floor(Date.now() / 1000));
    const hasPendingForwarder =
        pendingForwarder !== ethers.ZeroAddress && forwarderEta !== 0n && now >= forwarderEta;
    const envForwarder = process.env.CHAINLINK_FORWARDER?.trim();
    if (hasPendingForwarder || (envForwarder && ethers.isAddress(envForwarder))) {
        await tryApply("Automation.applyChainlinkForwarder", async () => {
            await (await automation.applyChainlinkForwarder()).wait();
        });
    }

    await tryApply("cETH.applyContractAuth(vault)", async () => {
        await (await cETH.applyContractAuth(addresses.SponsorIncentiveVault)).wait();
    });
    if (addresses.StakingManager) {
        await tryApply("cETH.applyContractAuth(staking)", async () => {
            await (await cETH.applyContractAuth(addresses.StakingManager)).wait();
        });
    }

    await scheduleAndApply(
        () => vault.scheduleDataAccessLog(addresses.DataAccessLog),
        () => vault.applyDataAccessLog(),
        "Vault dataAccessLog"
    );

    for (const logger of [
        addresses.EligibilityEngine,
        addresses.AnonymousPatientRegistry,
        addresses.SponsorIncentiveVault,
        addresses.ConsentManager,
        addresses.TrialMilestoneManager,
    ]) {
        if (logger) await ensureDataAccessLogger(dataAccessLog, logger, true);
    }
    console.log("✓ DataAccessLog loggers (scheduled or applied)");

    console.log("\nDone. If any items show 'timelock still active', re-run after 6 hours.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
