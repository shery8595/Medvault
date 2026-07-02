import { ethers } from "hardhat";
import type { Contract } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DEFAULT_TRIAL_PARAMS, HARDHAT_CHAIN_ID } from "./constants";
import { buildPatientProfileInputs, buildSponsorCriteriaInputs, type PatientProfileValues } from "./fhe";
import { createEncryptedUint64 } from "./fhe";
import { computeProfileCommitment, defaultProfileSalt, randomProfileSalt, profileSaltCommitment } from "./profileCommitment";
import { authorizeCethContract, scheduleAndApply, authorizeRelayer } from "./timelock";
import { deployAnonymousPatientRegistry, deployAnonymousPatientRegistryTestHarness } from "../scripts/lib/deployAnonymousPatientRegistry";

const ENGINE_READER_ROLES = {
    automation: ethers.id("automation"),
    authorizedRegistry: ethers.id("authorizedRegistry"),
    consentGate: ethers.id("consentGate"),
    scoreLeaderboard: ethers.id("scoreLeaderboard"),
    sponsorIncentiveVault: ethers.id("sponsorIncentiveVault"),
    eligibilityVerifier: ethers.id("eligibilityVerifier"),
    eligibilityVerifierEncrypted: ethers.id("eligibilityVerifierEncrypted"),
    patientDocumentStore: ethers.id("patientDocumentStore"),
} as const;

export type MedVaultStack = {
    owner: HardhatEthersSigner;
    patient: HardhatEthersSigner;
    sponsor: HardhatEthersSigner;
    sponsor2: HardhatEthersSigner;
    stranger: HardhatEthersSigner;
    relayer: HardhatEthersSigner;
    dataAccessLog: Contract;
    consentManager: Contract;
    sponsorRegistry: Contract;
    trialManager: Contract;
    anonymousPatientRegistry: Contract;
    honkVerifier: Contract;
    honkVerifierEncrypted: Contract;
    eligibilityEngine: Contract;
    encryptedConsentGate: Contract;
    encryptedScoreLeaderboard: Contract;
    medVaultRegistry: Contract;
    confidentialETH: Contract;
    trialMilestoneManager: Contract;
    sponsorIncentiveVault: Contract;
    medVaultAutomation: Contract;
    patientDocumentStore: Contract;
    mockSemaphore: Contract;
};

async function deploy(name: string, ...args: unknown[]): Promise<Contract> {
    if (name === "AnonymousPatientRegistry") {
        const network = await ethers.provider.getNetwork();
        if (network.chainId === BigInt(HARDHAT_CHAIN_ID)) {
            return deployAnonymousPatientRegistryTestHarness();
        }
        return deployAnonymousPatientRegistry();
    }
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
}

async function deployEligibilityComputeLib(): Promise<string> {
    const factory = await ethers.getContractFactory("EligibilityComputeLib");
    const lib = await factory.deploy();
    await lib.waitForDeployment();
    return await lib.getAddress();
}

async function deployEligibilityProofLib(): Promise<string> {
    const factory = await ethers.getContractFactory("EligibilityProofLib");
    const lib = await factory.deploy();
    await lib.waitForDeployment();
    return await lib.getAddress();
}

async function deployEligibilityEngineLinked(
    registry: string,
    trialManager: string,
    consentManager: string
): Promise<Contract> {
    const computeLibAddr = await deployEligibilityComputeLib();
    const proofLibAddr = await deployEligibilityProofLib();
    const network = await ethers.provider.getNetwork();
    const contractName =
        network.chainId === BigInt(HARDHAT_CHAIN_ID)
            ? "EligibilityEngineTestHarness"
            : "EligibilityEngine";
    const factory = await ethers.getContractFactory(contractName, {
        libraries: {
            EligibilityComputeLib: computeLibAddr,
            EligibilityProofLib: proofLibAddr,
        },
    });
    const engine = await factory.deploy(registry, trialManager, consentManager);
    await engine.waitForDeployment();
    return engine;
}

