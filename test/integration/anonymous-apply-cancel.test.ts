import { expect } from "chai";
import { ethers } from "hardhat";
import { assertFhevmMock, mockDecryptBool } from "../../test-support/fhe";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { registerPatient, stageSemaphoreApply } from "../../test-support/journey";
import {
    buildAnonymousApplyArgs,
    cancelAnonymousApplyStage,
    stageAnonymousApply,
} from "../../test-support/anonymousApply";
import { deriveNullifier } from "../../test-support/semaphore";

describe("Integration: anonymous apply cancel (ineligible)", function () {
    before(function () {
        assertFhevmMock();
    });

    it("AAC-01: wallet path cancels ineligible stage with ephemeral permit recipient (7 args)", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);

        expect(
            await mockDecryptBool(staged.finalCt, await stack.eligibilityEngine.getAddress(), stack.patient.address)
        ).to.equal(false);

        const applyArgs = await buildAnonymousApplyArgs(
            stack.medVaultRegistry,
            trialId,
            patient.identity,
            stack.patient.address
        );

        await cancelAnonymousApplyStage(
            stack.medVaultRegistry,
            stack.relayer,
            trialId,
            patient.identity,
            stack.patient.address
        );

        const nullifier = deriveNullifier(patient.identity, trialId);
        const status = await stack.eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId);
        expect(status).to.equal(0n);

        const restaged = await stageSemaphoreApply(stack, trialId, patient);
        expect(restaged.finalCt).to.not.equal(ethers.ZeroHash);
        expect(applyArgs.permitRecipient).to.equal(stack.patient.address);
    });

    it("AAC-02: direct stage+cancel via test helper leaves no orphaned staging", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);

        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            patient.identity,
            stack.patient.address
        );

        await cancelAnonymousApplyStage(
            stack.medVaultRegistry,
            stack.relayer,
            trialId,
            patient.identity,
            stack.patient.address
        );

        const nullifier = deriveNullifier(patient.identity, trialId);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, nullifier)).to.equal(false);
    });
});
