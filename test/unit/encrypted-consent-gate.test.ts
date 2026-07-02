import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { expectRevert } from "../../test-support/assertions";
import {
    registerPatient,
    walletApplyWithConsent,
    sponsorAcceptApplication,
} from "../../test-support/journey";
import { grantConsentLegacy } from "../../test-support/consent";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { assertFhevmMock, coerceFheHandle, mockUserDecryptBool } from "../../test-support/fhe";

describe("Unit: EncryptedConsentGate", function () {
    before(function () {
        assertFhevmMock();
    });
    it("ECG-01: authorize and deauthorize computer", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(stack.stranger.address);
        expect(await stack.encryptedConsentGate.authorizedComputers(stack.stranger.address)).to.equal(
            true
        );
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .deauthorizeComputer(stack.stranger.address);
        expect(await stack.encryptedConsentGate.authorizedComputers(stack.stranger.address)).to.equal(
            false
        );
    });

    it("ECG-02: unauthorized computer reverts computeGate", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.encryptedConsentGate
                .connect(stack.stranger)
                .getFunction("computeGate(uint256,bytes32,bytes32,bytes32)")(
                    1,
                    "0x" + "00".repeat(32),
                    "0x" + "00".repeat(32),
                    "0x" + "00".repeat(32)
                ),
            /Not authorized|reverted/
        );
    });

    it("ECG-03: setTrialSponsor only owner", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .setTrialSponsor(1, stack.sponsor.address);
        expect(await stack.encryptedConsentGate.trialSponsor(1)).to.equal(stack.sponsor.address);
    });

    it("ECG-04: gateExists false initially", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.encryptedConsentGate.gateExists(1, "0x" + "aa".repeat(32))).to.equal(false);
    });

    it("ECG-05: verifyGatePassed false when no gate", async function () {
        const stack = await deployMedVaultStack();
        const passed = await stack.encryptedConsentGate.verifyGatePassed(1, "0x" + "bb".repeat(32));
        expect(passed === false || passed === 0n || passed === "0x" + "00".repeat(32)).to.equal(
            true
        );
    });

    it("ECG-06: owner can authorize computer for computeGateWithActiveConsent path", async function () {
        const stack = await deployMedVaultStack();
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(await stack.eligibilityEngine.getAddress());
        expect(
            await stack.encryptedConsentGate.authorizedComputers(
                await stack.eligibilityEngine.getAddress()
            )
        ).to.equal(true);
    });

    it("P2-ECG-01: computeGateWithActiveConsent returns FHE ebool (no plaintext eligibility branch)", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, stack.patient, false);
        await sponsorAcceptApplication(stack, trialId, nullifier);

        await stack.encryptedConsentGate
            .connect(stack.owner)
            .setTrialSponsor(trialId, stack.sponsor.address);
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(stack.owner.address);

        const tx = await stack.encryptedConsentGate
            .connect(stack.owner)
            .computeGateWithActiveConsent(trialId, nullifier);
        const rc = await tx.wait();
        const gatedHandle = rc?.logs
            .map((l) => {
                try {
                    return stack.encryptedConsentGate.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "GateComputed")?.args.gatedResult;

        expect(coerceFheHandle(gatedHandle)).to.be.gt(0n);

        const patientWallet = await stack.eligibilityEngine.getConsentWalletForNullifier(
            nullifier,
            trialId
        );
        const uniqueId = ethers.keccak256(
            ethers.solidityPacked(
                ["uint256", "uint256", "address", "uint256"],
                [
                    trialId,
                    nullifier,
                    patientWallet,
                    await stack.consentManager.patientConsentEpoch(patientWallet),
                ]
            )
        );

        const stored = await stack.encryptedConsentGate
            .connect(stack.owner)
            .getGatedResult(trialId, uniqueId);
        expect(coerceFheHandle(stored)).to.equal(coerceFheHandle(gatedHandle));
        expect(await stack.encryptedConsentGate.gateExists(trialId, uniqueId)).to.equal(true);
    });

    it("ECG-07: computeGateWithActiveConsent gates false after revokeConsent", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, stack.patient, false);
        await sponsorAcceptApplication(stack, trialId, nullifier);

        await stack.consentManager.connect(stack.patient).revokeConsent(trialId);

        await stack.encryptedConsentGate
            .connect(stack.owner)
            .setTrialSponsor(trialId, stack.sponsor.address);
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(stack.owner.address);

        const tx = await stack.encryptedConsentGate
            .connect(stack.owner)
            .computeGateWithActiveConsent(trialId, nullifier);
        const rc = await tx.wait();
        const gatedHandle = rc?.logs
            .map((l) => {
                try {
                    return stack.encryptedConsentGate.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "GateComputed")?.args.gatedResult;

        expect(coerceFheHandle(gatedHandle)).to.be.gt(0n);
        expect(
            await mockUserDecryptBool(
                gatedHandle,
                await stack.encryptedConsentGate.getAddress(),
                stack.sponsor
            )
        ).to.equal(false);
    });

    it("ECG-08: computeGateWithActiveConsent gates false after revokeAllConsent", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, stack.patient, false);
        await sponsorAcceptApplication(stack, trialId, nullifier);

        await stack.consentManager.connect(stack.patient).revokeAllConsent();

        await stack.encryptedConsentGate
            .connect(stack.owner)
            .setTrialSponsor(trialId, stack.sponsor.address);
        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(stack.owner.address);

        const tx = await stack.encryptedConsentGate
            .connect(stack.owner)
            .computeGateWithActiveConsent(trialId, nullifier);
        const rc = await tx.wait();
        const gatedHandle = rc?.logs
            .map((l) => {
                try {
                    return stack.encryptedConsentGate.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "GateComputed")?.args.gatedResult;

        expect(coerceFheHandle(gatedHandle)).to.be.gt(0n);
        expect(
            await mockUserDecryptBool(
                gatedHandle,
                await stack.encryptedConsentGate.getAddress(),
                stack.sponsor
            )
        ).to.equal(false);
    });
});