async function deployVaultLibs(): Promise<Record<string, string>> {
    const distributionFactory = await ethers.getContractFactory("VaultDistributionLib");
    const distributionLib = await distributionFactory.deploy();
    await distributionLib.waitForDeployment();
    const distributionAddr = await distributionLib.getAddress();

    const standalone = [
        "VaultConfidentialLib",
        "VaultTimelockLib",
        "VaultRegistrationLib",
        "VaultClaimLib",
    ] as const;
    const libraries: Record<string, string> = {
        VaultDistributionLib: distributionAddr,
    };
    for (const name of standalone) {
        const factory = await ethers.getContractFactory(name);
        const lib = await factory.deploy();
        await lib.waitForDeployment();
        libraries[name] = await lib.getAddress();
    }

    for (const name of ["VaultReclaimLib", "VaultChallengeLib"] as const) {
        const factory = await ethers.getContractFactory(name, {
            libraries: { VaultDistributionLib: distributionAddr },
        });
        const lib = await factory.deploy();
        await lib.waitForDeployment();
        libraries[name] = await lib.getAddress();
    }

    return libraries;
}

async function deploySponsorIncentiveVaultLinked(
    cEth: string,
    trialManager: string,
    engine: string,
    harness = false
): Promise<Contract> {
    const libraries = await deployVaultLibs();
    const contractName = harness ? "SponsorIncentiveVaultTestHarness" : "SponsorIncentiveVault";
    const factory = await ethers.getContractFactory(contractName, { libraries });
    const vault = await factory.deploy(cEth, trialManager, engine);
    await vault.waitForDeployment();
    return vault;
}

async function authorizeDataAccessLogger(
    dataAccessLog: Contract,
    owner: HardhatEthersSigner,
    loggerAddress: string
) {
    await scheduleAndApply(
        () => dataAccessLog.connect(owner).scheduleAuthorizedLogger(loggerAddress, true),
        () => dataAccessLog.connect(owner).applyAuthorizedLogger(loggerAddress)
    );
}

async function enableTestHelpersOnHardhat(
    owner: HardhatEthersSigner,
    confidentialETH: Contract,
    anonymousPatientRegistry: Contract,
    eligibilityEngine?: Contract
) {
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== BigInt(HARDHAT_CHAIN_ID)) return;

    await scheduleAndApply(
        () => confidentialETH.connect(owner).scheduleTestHelpersEnabled(true),
        () => confidentialETH.connect(owner).applyTestHelpersEnabled()
    );
    await scheduleAndApply(
        () => anonymousPatientRegistry.connect(owner).scheduleTestHelpersEnabled(true),
        () => anonymousPatientRegistry.connect(owner).applyTestHelpersEnabled()
    );
    if (eligibilityEngine) {
        await scheduleAndApply(
            () => eligibilityEngine.connect(owner).scheduleTestHelpersEnabled(true),
            () => eligibilityEngine.connect(owner).applyTestHelpersEnabled()
        );
    }
}

async function wireEngineReader(
    engine: Contract,
    owner: HardhatEthersSigner,
    role: string,
    addr: string
) {
    await scheduleAndApply(
        () => engine.connect(owner).scheduleAuthorizedReader(role, addr),
        () => engine.connect(owner).applyAuthorizedReader(role)
    );
}

