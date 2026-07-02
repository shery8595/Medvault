import { expect } from "chai";
import { ethers } from "hardhat";
import { assertFhevmMock, coerceFheHandle, createEncryptedBool, mockUserDecryptUint64 } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    fundTrialPool,
    registerInPool,
    sponsorAcceptApplication,
    semaphoreProofFor,
} from "../../test-support/journey";
import { authorizeRelayer, advanceTimelock } from "../../test-support/timelock";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import { buildAnonymousApplyArgs } from "../../test-support/anonymousApply";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Unit: P3 relayer trust reduction", function () {
    before(function () {
        assertFhevmMock();
    });

    describe("P3.1: multi-relayer allowlist", function () {
        it("P3-01: schedule/apply authorizes relayer; instant setTrustedRelayer reverts", async function () {
            const stack = await deployMedVaultStack();
            const relayer2 = stack.sponsor2;

            await expectRevert(
                stack.medVaultRegistry.connect(stack.owner).setTrustedRelayer(relayer2.address),
                /scheduleRelayerAuth/
            );

            expect(await stack.medVaultRegistry.authorizedRelayers(relayer2.address)).to.equal(false);
            await authorizeRelayer(stack.medVaultRegistry, stack.owner, relayer2.address);
            expect(await stack.medVaultRegistry.authorizedRelayers(relayer2.address)).to.equal(true);
        });

        it("P3-02: apply before timelock reverts", async function () {
            const stack = await deployMedVaultStack();
            const relayer2 = stack.sponsor2;
            await stack.medVaultRegistry.connect(stack.owner).scheduleRelayerAuth(relayer2.address, true);
            await expectRevert(
                stack.medVaultRegistry.connect(stack.owner).applyRelayerAuth(relayer2.address),
                /Timelock active/
            );
            await advanceTimelock();
            await stack.medVaultRegistry.connect(stack.owner).applyRelayerAuth(relayer2.address);
            expect(await stack.medVaultRegistry.authorizedRelayers(relayer2.address)).to.equal(true);
        });

        it("P3-03: unauthorized wallet cannot cancel staged apply", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);
            await stageSemaphoreApply(stack, trialId, patient);

            const { cancelAnonymousApplyStage } = await import("../../test-support/anonymousApply");
            await expectRevert(
                cancelAnonymousApplyStage(
                    stack.medVaultRegistry,
                    stack.sponsor2,
                    trialId,
                    patient.identity,
                    stack.patient.address
                ),
                /Only authorized relayer/
            );
        });
    });

    describe("P3.2: relayer-gated finalize (HIGH-1)", function () {
        it("P3-04: patient EOA cannot submit finalizeAnonymousApplyWithProof directly", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient);

            const { proofBytes, publicInputs } = await generateTestEligibilityProof({
                identity: patient.identity,
                commitment: patient.commitment,
                trialId,
                profile: patient.profile,
                profileSalt: patient.profileSalt,
                eligible: true,
                fheStageHandle: staged.finalCt,
            });
            const proofFresh = semaphoreProofFor(
                staged.trialId,
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

            await expectRevert(
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
                        publicInputs
            ),
                /Only authorized relayer/
            );

            await expect(
                stack.medVaultRegistry
                    .connect(stack.relayer)
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
                        publicInputs
            )
            ).to.emit(stack.medVaultRegistry, "AnonymousApplication");

            expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(true);
        });

        it("P3-05: forged eligible witness cannot move vault value when ciphertext is false (P2 gate)", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);
            const nullifier = staged.nullifier;
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);
            await registerInPool(stack, trialId, nullifier);

            const engineAddr = await stack.eligibilityEngine.getAddress();
            const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);
            await stack.eligibilityEngine.overwriteAnonymousResultForTest(
                nullifier,
                trialId,
                falseCt.handle,
                falseCt.inputProof
            );

            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            const cethBefore = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);
            await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
            const cethAfter = await stack.confidentialETH
                .connect(stack.patient)
                .getBalance(stack.patient.address);

            const cethAddr = await stack.confidentialETH.getAddress();
            const beforeUnits =
                coerceFheHandle(cethBefore) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient);
            const afterUnits =
                coerceFheHandle(cethAfter) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient);
            expect(afterUnits - beforeUnits).to.equal(0n);
        });
    });
});
