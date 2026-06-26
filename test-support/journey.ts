import { ethers } from "hardhat";
import type { ContractTransactionReceipt } from "ethers";
import { Identity } from "@semaphore-protocol/identity";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
    type MedVaultStack,
} from "./deployments";
import { ELIGIBLE_PROFILE } from "./fixtures/profiles";
import type { PatientProfileValues } from "./fhe";
import {
    mockDecryptBool,
    mockUserDecryptUint64,
    parseEventArg,
} from "./fhe";
import { buildMockSemaphoreProof, deriveNullifier } from "./semaphore";
import {
    defaultApplyDeadline,
    signAnonymousApplyPermit,
    signConsentWalletBinding,
} from "./anonymousApply";
import { grantConsentLegacy } from "./consent";
import { DEFAULT_TRIAL_PARAMS, CET_MIN_DEPOSIT_WEI } from "./constants";
import { generateTestEligibilityProof } from "./noirProof";
import { deriveEphemeralWallet } from "./vaultEip712";

export type RegisteredPatient = {
    identity: Identity;
    commitment: bigint;
    profile: PatientProfileValues;
    nullifierFor: (trialId: bigint) => bigint;
};

export type StagedSemaphoreApply = {
    trialId: bigint;
    nullifier: bigint;
    proof: ReturnType<typeof buildMockSemaphoreProof>;
    finalCt: string;
    stageReceipt: ContractTransactionReceipt;
};

/** Register a patient with encrypted profile on MedVaultRegistry + APR. */
export async function registerPatient(
    stack: MedVaultStack,
    signer: HardhatEthersSigner = stack.patient,
    profile: PatientProfileValues = ELIGIBLE_PROFILE,
    permitRecipient?: string
): Promise<RegisteredPatient> {
    const identity = new Identity();
    await registerPatientOnRegistry(
        stack,
        signer,
        identity.commitment,
        permitRecipient ?? signer.address,
        profile
    );
    return {
        identity,
        commitment: identity.commitment,
        profile,
        nullifierFor: (trialId: bigint) => deriveNullifier(identity, trialId),
    };
}

/** Build Semaphore proof for trial apply. */
export function semaphoreProofFor(
    trialId: bigint,
    nullifier: bigint,
    commitment: bigint,
    permitRecipient: string
) {
    return buildMockSemaphoreProof(trialId, nullifier, commitment, permitRecipient);
}

/** Stage anonymous apply via MedVaultRegistry (Semaphore path). */
export async function stageSemaphoreApply(
    stack: MedVaultStack,
    trialId: bigint,
    patient: RegisteredPatient,
    signer: HardhatEthersSigner = stack.patient,
    permitRecipient?: string,
    permitIdentity?: Identity
): Promise<StagedSemaphoreApply> {
    const recipient = permitRecipient ?? signer.address;
    const nullifier = patient.nullifierFor(trialId);
    const proof = semaphoreProofFor(trialId, nullifier, patient.commitment, recipient);
    const registryAddress = await stack.medVaultRegistry.getAddress();
    const deadline = await defaultApplyDeadline();
    const permitSigner = permitIdentity
        ? deriveEphemeralWallet(permitIdentity).connect(ethers.provider)
        : await ethers.getSigner(recipient);
    const permitSignature = await signAnonymousApplyPermit(permitSigner, registryAddress, {
        trialId,
        commitment: patient.commitment,
        nullifier,
        permitRecipient: recipient,
        deadline,
    });
    const tx = await stack.medVaultRegistry
        .connect(signer)
        .stageAnonymousApply(
            trialId,
            proof,
            patient.commitment,
            recipient,
            deadline,
            permitSignature
        );
    const stageReceipt = (await tx.wait())!;
    const finalCt = parseEventArg(
        stageReceipt,
        stack.medVaultRegistry.interface,
        "AnonymousApplyStaged",
        "finalCt"
    );
    return { trialId, nullifier, proof, finalCt, stageReceipt };
}

