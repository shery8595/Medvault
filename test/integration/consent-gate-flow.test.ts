import { expect } from "chai";
import { ethers } from "hardhat";
import { createEncryptedBool, assertFhevmMock } from "../../test-support/fhe";
import { grantConsentEncrypted } from "../../test-support/consent";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
} from "../../test-support/journey";

describe("Integration: consent and encrypted gate flows", function () {
    before(function () {
        assertFhevmMock();
    });

    it("CG-INT-01: encrypted consent grant before Semaphore apply", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const consentAddr = await stack.consentManager.getAddress();
        const encTrue = await createEncryptedBool(consentAddr, stack.patient.address, true);
        await grantConsentEncrypted(stack.consentManager.connect(stack.patient), trialId, encTrue);
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);

        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(
            true
        );
    });

    it("CG-INT-02: consent gate not computed before apply", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const uniqueId = ethers.keccak256(ethers.toUtf8Bytes("test-gate"));
        expect(await stack.encryptedConsentGate.gateExists(trialId, uniqueId)).to.equal(false);
    });

    it("CG-INT-03: revoke consent epoch blocks encrypted active consent path", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const consentAddr = await stack.consentManager.getAddress();
        const encTrue = await createEncryptedBool(consentAddr, stack.patient.address, true);
        await grantConsentEncrypted(stack.consentManager.connect(stack.patient), trialId, encTrue);
        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);
    });

    it("CG-INT-04: staged apply leaves application none until finalize", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { grantConsentLegacy } = await import("../../test-support/consent");
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        expect(
            await stack.eligibilityEngine.getAnonymousApplicationStatus(staged.nullifier, trialId)
        ).to.equal(0n);
    });
});
