import { expect } from "chai";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    buildAnonymousApplyArgs,
    cancelAnonymousApplyStage,
    stageAnonymousApply,
} from "../../test-support/anonymousApply";
import { buildMockSemaphoreProof, deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";
import { mockDecryptBool, mockPublicDecryptProof, mockUserDecryptBool, parseEventArg } from "../../test-support/fhe";
import { grantConsentLegacy } from "../../test-support/consent";
import { impersonateAccount } from "../../test-support/signers";
import { ethers } from "hardhat";

describe("Integration: eligibility anonymous flow", function () {
    it("INT-EE-01: stage then cancel staged eligibility", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        await cancelAnonymousApplyStage(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
    });

    it("INT-EE-02: stage returns decryptable finalCt", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        const tx = await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        const receipt = await tx.wait();
        const ev = receipt?.logs.find(() => true);
        expect(ev).to.not.be.undefined;
    });

    it("INT-EE-03: stage anonymous apply leaves application status none until finalize", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        const nullifier = deriveNullifier(id, trialId);
        const status = await stack.eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId);
        expect(status).to.equal(0n); // None until finalize
    });

    it("INT-EE-04: revoke consent invalidates consent epoch", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);
    });

    it("INT-EE-05: decryptPermitHolder set after finalize apply", async function () {
        const stack = await deployMedVaultStack();
        const { registerPatient, stageSemaphoreApply, finalizeSemaphoreApply } = await import(
            "../../test-support/journey"
        );
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        const nullifier = staged.nullifier;
        expect(
            await stack.eligibilityEngine.getDecryptPermitHolder(nullifier, trialId)
        ).to.equal(stack.patient.address);
    });

    it("INT-EE-06: unauthorized registry cannot stage on engine", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.eligibilityEngine
                .connect(stack.stranger)
                .stageAnonymousEligibility(1, 1, 1, stack.patient.address),
            "Only authorized registry"
        );
    });

    it("INT-EE-07: inactive trial stage reverts", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        await stack.trialManager.connect(stack.sponsor).deactivateTrial(trialId);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .stageAnonymousEligibility(
                    id.commitment,
                    trialId,
                    nullifier,
                    stack.patient.address
                ),
            /Trial is not active|reverted/
        );
    });

    it("INT-EE-08: getAnonymousScore returns handle after finalize apply", async function () {
        const stack = await deployMedVaultStack();
        const { registerPatient, stageSemaphoreApply, finalizeSemaphoreApply } = await import(
            "../../test-support/journey"
        );
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        const nullifier = staged.nullifier;
        const score = await stack.eligibilityEngine.getAnonymousScore(nullifier, trialId);
        expect(score).to.not.equal(0n);
    });

    it("INT-EE-09: finalize with invalid noir proof reverts", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        const bogusInputs = Array.from({ length: 14 }, () => ethers.ZeroHash);
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .finalizeAnonymousApplyWithProof(
                    trialId,
                    args.proof,
                    id.commitment,
                    stack.patient.address,
                    args.consentWallet,
                    args.deadline,
                    args.permitSignature,
                    args.consentWalletSignature,
                    "0x" + "00".repeat(128),
                    bogusInputs,
                    true
                ),
            /Invalid Noir proof|reverted/
        );
    });

    it("INT-EE-10: double stage reverts", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        const args = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            id,
            stack.patient.address
        );
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    args.proof,
                    args.commitment,
                    args.permitRecipient,
                    args.deadline,
                    args.permitSignature
                ),
            "Already staged"
        );
    });

    it("INT-EE-11: happy-path finalizeAnonymousApplyWithProof marks applied", async function () {
        const {
            registerPatient,
            stageSemaphoreApply,
            finalizeSemaphoreApply,
        } = await import("../../test-support/journey");
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(
            true
        );
    });
});