/** Finalize staged Semaphore apply with Noir proof (no KMS public decrypt). */
export async function finalizeSemaphoreApply(
    stack: MedVaultStack,
    staged: StagedSemaphoreApply,
    patient: RegisteredPatient,
    signer: HardhatEthersSigner = stack.patient,
    permitRecipient?: string,
    permitIdentity?: Identity
) {
    const recipient = permitRecipient ?? signer.address;
    const decryptUser = permitIdentity
        ? deriveEphemeralWallet(permitIdentity).connect(ethers.provider)
        : await ethers.getSigner(recipient);
    const eligible = await (
        await import("./fhe")
    ).mockUserDecryptBool(
        staged.finalCt,
        await stack.eligibilityEngine.getAddress(),
        decryptUser
    );
    if (!eligible) {
        throw new Error("Not eligible for this trial");
    }

    const { proofBytes, publicInputs } = await generateTestEligibilityProof({
        identity: patient.identity,
        commitment: patient.commitment,
        trialId: staged.trialId,
        profile: patient.profile,
        eligible: true,
        fheStageHandle: staged.finalCt,
    });

    const proofFresh = semaphoreProofFor(
        staged.trialId,
        staged.nullifier,
        patient.commitment,
        recipient
    );

    const registryAddress = await stack.medVaultRegistry.getAddress();
    const deadline = await defaultApplyDeadline();
    const permitSigner = permitIdentity
        ? deriveEphemeralWallet(permitIdentity).connect(ethers.provider)
        : await ethers.getSigner(recipient);
    const permitSignature = await signAnonymousApplyPermit(permitSigner, registryAddress, {
        trialId: staged.trialId,
        commitment: patient.commitment,
        nullifier: staged.nullifier,
        permitRecipient: recipient,
        deadline,
    });
    const consentWallet = signer.address;
    const consentWalletSignature = await signConsentWalletBinding(
        await ethers.getSigner(consentWallet),
        registryAddress,
        {
            nullifier: staged.nullifier,
            trialId: staged.trialId,
            consentWallet,
            deadline,
        }
    );

    const tx = await stack.medVaultRegistry
        .connect(signer)
        .finalizeAnonymousApplyWithProof(
            staged.trialId,
            proofFresh,
            patient.commitment,
            recipient,
            consentWallet,
            deadline,
            permitSignature,
            consentWalletSignature,
            proofBytes,
            publicInputs,
            true
        );
    const receipt = await tx.wait();
    return { receipt, eligible };
}

/** Stage + finalize anonymous apply (replaces deprecated wallet applyToTrialWithConsent). */
export async function walletApplyWithConsent(
    stack: MedVaultStack,
    trialId: bigint,
    patient: RegisteredPatient,
    signer: HardhatEthersSigner = stack.patient,
    grantConsent = true
) {
    if (grantConsent) {
        await grantConsentLegacy(stack.consentManager.connect(signer), trialId);
    }
    const staged = await stageSemaphoreApply(stack, trialId, patient, signer);
    await finalizeSemaphoreApply(stack, staged, patient, signer);
    return { nullifier: staged.nullifier };
}

export async function sponsorAcceptApplication(
    stack: MedVaultStack,
    trialId: bigint,
    nullifier: bigint
) {
    await stack.eligibilityEngine
        .connect(stack.sponsor)
        .updateAnonymousApplicationStatus(trialId, nullifier, 2);
}

export async function sponsorRejectApplication(
    stack: MedVaultStack,
    trialId: bigint,
    nullifier: bigint
) {
    await stack.eligibilityEngine
        .connect(stack.sponsor)
        .updateAnonymousApplicationStatus(trialId, nullifier, 3);
}

export async function fundTrialPool(
    stack: MedVaultStack,
    trialId: bigint,
    fundWei: bigint = 10n ** 18n
) {
    await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
}

export async function registerInPool(
    stack: MedVaultStack,
    trialId: bigint,
    nullifier: bigint,
    signer: HardhatEthersSigner = stack.patient
) {
    await stack.sponsorIncentiveVault.connect(signer).registerAnonymousParticipant(trialId, nullifier);
}

export async function endTrialAndDistribute(stack: MedVaultStack, trialId: bigint) {
    const { time } = await import("@nomicfoundation/hardhat-network-helpers");
    await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
    await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
}

/** Full sponsor pool path after application is accepted. */
export async function fundRegisterAndDistribute(
    stack: MedVaultStack,
    trialId: bigint,
    nullifier: bigint,
    fundWei: bigint = 10n ** 18n,
    participant: HardhatEthersSigner = stack.patient
) {
    await fundTrialPool(stack, trialId, fundWei);
    await registerInPool(stack, trialId, nullifier, participant);
    await endTrialAndDistribute(stack, trialId);
}

function receiptGasCost(rc: ContractTransactionReceipt): bigint {
    return rc.gasUsed * (rc.gasPrice ?? 0n);
}

