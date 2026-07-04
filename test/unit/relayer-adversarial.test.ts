import { expect } from "chai";
import { ethers } from "hardhat";
import { assertFhevmMock, mockUserDecryptBool } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
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
import { authorizeRelayer } from "../../test-support/timelock";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import { buildAnonymousApplyArgs, cancelAnonymousApplyStage } from "../../test-support/anonymousApply";
import { createEncryptedBool, coerceFheHandle, mockUserDecryptUint64 } from "../../test-support/fhe";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Unit: relayer adversarial (REL-*)", function () {
    before(function () {
        assertFhevmMock();
    });

    beforeEach(async function () {
        const mod = await import("../../relayer/eligibility-decrypt.mjs");
        mod._resetCachesForTest();
    });

    describe("REL-EQV: equivocation", function () {
        it("REL-EQV-01: second relayer cannot finalize same nullifier after first succeeds", async function () {
            const stack = await deployMedVaultStack();
            const relayer2 = stack.sponsor2;
            await authorizeRelayer(stack.medVaultRegistry, stack.owner, relayer2.address);

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

            await stack.medVaultRegistry
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
                );

            await expectRevert(
                stack.medVaultRegistry
                    .connect(relayer2)
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
                /Already applied to this trial/
            );
        });

        it("REL-EQV-02: unauthorized wallet cannot finalize", async function () {
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
                    .connect(stack.sponsor2)
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
        });
    });

    describe("REL-REP: replay", function () {
        it("REL-REP-01: double finalize same nullifier reverts", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient);

            await finalizeSemaphoreApply(stack, staged, patient);

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
                    ),
                /Already applied to this trial/
            );
        });

        it("REL-REP-02: re-stage with stale permit after cancel reverts", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);

            const applyArgs = await buildAnonymousApplyArgs(
                stack.medVaultRegistry,
                trialId,
                patient.identity,
                stack.patient.address
            );

            await stack.medVaultRegistry
                .connect(stack.patient)
                .stageAnonymousApply(
                    trialId,
                    applyArgs.proof,
                    applyArgs.commitment,
                    applyArgs.permitRecipient,
                    applyArgs.deadline,
                    applyArgs.permitSignature
                );

            await cancelAnonymousApplyStage(
                stack.medVaultRegistry,
                stack.relayer,
                trialId,
                patient.identity,
                stack.patient.address
            );

            await expectRevert(
                stack.medVaultRegistry
                    .connect(stack.patient)
                    .stageAnonymousApply(
                        trialId,
                        applyArgs.proof,
                        applyArgs.commitment,
                        applyArgs.permitRecipient,
                        applyArgs.deadline,
                        applyArgs.permitSignature
                    ),
                /Stale stage permit/
            );
        });
    });

    describe("REL-FF: false finalize", function () {
        it("REL-FF-01: getRelayerEligible false when decrypt is false", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

            const { cacheStageHandle, getRelayerEligible } = await import(
                "../../relayer/eligibility-decrypt.mjs"
            );
            const block = await ethers.provider.getBlock(staged.stageReceipt.blockNumber);
            cacheStageHandle(staged.nullifier, trialId, staged.finalCt, Number(block!.timestamp) * 1000);

            const engineAddr = await stack.eligibilityEngine.getAddress();
            const relayerEligible = await getRelayerEligible({
                sdk: null,
                eligibilityEngineAddress: engineAddr,
                nullifier: staged.nullifier,
                trialId,
                finalCt: staged.finalCt,
                decryptFn: async (handle, contract) =>
                    mockUserDecryptBool(handle, contract, stack.relayer),
            });
            expect(relayerEligible).to.equal(false);
        });

        it("REL-FF-02: forged eligible cannot move vault when ciphertext is false (P2 gate)", async function () {
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
                    : await mockUserDecryptUint64(cethBefore, cethAddr, stack.patient.address);
            const afterUnits =
                coerceFheHandle(cethAfter) === 0n
                    ? 0n
                    : await mockUserDecryptUint64(cethAfter, cethAddr, stack.patient.address);
            expect(afterUnits).to.equal(beforeUnits);
        });
    });

    describe("REL-STALE: stale stage", function () {
        it("REL-STALE-01: finalize after STAGING_TTL_MS cache expiry -> STAGING_EXPIRED", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

            const { cacheStageHandle, getRelayerEligible, STAGING_TTL_MS } = await import(
                "../../relayer/eligibility-decrypt.mjs"
            );
            const expiredAtMs = Date.now() - STAGING_TTL_MS - 60_000;
            cacheStageHandle(staged.nullifier, trialId, staged.finalCt, expiredAtMs);

            const engineAddr = await stack.eligibilityEngine.getAddress();
            let err: Error & { code?: string } | undefined;
            try {
                await getRelayerEligible({
                    sdk: null,
                    eligibilityEngineAddress: engineAddr,
                    nullifier: staged.nullifier,
                    trialId,
                    finalCt: staged.finalCt,
                    decryptFn: async (handle, contract) =>
                        mockUserDecryptBool(handle, contract, stack.relayer),
                });
            } catch (e) {
                err = e as Error & { code?: string };
            }
            expect(err?.code).to.equal("STAGING_EXPIRED");
        });

        it("REL-STALE-02: cache invalidated after on-chain cancel", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

            const {
                cacheStageHandle,
                invalidateEligibilityCaches,
                resolveStagedFinalCt,
                getCachedStage,
            } = await import("../../relayer/eligibility-decrypt.mjs");
            const block = await ethers.provider.getBlock(staged.stageReceipt.blockNumber);
            cacheStageHandle(staged.nullifier, trialId, staged.finalCt, Number(block!.timestamp) * 1000);

            invalidateEligibilityCaches(staged.nullifier, trialId);
            expect(getCachedStage(staged.nullifier, trialId)).to.equal(null);

            let err: Error & { code?: string } | undefined;
            try {
                resolveStagedFinalCt({ nullifier: staged.nullifier, trialId });
            } catch (e) {
                err = e as Error & { code?: string };
            }
            expect(err?.code).to.equal("STAGING_NOT_FOUND");
        });
    });
});
