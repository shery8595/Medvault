import hre from "hardhat";
import { ethers, type BaseContract } from "ethers";

/** Slightly over 6 hours so apply succeeds after hardhat time travel. */
const TIMELOCK_SKIP_SECS = 6 * 3600 + 60;

let fhevmLiveInitialized = false;

/** Required before sending txs on Sepolia/mainnet so the FHEVM plugin can format estimateGas errors. */
export async function ensureFhevmInitialized(): Promise<void> {
    if (fhevmLiveInitialized || hre.network.name === "hardhat") return;
    await hre.fhevm.initializeCLIApi();
    fhevmLiveInitialized = true;
}

export const ENGINE_READER_ROLES = {
    automation: ethers.id("automation"),
    authorizedRegistry: ethers.id("authorizedRegistry"),
    consentGate: ethers.id("consentGate"),
    scoreLeaderboard: ethers.id("scoreLeaderboard"),
    sponsorIncentiveVault: ethers.id("sponsorIncentiveVault"),
    eligibilityVerifier: ethers.id("eligibilityVerifier"),
    eligibilityVerifierEncrypted: ethers.id("eligibilityVerifierEncrypted"),
    patientDocumentStore: ethers.id("patientDocumentStore"),
} as const;

export async function advanceTimelockIfHardhat(): Promise<void> {
    if (hre.network.name === "hardhat") {
        await hre.network.provider.send("evm_increaseTime", [TIMELOCK_SKIP_SECS]);
        await hre.network.provider.send("evm_mine", []);
    }
}

/** Schedule a timelocked change, fast-forward on hardhat, then apply. */
export async function scheduleAndApply(
    schedule: () => Promise<{ wait: () => Promise<unknown> }>,
    apply: () => Promise<{ wait: () => Promise<unknown> }>,
    label: string
): Promise<void> {
    await ensureFhevmInitialized();
    await (await schedule()).wait();
    await advanceTimelockIfHardhat();
    try {
        await (await apply()).wait();
        console.log(`✓ ${label}`);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Timelock active")) {
            console.warn(`  ${label}: scheduled — re-run scripts/finish-wiring.ts after 6 hours to apply`);
            return;
        }
        throw e;
    }
}

export async function wireEngineReader(
    engine: BaseContract,
    role: string,
    newAddr: string,
    label: string
): Promise<void> {
    const e = engine as ethers.Contract;
    await scheduleAndApply(
        () => e.scheduleAuthorizedReader(role, newAddr),
        () => e.applyAuthorizedReader(role),
        label
    );
}

export async function wireTrialManagerAutomation(
    trialManager: BaseContract,
    automation: string
): Promise<void> {
    const tm = trialManager as ethers.Contract;
    await scheduleAndApply(
        () => tm.scheduleAutomationContract(automation),
        () => tm.applyAutomationContract(),
        "TrialManager automation"
    );
}

export async function wireTrialManagerEligibilityEngine(
    trialManager: BaseContract,
    engine: string
): Promise<void> {
    const tm = trialManager as ethers.Contract;
    await scheduleAndApply(
        () => tm.scheduleEligibilityEngine(engine),
        () => tm.applyEligibilityEngine(),
        "TrialManager eligibilityEngine"
    );
}

export async function wireConsentManagerGate(
    consentManager: BaseContract,
    gate: string
): Promise<void> {
    const cm = consentManager as ethers.Contract;
    await scheduleAndApply(
        () => cm.scheduleConsentGate(gate),
        () => cm.applyConsentGate(),
        "ConsentManager consentGate"
    );
}

export async function wireVaultAutomation(
    vault: BaseContract,
    automation: string
): Promise<void> {
    const v = vault as ethers.Contract;
    await scheduleAndApply(
        () => v.scheduleAutomationContract(automation),
        () => v.applyAutomationContract(),
        "SponsorIncentiveVault automation"
    );
}

export async function wireVaultMilestoneManager(
    vault: BaseContract,
    milestoneManager: string
): Promise<void> {
    const v = vault as ethers.Contract;
    await scheduleAndApply(
        () => v.scheduleMilestoneManager(milestoneManager),
        () => v.applyMilestoneManager(),
        "SponsorIncentiveVault milestoneManager"
    );
}

export async function wireVaultSponsorRegistry(
    vault: BaseContract,
    registry: string
): Promise<void> {
    const v = vault as ethers.Contract;
    await scheduleAndApply(
        () => v.scheduleSponsorRegistry(registry),
        () => v.applySponsorRegistry(),
        "SponsorIncentiveVault sponsorRegistry"
    );
}

export async function wireMilestoneManagerVault(
    milestoneManager: BaseContract,
    vault: string
): Promise<void> {
    const mm = milestoneManager as ethers.Contract;
    await scheduleAndApply(
        () => mm.scheduleVault(vault),
        () => mm.applyVault(),
        "TrialMilestoneManager vault"
    );
}

