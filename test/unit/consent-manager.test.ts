import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { assertFhevmMock, createEncryptedBool, coerceFheHandle } from "../../test-support/fhe";
import { grantConsentEncrypted, grantConsentLegacy } from "../../test-support/consent";
import { expectRevert } from "../../test-support/assertions";

describe("Unit: ConsentManager", function () {
    before(function () {
        assertFhevmMock();
    });

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

    it("CM-11: revokeConsent clears record and blocks raw handle read", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);

        await stack.consentManager.connect(stack.patient).revokeConsent(trialId);

        expect(
            await stack.consentManager.connect(stack.patient).hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(false);
        await expectRevert(
            stack.consentManager
                .connect(stack.patient)
                .getEncryptedConsent(stack.patient.address, trialId),
            "No consent record"
        );
        const active = await stack.consentManager
            .connect(stack.patient)
            .getActiveConsent(stack.patient.address, trialId);
        expect(coerceFheHandle(active)).to.be.gt(0n);
    });

    it("CM-12: revokeConsent blocks getEncryptedConsent (no stale raw handle path)", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stack.consentManager.connect(stack.patient).revokeConsent(trialId);

        await expectRevert(
            stack.consentManager
                .connect(stack.patient)
                .getEncryptedConsent(stack.patient.address, trialId),
            "No consent record"
        );
    });

    it("CM-13: revokeAllConsent invalidates raw handle read", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);

        await stack.consentManager.connect(stack.patient).revokeAllConsent();

        await expectRevert(
            stack.consentManager
                .connect(stack.patient)
                .getEncryptedConsent(stack.patient.address, trialId),
            "Consent revoked or superseded"
        );
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);
        const active = await stack.consentManager
            .connect(stack.patient)
            .getActiveConsent(stack.patient.address, trialId);
        expect(coerceFheHandle(active)).to.be.gt(0n);
    });

    it("CM-14: revokeConsent rotates consent consumer ACL epochs", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const engineAddr = await stack.eligibilityEngine.getAddress();
        const gateAddr = await stack.encryptedConsentGate.getAddress();

        const engineEpochBefore = await stack.consentManager.aclEpochForKind(1);
        const gateEpochBefore = await stack.consentManager.aclEpochForKind(2);

        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stack.consentManager.connect(stack.patient).revokeConsent(trialId);

        expect(await stack.consentManager.aclEpochForKind(1)).to.equal(engineEpochBefore + 1n);
        expect(await stack.consentManager.aclEpochForKind(2)).to.equal(gateEpochBefore + 1n);
        expect(engineAddr).to.not.equal(ethers.ZeroAddress);
        expect(gateAddr).to.not.equal(ethers.ZeroAddress);
    });
});
