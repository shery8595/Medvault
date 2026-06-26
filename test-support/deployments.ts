import { ethers } from "hardhat";
import type { Contract } from "ethers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DEFAULT_TRIAL_PARAMS } from "./constants";
import { buildPatientProfileInputs, buildSponsorCriteriaInputs, type PatientProfileValues } from "./fhe";
import { createEncryptedUint64 } from "./fhe";
import { computeProfileCommitment } from "./profileCommitment";

export type MedVaultStack = {
    owner: HardhatEthersSigner;
    patient: HardhatEthersSigner;
    sponsor: HardhatEthersSigner;
    sponsor2: HardhatEthersSigner;
    stranger: HardhatEthersSigner;
    dataAccessLog: Contract;
    consentManager: Contract;
    sponsorRegistry: Contract;
    trialManager: Contract;
    anonymousPatientRegistry: Contract;
    honkVerifier: Contract;
    eligibilityEngine: Contract;
    encryptedConsentGate: Contract;
    encryptedScoreLeaderboard: Contract;
    medVaultRegistry: Contract;
    confidentialETH: Contract;
    trialMilestoneManager: Contract;
    sponsorIncentiveVault: Contract;
    medVaultAutomation: Contract;
    mockSemaphore: Contract;
};

async function deploy(name: string, ...args: unknown[]): Promise<Contract> {
    const factory = await ethers.getContractFactory(name);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
}

async function authorizeDataAccessLogger(
    dataAccessLog: Contract,
    owner: HardhatEthersSigner,
    loggerAddress: string
) {
    const { time } = await import("@nomicfoundation/hardhat-network-helpers");
    await dataAccessLog.connect(owner).scheduleAuthorizedLogger(loggerAddress, true);
    const delay = await dataAccessLog.LOGGER_CHANGE_DELAY();
    await time.increase(Number(delay) + 1);
    await dataAccessLog.connect(owner).applyAuthorizedLogger(loggerAddress);
}

export async function deployMedVaultStack(): Promise<MedVaultStack> {
    const signers = await ethers.getSigners();
    const [owner, patient, sponsor, sponsor2, stranger] = signers;

    const dataAccessLog = await deploy("DataAccessLog");
    const consentManager = await deploy("ConsentManager", true);
    const sponsorRegistry = await deploy("SponsorRegistry");
    const trialManager = await deploy("TrialManager", await sponsorRegistry.getAddress(), true);

    const anonymousPatientRegistry = await deploy("AnonymousPatientRegistry");
    const honkVerifier = await deploy("HonkVerifier");

    const eligibilityEngine = await deploy(
        "EligibilityEngine",
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

    const sponsorIncentiveVault = await deploy(
        "SponsorIncentiveVault",
        await confidentialETH.getAddress(),
        await trialManager.getAddress(),
        await eligibilityEngine.getAddress()
    );

    const medVaultAutomation = await deploy(
        "MedVaultAutomation",
        await trialManager.getAddress(),
        await sponsorIncentiveVault.getAddress(),
        ethers.ZeroAddress
    );

    await consentManager.setEligibilityEngine(await eligibilityEngine.getAddress());
    await consentManager.setDataAccessLog(await dataAccessLog.getAddress());
    await consentManager.setConsentGate(await encryptedConsentGate.getAddress());
    await eligibilityEngine.setDataAccessLog(await dataAccessLog.getAddress());
    await eligibilityEngine.setAuthorizedRegistry(await medVaultRegistry.getAddress());
    await eligibilityEngine.setConsentGate(await encryptedConsentGate.getAddress());
    await eligibilityEngine.setScoreLeaderboard(await encryptedScoreLeaderboard.getAddress());
    await eligibilityEngine.setEligibilityVerifier(await honkVerifier.getAddress());
    await eligibilityEngine.setAutomationContract(await medVaultAutomation.getAddress());

    await anonymousPatientRegistry.setAuthorizedRegistry(await medVaultRegistry.getAddress());
    await anonymousPatientRegistry.setAuthorizedEngine(await eligibilityEngine.getAddress());
    await anonymousPatientRegistry.setDataAccessLog(await dataAccessLog.getAddress());

    await confidentialETH.authorizeContract(await sponsorIncentiveVault.getAddress());
    await sponsorIncentiveVault.setMilestoneManager(await trialMilestoneManager.getAddress());
    await sponsorIncentiveVault.setDataAccessLog(await dataAccessLog.getAddress());
    await sponsorIncentiveVault.setAutomationContract(await medVaultAutomation.getAddress());
    await sponsorIncentiveVault.setSponsorRegistry(await sponsorRegistry.getAddress());
    await trialMilestoneManager.setVault(await sponsorIncentiveVault.getAddress());
    await trialMilestoneManager.setTrialManager(await trialManager.getAddress());
    await trialMilestoneManager.setDataAccessLog(await dataAccessLog.getAddress());
    await trialManager.setAutomationContract(await medVaultAutomation.getAddress());
    await eligibilityEngine.setSponsorIncentiveVault(await sponsorIncentiveVault.getAddress());

    await trialManager.setEligibilityEngine(await eligibilityEngine.getAddress());

    await authorizeDataAccessLogger(dataAccessLog, owner, await eligibilityEngine.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, await medVaultRegistry.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, await anonymousPatientRegistry.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, await sponsorIncentiveVault.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, await consentManager.getAddress());
    await authorizeDataAccessLogger(dataAccessLog, owner, await trialMilestoneManager.getAddress());

    const sponsorEnc = await createEncryptedUint64(
        await sponsorRegistry.getAddress(),
        sponsor.address,
        1
    );
    await sponsorRegistry.connect(sponsor).requestSponsorship(sponsorEnc.handle, sponsorEnc.inputProof);
    await sponsorRegistry.connect(owner).addSponsor(sponsor.address, "Test Sponsor");

    await encryptedScoreLeaderboard.authorizeCaller(await eligibilityEngine.getAddress());

    return {
        owner,
        patient,
        sponsor,
        sponsor2,
        stranger,
        dataAccessLog,
        consentManager,
        sponsorRegistry,
        trialManager,
        anonymousPatientRegistry,
        honkVerifier,
        eligibilityEngine,
        encryptedConsentGate,
        encryptedScoreLeaderboard,
        medVaultRegistry,
        confidentialETH,
        trialMilestoneManager,
        sponsorIncentiveVault,
        medVaultAutomation,
        mockSemaphore,
    };
}

export async function createTrialForSponsor(
    stack: MedVaultStack,
    sponsorSigner: HardhatEthersSigner = stack.sponsor,
    overrides: Partial<typeof DEFAULT_TRIAL_PARAMS> = {}
): Promise<bigint> {
    const p = { ...DEFAULT_TRIAL_PARAMS, ...overrides };
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
) {
    const mvrAddr = await stack.medVaultRegistry.getAddress();
    const aprAddr = await stack.anonymousPatientRegistry.getAddress();
    // FHE verifyInput binds (contract=APR, user=MVR): APR.registerPatient sees msg.sender = MVR.
    const inputs = await buildPatientProfileInputs(aprAddr, mvrAddr, profile);
    const profileCommitment = computeProfileCommitment(commitment, profile);
    await stack.medVaultRegistry.connect(patientSigner).registerPatient(
        commitment,
        permitRecipient,
        `0x${profileCommitment.toString(16).padStart(64, "0")}` as `0x${string}`,
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
}