export async function deployMedVaultStack(options?: {
    wireDocumentStore?: boolean;
    vaultHarness?: boolean;
}): Promise<MedVaultStack> {
    const wireDocumentStore = options?.wireDocumentStore !== false;
    const vaultHarness = options?.vaultHarness === true;
    const signers = await ethers.getSigners();
    const [owner, patient, sponsor, sponsor2, stranger, relayer] = signers;

    const dataAccessLog = await deploy("DataAccessLog");
    const consentManager = await deploy("ConsentManager", true);
    const sponsorRegistry = await deploy("SponsorRegistry");
    const trialManager = await deploy("TrialManager", await sponsorRegistry.getAddress(), true);

    const anonymousPatientRegistry = await deploy("AnonymousPatientRegistry");
    const honkVerifier = await deploy("HonkVerifier");
    const honkVerifierEncrypted = await deploy("HonkVerifierEncrypted");

    const eligibilityEngine = await deployEligibilityEngineLinked(
        await anonymousPatientRegistry.getAddress(),
        await trialManager.getAddress(),
        await consentManager.getAddress()
    );

    const encryptedConsentGate = await deploy(
        "EncryptedConsentGate",
        await eligibilityEngine.getAddress(),
        await consentManager.getAddress()
    );

    const encryptedScoreLeaderboard = await deploy(
        "EncryptedScoreLeaderboard",
        await eligibilityEngine.getAddress()
    );

    const mockSemaphore = await deploy("MockSemaphore");

    const medVaultRegistry = await deploy(
        "MedVaultRegistry",
        await mockSemaphore.getAddress(),
        await anonymousPatientRegistry.getAddress(),
        await eligibilityEngine.getAddress()
    );

    const confidentialETH = await deploy("ConfidentialETH");

    const trialMilestoneManager = await deploy(
        "TrialMilestoneManager",
        await trialManager.getAddress()
    );

    const sponsorIncentiveVault = await deploySponsorIncentiveVaultLinked(
        await confidentialETH.getAddress(),
        await trialManager.getAddress(),
        await eligibilityEngine.getAddress(),
        vaultHarness
    );

    const patientDocumentStore = await deploy(
        "PatientDocumentStore",
        await trialManager.getAddress()
    );

    const medVaultAutomation = await deploy(
        "MedVaultAutomation",
        await trialManager.getAddress(),
        await sponsorIncentiveVault.getAddress(),
        owner.address
    );

    const engineAddr = await eligibilityEngine.getAddress();
    const automationAddr = await medVaultAutomation.getAddress();
    const vaultAddr = await sponsorIncentiveVault.getAddress();
    const milestoneAddr = await trialMilestoneManager.getAddress();
    const registryAddr = await medVaultRegistry.getAddress();
    const dalAddr = await dataAccessLog.getAddress();
    const gateAddr = await encryptedConsentGate.getAddress();
    const leaderboardAddr = await encryptedScoreLeaderboard.getAddress();
    const honkAddr = await honkVerifier.getAddress();
    const honkEncryptedAddr = await honkVerifierEncrypted.getAddress();
    const docStoreAddr = await patientDocumentStore.getAddress();
    const sponsorRegistryAddr = await sponsorRegistry.getAddress();
    const tmAddr = await trialManager.getAddress();

    // MH-1: engine before registry accepts patients.
    await anonymousPatientRegistry.setAuthorizedEngine(engineAddr);
    await anonymousPatientRegistry.setAuthorizedRegistry(registryAddr);
    await anonymousPatientRegistry.setDataAccessLog(dalAddr);

    await scheduleAndApply(
        () => trialManager.connect(owner).scheduleAutomationContract(automationAddr),
        () => trialManager.connect(owner).applyAutomationContract()
    );
    await scheduleAndApply(
        () => trialManager.connect(owner).scheduleEligibilityEngine(engineAddr),
        () => trialManager.connect(owner).applyEligibilityEngine()
    );

    await scheduleAndApply(
        () => eligibilityEngine.connect(owner).scheduleDataAccessLog(dalAddr),
        () => eligibilityEngine.connect(owner).applyDataAccessLog()
    );
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.automation, automationAddr);
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.consentGate, gateAddr);
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.scoreLeaderboard, leaderboardAddr);
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.eligibilityVerifier, honkAddr);
    await wireEngineReader(
        eligibilityEngine,
        owner,
        ENGINE_READER_ROLES.eligibilityVerifierEncrypted,
        honkEncryptedAddr
    );
    if (wireDocumentStore) {
        await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.patientDocumentStore, docStoreAddr);
        await patientDocumentStore.setEligibilityEngine(engineAddr);
        await patientDocumentStore.setDataAccessLog(dalAddr);
        await authorizeDataAccessLogger(dataAccessLog, owner, docStoreAddr);
    }
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.sponsorIncentiveVault, vaultAddr);
    await wireEngineReader(eligibilityEngine, owner, ENGINE_READER_ROLES.authorizedRegistry, registryAddr);

    await authorizeRelayer(medVaultRegistry, owner, relayer.address);
    await authorizeCethContract(confidentialETH, owner, relayer.address, true);

    await consentManager.setEligibilityEngine(engineAddr);
    await consentManager.setDataAccessLog(dalAddr);
    await scheduleAndApply(
        () => consentManager.connect(owner).scheduleConsentGate(gateAddr),
        () => consentManager.connect(owner).applyConsentGate()
    );

    await scheduleAndApply(
        () => sponsorIncentiveVault.connect(owner).scheduleMilestoneManager(milestoneAddr),
        () => sponsorIncentiveVault.connect(owner).applyMilestoneManager()
    );
    await scheduleAndApply(
        () => sponsorIncentiveVault.connect(owner).scheduleDataAccessLog(dalAddr),
        () => sponsorIncentiveVault.connect(owner).applyDataAccessLog()
    );
    await scheduleAndApply(
        () => sponsorIncentiveVault.connect(owner).scheduleAutomationContract(automationAddr),
        () => sponsorIncentiveVault.connect(owner).applyAutomationContract()
    );
    await scheduleAndApply(
        () => sponsorIncentiveVault.connect(owner).scheduleSponsorRegistry(sponsorRegistryAddr),
        () => sponsorIncentiveVault.connect(owner).applySponsorRegistry()
    );

    await scheduleAndApply(
        () => trialMilestoneManager.connect(owner).scheduleVault(vaultAddr),
        () => trialMilestoneManager.connect(owner).applyVault()
    );
    await trialMilestoneManager.setDataAccessLog(dalAddr);

    await scheduleAndApply(
        () => medVaultAutomation.connect(owner).scheduleVault(vaultAddr),
        () => medVaultAutomation.connect(owner).applyVault()
    );

    await authorizeCethContract(confidentialETH, owner, vaultAddr, true);

    await authorizeDataAccessLogger(dataAccessLog, owner, engineAddr);
    await authorizeDataAccessLogger(dataAccessLog, owner, registryAddr);
    await authorizeDataAccessLogger(dataAccessLog, owner, await anonymousPatientRegistry.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, vaultAddr);
    await authorizeDataAccessLogger(dataAccessLog, owner, await consentManager.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, milestoneAddr);

    await enableTestHelpersOnHardhat(owner, confidentialETH, anonymousPatientRegistry, eligibilityEngine);

    await encryptedScoreLeaderboard.authorizeCaller(engineAddr);
    await encryptedConsentGate.authorizeComputer(engineAddr);

    const sponsorEnc = await createEncryptedUint64(
        await sponsorRegistry.getAddress(),
        sponsor.address,
        1
    );
    await sponsorRegistry.connect(sponsor).requestSponsorship(sponsorEnc.handle, sponsorEnc.inputProof);
    await sponsorRegistry.connect(owner).addSponsor(sponsor.address, "Test Sponsor");

    return {
        owner,
        patient,
        sponsor,
        sponsor2,
        stranger,
        relayer,
        dataAccessLog,
        consentManager,
        sponsorRegistry,
        trialManager,
        anonymousPatientRegistry,
        honkVerifier,
        honkVerifierEncrypted,
        eligibilityEngine,
        encryptedConsentGate,
        encryptedScoreLeaderboard,
        medVaultRegistry,
        confidentialETH,
        trialMilestoneManager,
        sponsorIncentiveVault,
        medVaultAutomation,
        patientDocumentStore,
        mockSemaphore,
    };
}

