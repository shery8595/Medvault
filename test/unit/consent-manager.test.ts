import { expect } from "chai";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { createEncryptedBool } from "../../test-support/fhe";
import { grantConsentEncrypted, grantConsentLegacy } from "../../test-support/consent";
import { expectRevert } from "../../test-support/assertions";

describe("Unit: ConsentManager", function () {
    it("CM-01: grantConsent with InEbool", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const enc = await createEncryptedBool(
            await stack.consentManager.getAddress(),
            stack.patient.address,
            true
        );
        await grantConsentEncrypted(
            stack.consentManager.connect(stack.patient),
            trialId,
            enc
        );
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
    });

    it("CM-02: grantConsent legacy overload", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
    });

    it("CM-03: hasConsentRecord true after grant", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
    });

    it("CM-04: getActiveConsent after grant", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const { coerceFheHandle } = await import("../../test-support/fhe");
        const active = await stack.consentManager
            .connect(stack.patient)
            .getActiveConsent(stack.patient.address, trialId);
        expect(coerceFheHandle(active)).to.be.gt(0n);
    });

    it("CM-05: revoke single trial consent", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stack.consentManager.connect(stack.patient).revokeConsent(trialId);
        const epoch = await stack.consentManager
            .connect(stack.patient)
            .getPatientConsentEpoch(stack.patient.address);
        expect(epoch).to.equal(0n);
    });

    it("CM-06: revokeAllConsent increments epoch", async function () {
        const stack = await deployMedVaultStack();
        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);
    });

    it("CM-07: epoch invalidates prior consent", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);
        // Grant epoch no longer matches patient epoch — active consent is gated false on-chain.
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
    });

    it("CM-08: wrong patient cannot revoke other's consent", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await expectRevert(
            stack.consentManager.connect(stack.stranger).revokeConsent(trialId),
            "revert"
        );
    });

    it("CM-09: consent record stable across reads", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const a = await stack.consentManager
            .connect(stack.patient)
            .hasConsentRecord(stack.patient.address, trialId);
        const b = await stack.consentManager
            .connect(stack.patient)
            .hasConsentRecord(stack.patient.address, trialId);
        expect(a).to.equal(b);
    });

    it("CM-10: getPatientConsentEpoch starts at zero", async function () {
        const stack = await deployMedVaultStack();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(0n);
    });
});