export async function wireMilestoneManagerTrialManager(
    milestoneManager: BaseContract,
    trialManager: string
): Promise<void> {
    const mm = milestoneManager as ethers.Contract;
    await scheduleAndApply(
        () => mm.scheduleTrialManager(trialManager),
        () => mm.applyTrialManager(),
        "TrialMilestoneManager trialManager"
    );
}

export async function wireAutomationVault(
    automation: BaseContract,
    vault: string
): Promise<void> {
    const a = automation as ethers.Contract;
    await scheduleAndApply(
        () => a.scheduleVault(vault),
        () => a.applyVault(),
        "MedVaultAutomation vault"
    );
}

export async function wireAutomationForwarder(
    automation: BaseContract,
    forwarder: string
): Promise<void> {
    const a = automation as ethers.Contract;
    await scheduleAndApply(
        () => a.scheduleChainlinkForwarder(forwarder),
        () => a.applyChainlinkForwarder(),
        "MedVaultAutomation chainlinkForwarder"
    );
}

export async function ensureCethContractAuth(
    cETH: BaseContract,
    contract: string,
    authorize: boolean
): Promise<void> {
    const c = cETH as ethers.Contract;
    const label = `ConfidentialETH ${authorize ? "authorize" : "deauthorize"} ${contract.slice(0, 10)}…`;
    await scheduleAndApply(
        () => c.scheduleContractAuth(contract, authorize),
        () => c.applyContractAuth(contract),
        label
    );
}

export type FullWiringConfig = {
    anonymousRegistry: BaseContract;
    trialManager: BaseContract;
    engine: BaseContract;
    consentManager: BaseContract;
    vault: BaseContract;
    milestoneManager: BaseContract;
    automation: BaseContract;
    cETH: BaseContract;
    dataAccessLog: BaseContract;
    leaderboard: BaseContract;
    consentGate: BaseContract;
    medVaultRegistry?: BaseContract | null;
    patientDocumentStore?: BaseContract | null;
    honkVerifierAddress: string;
    honkVerifierEncryptedAddress?: string;
    sponsorRegistryAddress: string;
    stakingManagerAddress: string;
    /** @deprecated Use relayerAddresses. Single relayer for backward compatibility. */
    trustedRelayer?: string;
    /** P3.1: one or more authorized relayer EOAs (comma-separated env or explicit array). */
    relayerAddresses?: string[];
};

/** Resolve authorized relayer EOAs from RELAYER_ADDRESSES, TRUSTED_RELAYER_ADDRESS, or RELAYER_PRIVATE_KEY. */
export function resolveRelayerAddresses(): string[] {
    const fromList = process.env.RELAYER_ADDRESSES?.split(",")
        .map((a) => a.trim())
        .filter((a) => a && ethers.isAddress(a)) ?? [];
    if (fromList.length > 0) return [...new Set(fromList.map((a) => ethers.getAddress(a)))];

    const legacy = process.env.TRUSTED_RELAYER_ADDRESS?.trim();
    if (legacy && ethers.isAddress(legacy)) return [ethers.getAddress(legacy)];

    const pk = process.env.RELAYER_PRIVATE_KEY?.trim();
    if (pk) return [new ethers.Wallet(pk).address];

    return [];
}