export async function createTrialForSponsor(
    stack: MedVaultStack,
    sponsorSigner: HardhatEthersSigner = stack.sponsor,
    overrides: Partial<typeof DEFAULT_TRIAL_PARAMS> = {}
): Promise<bigint> {
    const p = { ...DEFAULT_TRIAL_PARAMS, ...overrides };
    // Plaintext createTrial is allowed only on Hardhat (chainid 31337) after the production gate.
    await stack.trialManager.connect(sponsorSigner).createTrial(
        p.name,
        p.phase,
        p.location,
        p.compensation,
        p.minAge,
        p.maxAge,
        p.requiresDiabetes,
        p.minHb,
        p.genderReq,
        p.minHeight,
        p.maxWeight,
        p.requiresNonSmoker,
        p.requiresNormalBP,
        p.duration
    );
    const counter = await stack.trialManager.trialCounter();
    return counter - 1n;
}

export async function createEncryptedTrialForSponsor(
    stack: MedVaultStack,
    sponsorSigner: HardhatEthersSigner = stack.sponsor,
    overrides: Partial<typeof DEFAULT_TRIAL_PARAMS> = {}
): Promise<bigint> {
    const p = { ...DEFAULT_TRIAL_PARAMS, ...overrides };
    const tmAddr = await stack.trialManager.getAddress();
    const encMaxWeight = p.maxWeight > 0 ? p.maxWeight : 65535;
    const inputs = await buildSponsorCriteriaInputs(tmAddr, sponsorSigner.address, {
        minAge: p.minAge,
        maxAge: p.maxAge,
        requiresDiabetes: p.requiresDiabetes,
        minHb: p.minHb,
        genderReq: p.genderReq,
        minHeight: p.minHeight,
        maxWeight: encMaxWeight,
        requiresNonSmoker: p.requiresNonSmoker,
        requiresNormalBP: p.requiresNormalBP,
    });
    await stack.trialManager.connect(sponsorSigner).createTrialWithEncryptedCriteria(
        p.name,
        p.phase,
        p.location,
        p.compensation,
        inputs.minAge.handle,
        inputs.maxAge.handle,
        inputs.requiresDiabetes.handle,
        inputs.minHb.handle,
        inputs.genderRequirement.handle,
        inputs.minHeight.handle,
        inputs.maxWeight.handle,
        inputs.requiresNonSmoker.handle,
        inputs.requiresNormalBP.handle,
        inputs.inputProof,
        p.duration
    );
    const counter = await stack.trialManager.trialCounter();
    await stack.encryptedScoreLeaderboard.setTrialSponsor(counter - 1n, sponsorSigner.address);
    return counter - 1n;
}

