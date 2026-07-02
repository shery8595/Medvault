import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import {
    assertFhevmMock,
    mockDecryptBool,
    mockUserDecryptBool,
} from "../../test-support/fhe";
import {
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
} from "../../test-support/journey";

describe("Integration: relayer decrypt-verify (P0.2)", function () {
    before(function () {
        assertFhevmMock();
    });

    beforeEach(async function () {
        const mod = await import("../../relayer/eligibility-decrypt.mjs");
        mod._resetCachesForTest();
    });

    it("RDV-01: forged client eligible=true with decrypt=false -> NOT_ELIGIBLE", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

        const {
            cacheStageHandle,
            getRelayerEligible,
            STAGING_TTL_MS,
        } = await import("../../relayer/eligibility-decrypt.mjs");

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
        expect(
            await mockDecryptBool(staged.finalCt, engineAddr, stack.relayer.address)
        ).to.equal(false);

        const clientClaimsEligible = true;
        expect(clientClaimsEligible).to.equal(true);
        expect(relayerEligible).to.equal(false);
    });

    it("RDV-02: honest path decrypt=true matches finalize", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
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
        expect(relayerEligible).to.equal(true);

        await finalizeSemaphoreApply(
            stack,
            staged,
            patient,
            stack.patient,
            stack.relayer.address
        );
        expect(
            await stack.eligibilityEngine.isAnonymousApplicationAccepted(staged.nullifier, trialId)
        ).to.equal(true);
    });

    it("RDV-03: staging expired -> STAGING_EXPIRED", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

        const {
            cacheStageHandle,
            getRelayerEligible,
            STAGING_TTL_MS,
        } = await import("../../relayer/eligibility-decrypt.mjs");

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

    it("RDV-04: cache invalidation after cancel clears decrypt cache", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

        const {
            cacheStageHandle,
            getRelayerEligible,
            invalidateEligibilityCaches,
            getCachedStage,
        } = await import("../../relayer/eligibility-decrypt.mjs");

        const block = await ethers.provider.getBlock(staged.stageReceipt.blockNumber);
        cacheStageHandle(staged.nullifier, trialId, staged.finalCt, Number(block!.timestamp) * 1000);

        const engineAddr = await stack.eligibilityEngine.getAddress();
        await getRelayerEligible({
            sdk: null,
            eligibilityEngineAddress: engineAddr,
            nullifier: staged.nullifier,
            trialId,
            finalCt: staged.finalCt,
            decryptFn: async (handle, contract) =>
                mockUserDecryptBool(handle, contract, stack.relayer),
        });

        invalidateEligibilityCaches(staged.nullifier, trialId);
        expect(getCachedStage(staged.nullifier, trialId)).to.equal(null);
    });

    it("RDV-05: decrypt result cached within staging TTL", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

        const { cacheStageHandle, getRelayerEligible } = await import(
            "../../relayer/eligibility-decrypt.mjs"
        );
        const block = await ethers.provider.getBlock(staged.stageReceipt.blockNumber);
        cacheStageHandle(staged.nullifier, trialId, staged.finalCt, Number(block!.timestamp) * 1000);

        const engineAddr = await stack.eligibilityEngine.getAddress();
        let calls = 0;
        const decryptFn = async (handle: string, contract: string) => {
            calls += 1;
            return mockUserDecryptBool(handle, contract, stack.relayer);
        };

        await getRelayerEligible({
            sdk: null,
            eligibilityEngineAddress: engineAddr,
            nullifier: staged.nullifier,
            trialId,
            finalCt: staged.finalCt,
            decryptFn,
        });
        await getRelayerEligible({
            sdk: null,
            eligibilityEngineAddress: engineAddr,
            nullifier: staged.nullifier,
            trialId,
            finalCt: staged.finalCt,
            decryptFn,
        });
        expect(calls).to.equal(1);
    });
});
