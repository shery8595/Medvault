import { expect } from "chai";
import { ethers } from "hardhat";
import { assertFhevmMock, mockDecryptBool } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import { PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import {
    freshTrialWithPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatient,
} from "../../test-support/journey";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import {
    buildAnonymousApplyArgs,
    cancelAnonymousApplyStage,
} from "../../test-support/anonymousApply";

describe("Unit: MedVaultRegistry v0.9 finalize", function () {
    before(function () {
        assertFhevmMock();
    });

    it("MVR-FIN-01: finalize sets hasAppliedToTrial true", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(true);
    });

    it("MVR-FIN-02: finalize emits AnonymousApplication", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId,
            profile: patient.profile,
            eligible: true,
            fheStageHandle: staged.finalCt,
        });
        const proofFresh = (
            await import("../../test-support/semaphore")
        ).buildMockSemaphoreProof(
            trialId,
            staged.nullifier,
            patient.commitment,
            stack.patient.address
        );
        const applyArgs = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            patient.identity,
            stack.patient.address
        );
        await expect(
            stack.medVaultRegistry
                .connect(stack.patient)
                .finalizeAnonymousApplyWithProof(
                    trialId,
                    proofFresh,
                    patient.commitment,
                    stack.patient.address,
                    applyArgs.consentWallet,
                    applyArgs.deadline,
                    applyArgs.permitSignature,
                    applyArgs.consentWalletSignature,
                    proofBytes,
                    publicInputs,
                    true
                )
        ).to.emit(stack.medVaultRegistry, "AnonymousApplication");
    });

    it("MVR-FIN-03: finalize without stage reverts", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const nullifier = patient.nullifierFor(trialId);
        const proof = (await import("../../test-support/semaphore")).buildMockSemaphoreProof(
            trialId,
            nullifier,
            patient.commitment,
            stack.patient.address
        );
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId,
            profile: patient.profile,
            eligible: true,
            fheStageHandle: ethers.ZeroHash,
        });
        const applyArgs = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            patient.identity,
            stack.patient.address
        );
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .finalizeAnonymousApplyWithProof(
                    trialId,
                    proof,
                    patient.commitment,
                    stack.patient.address,
                    applyArgs.consentWallet,
                    applyArgs.deadline,
                    applyArgs.permitSignature,
                    applyArgs.consentWalletSignature,
                    proofBytes,
                    publicInputs,
                    true
                ),
            /Nothing staged|reverted/
        );
    });

    it("MVR-FIN-04: stage then finalize records pending then accepted application", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        expect(
            await stack.eligibilityEngine.getAnonymousApplicationStatus(staged.nullifier, trialId)
        ).to.equal(0n);

        await finalizeSemaphoreApply(stack, staged, patient);
        expect(
            await stack.eligibilityEngine.getAnonymousApplicationStatus(staged.nullifier, trialId)
        ).to.equal(1n);
    });

    it("MVR-FIN-05: ineligible decrypt bool false before finalize attempt", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        expect(await mockDecryptBool(staged.finalCt, await stack.eligibilityEngine.getAddress(), stack.patient.address)).to.equal(false);
    });

    it("MVR-FIN-06: cancel after stage allows restage", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await cancelAnonymousApplyStage(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            patient.identity,
            stack.patient.address
        );
        const restaged = await stageSemaphoreApply(stack, trialId, patient);
        expect(restaged.finalCt).to.not.equal(ethers.ZeroHash);
    });
});