export async function registerPatientOnRegistry(
    stack: MedVaultStack,
    patientSigner: HardhatEthersSigner,
    commitment: bigint,
    permitRecipient: string,
    profile: PatientProfileValues
): Promise<{ profileSalt: bigint }> {
    const mvrAddr = await stack.medVaultRegistry.getAddress();
    const aprAddr = await stack.anonymousPatientRegistry.getAddress();
    const inputs = await buildPatientProfileInputs(aprAddr, mvrAddr, profile);
    const profileSalt = randomProfileSalt();
    const profileCommitment = computeProfileCommitment(commitment, profile, profileSalt);
    const saltCommitment = profileSaltCommitment(profileSalt);
    await stack.medVaultRegistry.connect(patientSigner).registerPatient(
        commitment,
        permitRecipient,
        `0x${profileCommitment.toString(16).padStart(64, "0")}` as `0x${string}`,
        saltCommitment,
        inputs.age.handle,
        inputs.gender.handle,
        inputs.weight.handle,
        inputs.height.handle,
        inputs.hasDiabetes.handle,
        inputs.hbLevel.handle,
        inputs.isSmoker.handle,
        inputs.hasHypertension.handle,
        inputs.inputProof
    );
    return { profileSalt };
}

/** Fast-path patient seed via cleartext test helpers (Hardhat chainId 31337 only). */
export async function seedPatientClear(
    stack: MedVaultStack,
    commitment: bigint,
    permitRecipient: string,
    profile: PatientProfileValues
) {
    const expected = computeProfileCommitment(commitment, profile, await defaultProfileSalt(commitment));
    const registryAddr = await stack.medVaultRegistry.getAddress();
    const registrySigner = await ethers.getImpersonatedSigner(registryAddr);
    await ethers.provider.send("hardhat_setBalance", [registryAddr, "0x1000000000000000000"]);
    await stack.anonymousPatientRegistry.connect(registrySigner).registerPatientClear(
        commitment,
        permitRecipient,
        profile.age,
        profile.gender,
        profile.weight,
        profile.height,
        profile.hasDiabetes,
        profile.hbLevel,
        profile.isSmoker,
        profile.hasHypertension
    );
    const engineAddr = await stack.eligibilityEngine.getAddress();
    const engineSigner = await ethers.getImpersonatedSigner(engineAddr);
    const onChain = await stack.anonymousPatientRegistry.connect(engineSigner).getProfileCommitment(commitment);
    if (onChain !== `0x${expected.toString(16).padStart(64, "0")}`) {
        throw new Error("registerPatientClear profileCommitment mismatch");
    }
}

export async function mintClearCeth(
    stack: MedVaultStack,
    to: string,
    units: bigint
) {
    await stack.confidentialETH.mintClear(to, units);
}

/** Seed APR + Semaphore group for fast anonymous apply fuzz paths. */
export async function seedPatientForAnonymousApply(
    stack: MedVaultStack,
    commitment: bigint,
    permitRecipient: string,
    profile: PatientProfileValues
) {
    await seedPatientClear(stack, commitment, permitRecipient, profile);
    const groupId = await stack.medVaultRegistry.patientGroupId();
    await stack.mockSemaphore.addMember(groupId, commitment);
}
