import { expect } from "chai";
import { assertFhevmMock } from "../../test-support/fhe";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { grantConsentLegacy } from "../../test-support/consent";
import {
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
} from "../../test-support/journey";
import { impersonateAccount } from "../../test-support/signers";

describe("Unit: consent gate FHE ACL (Plan 00a)", function () {
    before(function () {
        assertFhevmMock();
    });

    it("CGA-01: computeGateWithActiveConsent succeeds after finalize when consentGate is wired", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);

        await stack.encryptedConsentGate
            .connect(stack.owner)
            .setTrialSponsor(trialId, stack.sponsor.address);
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(await stack.eligibilityEngine.getAddress());

        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);

        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await expect(
            stack.encryptedConsentGate
                .connect(engineSigner)
                .computeGateWithActiveConsent(trialId, staged.nullifier)
        ).to.not.be.reverted;

        const patientWallet = await stack.eligibilityEngine.getConsentWalletForNullifier(
            staged.nullifier,
            trialId
        );
        expect(patientWallet).to.equal(stack.patient.address);
    });
});