/** v0.9 completeWithdrawTo after claimParticipantRewards or requestWithdrawTo. */
export async function completeWithdrawToFromReceipt(
    cETH: { interface: { parseLog: (log: { topics: readonly string[]; data: string }) => unknown }; revealWithdrawToAmount: (user: string, cleartexts: string, proof: string) => Promise<{ wait: () => Promise<ContractTransactionReceipt | null> }>; completeWithdrawTo: (user: string, cleartexts: string, proof: string) => Promise<{ wait: () => Promise<ContractTransactionReceipt | null> }> },
    patientAddress: string,
    requestReceipt: ContractTransactionReceipt
) {
    const { mockPublicDecryptProof, parseEventArg } = await import("./fhe");
    const sufficientHandle = parseEventArg(
        requestReceipt,
        cETH.interface as never,
        "WithdrawToRequested",
        "sufficientHandle"
    );
    const { cleartexts, proof } = await mockPublicDecryptProof(sufficientHandle);
    const [owner] = await ethers.getSigners();
    const revealRc = await (
        await cETH.connect(owner).revealWithdrawToAmount(patientAddress, cleartexts, proof)
    ).wait();
    if (!revealRc) throw new Error("Reveal receipt missing");
    const amountHandle = parseEventArg(
        revealRc,
        cETH.interface as never,
        "WithdrawAmountRevealed",
        "amountHandle"
    );
    const amount = await mockPublicDecryptProof(amountHandle);
    const completeTx = await cETH.connect(owner).completeWithdrawTo(
        patientAddress,
        amount.cleartexts,
        amount.proof
    );
    const completeRc = await completeTx.wait();
    return { sufficientHandle, cleartexts, proof };
}

/** v0.9 completeWithdraw after requestWithdraw. */
export async function completeWithdrawFromReceipt(
    cETH: {
        interface: { parseLog: (log: { topics: readonly string[]; data: string }) => unknown };
        connect: (s: HardhatEthersSigner) => {
            revealWithdrawAmount: (cleartexts: string, proof: string) => Promise<{ wait: () => Promise<ContractTransactionReceipt | null> }>;
            completeWithdraw: (cleartexts: string, proof: string) => Promise<unknown>;
        };
    },
    patient: HardhatEthersSigner,
    requestReceipt: ContractTransactionReceipt
) {
    const { completeEncryptedWithdraw } = await import("./withdraw");
    return completeEncryptedWithdraw(
        cETH as never,
        patient,
        requestReceipt
    );
}

/** Claim confidential rewards and complete withdraw-to destination. */
export async function claimAndCompleteRewards(
    stack: MedVaultStack,
    trialId: bigint,
    nullifier: bigint,
    destination: string,
    units: bigint,
    claimSigner: HardhatEthersSigner = stack.patient
): Promise<{ gasCost: bigint }> {
    const { createEncryptedClaimUnits } = await import("./withdraw");
    const encrypted = await createEncryptedClaimUnits(
        await stack.confidentialETH.getAddress(),
        await stack.sponsorIncentiveVault.getAddress(),
        units
    );
    const claimTx = await stack.sponsorIncentiveVault
        .connect(claimSigner)
        .claimParticipantRewards(
            trialId,
            nullifier,
            destination,
            encrypted.handle,
            encrypted.inputProof
        );
    const claimRc = (await claimTx.wait())!;
    const gasCost = receiptGasCost(claimRc);
    await completeWithdrawToFromReceipt(stack.confidentialETH, stack.patient.address, claimRc);
    return { gasCost };
}

export async function patientConfidentialBalanceUnits(
    stack: MedVaultStack,
    patientAddress: string
): Promise<bigint> {
    const handle = await stack.confidentialETH.getBalance(patientAddress);
    return mockUserDecryptUint64(handle, await stack.confidentialETH.getAddress(), patientAddress);
}

export function weiToCethUnits(wei: bigint): bigint {
    const unitScale = 1_000_000_000_000n;
    return wei / unitScale;
}

export async function freshTrialWithPatient(
    profile: PatientProfileValues = ELIGIBLE_PROFILE,
    signer?: HardhatEthersSigner
) {
    const stack = await deployMedVaultStack();
    const who = signer ?? stack.patient;
    const patient = await registerPatient(stack, who, profile);
    const trialId = await createTrialForSponsor(stack);
    return { stack, patient, trialId };
}

export { CET_MIN_DEPOSIT_WEI, DEFAULT_TRIAL_PARAMS, deployMedVaultStack, createTrialForSponsor };