/** Full post-deploy wiring with timelocks (MH-1: engine before registry). */
export async function wireAllContracts(cfg: FullWiringConfig): Promise<void> {
    await ensureFhevmInitialized();
    const {
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
        trustedRelayer,
        relayerAddresses,
    } = cfg;

    const relayers = (relayerAddresses?.length
        ? relayerAddresses
        : trustedRelayer
          ? [trustedRelayer]
          : []
    ).filter((a) => ethers.isAddress(a));

    const reg = anonymousRegistry as ethers.Contract;
    // MH-1: engine must be set before registry accepts registrations.
    await (await reg.setAuthorizedEngine(await engine.getAddress())).wait();
    if (medVaultRegistry) {
        await (await reg.setAuthorizedRegistry(await medVaultRegistry.getAddress())).wait();
    }
    await (await reg.setDataAccessLog(await dataAccessLog.getAddress())).wait();
    console.log("✓ AnonymousPatientRegistry wiring");

    await wireTrialManagerAutomation(trialManager, await automation.getAddress());
    await wireTrialManagerEligibilityEngine(trialManager, await engine.getAddress());

    const dataAccessLogAddress = await dataAccessLog.getAddress();
    await scheduleAndApply(
        () => (engine as ethers.Contract).scheduleDataAccessLog(dataAccessLogAddress),
        () => (engine as ethers.Contract).applyDataAccessLog(),
        "EligibilityEngine dataAccessLog"
    );
    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.automation,
        await automation.getAddress(),
        "EligibilityEngine automation"
    );
    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.consentGate,
        await consentGate.getAddress(),
        "EligibilityEngine consentGate"
    );
    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.scoreLeaderboard,
        await leaderboard.getAddress(),
        "EligibilityEngine scoreLeaderboard"
    );
    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.eligibilityVerifier,
        honkVerifierAddress,
        "EligibilityEngine eligibilityVerifier"
    );
    if (honkVerifierEncryptedAddress) {
        await wireEngineReader(
            engine,
            ENGINE_READER_ROLES.eligibilityVerifierEncrypted,
            honkVerifierEncryptedAddress,
            "EligibilityEngine eligibilityVerifierEncrypted"
        );
    }
    await wireEngineReader(
        engine,
        ENGINE_READER_ROLES.sponsorIncentiveVault,
        await vault.getAddress(),
        "EligibilityEngine sponsorIncentiveVault"
    );
    if (medVaultRegistry) {
        await wireEngineReader(
            engine,
            ENGINE_READER_ROLES.authorizedRegistry,
            await medVaultRegistry.getAddress(),
            "EligibilityEngine authorizedRegistry"
        );
    }
    if (patientDocumentStore) {
        const docStoreAddr = await patientDocumentStore.getAddress();
        await wireEngineReader(
            engine,
            ENGINE_READER_ROLES.patientDocumentStore,
            docStoreAddr,
            "EligibilityEngine patientDocumentStore"
        );
        await (await (patientDocumentStore as ethers.Contract).setEligibilityEngine(await engine.getAddress())).wait();
        await (await (patientDocumentStore as ethers.Contract).setDataAccessLog(await dataAccessLog.getAddress())).wait();
        console.log("✓ PatientDocumentStore wiring");
    }
    console.log("✓ EligibilityEngine reader wiring");

    try {
        await (await (consentManager as ethers.Contract).setEligibilityEngine(await engine.getAddress())).wait();
        console.log("✓ ConsentManager.setEligibilityEngine");
    } catch {
        console.warn("  (skip ConsentManager.setEligibilityEngine — consents already granted)");
    }
    await (await (consentManager as ethers.Contract).setDataAccessLog(await dataAccessLog.getAddress())).wait();
    await wireConsentManagerGate(consentManager, await consentGate.getAddress());
    console.log("✓ ConsentManager wiring");

    await wireVaultMilestoneManager(vault, await milestoneManager.getAddress());
    await scheduleAndApply(
        () => (vault as ethers.Contract).scheduleDataAccessLog(dataAccessLogAddress),
        () => (vault as ethers.Contract).applyDataAccessLog(),
        "SponsorIncentiveVault dataAccessLog"
    );
    await wireVaultAutomation(vault, await automation.getAddress());
    await wireVaultSponsorRegistry(vault, sponsorRegistryAddress);
    console.log("✓ SponsorIncentiveVault wiring");

    await wireMilestoneManagerVault(milestoneManager, await vault.getAddress());
    await (await (milestoneManager as ethers.Contract).setDataAccessLog(await dataAccessLog.getAddress())).wait();
    console.log("✓ TrialMilestoneManager wiring");

    await wireAutomationVault(automation, await vault.getAddress());
    console.log("✓ MedVaultAutomation vault pointer");

    await ensureCethContractAuth(cETH, await vault.getAddress(), true);
    await ensureCethContractAuth(cETH, stakingManagerAddress, true);
    console.log("✓ ConfidentialETH contract auth (vault, staking)");

    const { ensureDataAccessLogger } = await import("../data-access-log-wiring");
    const dalLoggers = [
        await engine.getAddress(),
        await anonymousRegistry.getAddress(),
        await vault.getAddress(),
        await consentManager.getAddress(),
        await milestoneManager.getAddress(),
    ];
    if (patientDocumentStore) {
        dalLoggers.push(await patientDocumentStore.getAddress());
    }
    for (const logger of dalLoggers) {
        await ensureDataAccessLogger(dataAccessLog, logger, true);
    }
    console.log("✓ DataAccessLog authorized loggers");

    await (await (leaderboard as ethers.Contract).authorizeCaller(await engine.getAddress())).wait();
    await (await (consentGate as ethers.Contract).authorizeComputer(await engine.getAddress())).wait();
    console.log("✓ Leaderboard + ConsentGate authorizations");

    if (medVaultRegistry && relayers.length > 0) {
        for (const relayerAddr of relayers) {
            await scheduleAndApply(
                () => (medVaultRegistry as ethers.Contract).scheduleRelayerAuth(relayerAddr, true),
                () => (medVaultRegistry as ethers.Contract).applyRelayerAuth(relayerAddr),
                `MedVaultRegistry authorized relayer → ${relayerAddr}`
            );
            await ensureCethContractAuth(cETH, relayerAddr, true);
        }
        console.log(`✓ MedVaultRegistry authorized ${relayers.length} relayer(s)`);
    }
}
