import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import {
    registerPatient,
    walletApplyWithConsent,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
} from "../../test-support/journey";
import { signConsentWalletBinding, defaultApplyDeadline } from "../../test-support/anonymousApply";
import { impersonateAccount } from "../../test-support/signers";
import { grantConsentLegacy } from "../../test-support/consent";

describe("Unit: consent wallet binding (M-2)", function () {
    it("M2-01: gate derives consent wallet from engine binding", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);

        const bound = await stack.eligibilityEngine
            .connect(stack.owner)
            .getConsentWalletForNullifier(staged.nullifier, trialId);
        expect(bound).to.equal(stack.patient.address);
    });

    it("M2-02: gate reverts when consent wallet not bound", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);

        await stack.encryptedConsentGate
            .connect(stack.owner)
            .authorizeComputer(await stack.eligibilityEngine.getAddress());

        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await expectRevert(
            stack.encryptedConsentGate
                .connect(engineSigner)
                .computeGateWithActiveConsent(trialId, 999n),
            /Wallet not bound/
        );
    });

    it("M2-03: invalid consent wallet signature reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);

        const { generateTestEligibilityProof } = await import("../../test-support/noirProof");
        const { mockUserDecryptBool } = await import("../../test-support/fhe");
        const eligible = await mockUserDecryptBool(
            staged.finalCt,
            await stack.eligibilityEngine.getAddress(),
            stack.patient
        );
        expect(eligible).to.equal(true);

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
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

        const registryAddress = await stack.medVaultRegistry.getAddress();
        const deadline = await defaultApplyDeadline();
        const badSig = await signConsentWalletBinding(
            stack.stranger,
            registryAddress,
            {
                nullifier: staged.nullifier,
                trialId,
                consentWallet: stack.patient.address,
                deadline,
            }
        );

        const { signAnonymousApplyPermit } = await import("../../test-support/anonymousApply");
        const permitSignature = await signAnonymousApplyPermit(
            stack.patient,
            registryAddress,
            {
                trialId,
                commitment: patient.commitment,
                nullifier: staged.nullifier,
                permitRecipient: stack.patient.address,
                deadline,
            }
        );

        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.patient)
                .finalizeAnonymousApplyWithProof(
                    trialId,
                    proofFresh,
                    patient.commitment,
                    stack.patient.address,
                    stack.patient.address,
                    deadline,
                    permitSignature,
                    badSig,
                    proofBytes,
                    publicInputs,
                    true
                ),
            /Invalid consent wallet signature/
        );
    });
});
