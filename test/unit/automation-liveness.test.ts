import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { assertFhevmMock } from "../../test-support/fhe";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    sponsorAcceptApplication,
    registerInPool,
    fundTrialPool,
} from "../../test-support/journey";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";

describe("Unit: automation liveness (M-2 / Plan P3)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function registerOneParticipant(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        trialId: bigint
    ) {
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient);
        await finalizeSemaphoreApply(stack, staged, patient, stack.patient);
        await sponsorAcceptApplication(stack, trialId, staged.nullifier);
        await registerInPool(stack, trialId, staged.nullifier, stack.patient);
    }

    it("M2-01: stuck batch quarantines after MAX_BATCH_FAILURES and second trial finalizes", async function () {
        const stack = await deployMedVaultStack({ vaultHarness: true });

        const stuckTrialId = await createTrialForSponsor(stack);
        const healthyTrialId = await createTrialForSponsor(stack, stack.sponsor2);

        await fundTrialPool(stack, stuckTrialId);
        await registerOneParticipant(stack, stuckTrialId);

        await stack.sponsorIncentiveVault.setTestHelpersEnabled(true);
        await stack.sponsorIncentiveVault.setForceBatchRevertForTrial(stuckTrialId, true);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const maxFailures = await stack.medVaultAutomation.MAX_BATCH_FAILURES();

        for (let i = 1n; i < maxFailures; i++) {
            const [needed, data] = await stack.medVaultAutomation.checkUpkeep("0x");
            expect(needed).to.equal(true);
            await expect(stack.medVaultAutomation.connect(stack.owner).performUpkeep(data))
                .to.emit(stack.medVaultAutomation, "DistributionBatchFailed")
                .withArgs(stuckTrialId, (reason: string) => reason.length > 0);
            expect(await stack.medVaultAutomation.consecutiveBatchFailures(stuckTrialId)).to.equal(i);
            expect(await stack.medVaultAutomation.isQuarantined(stuckTrialId)).to.equal(false);
        }

        const [, quarantineData] = await stack.medVaultAutomation.checkUpkeep("0x");
        await expect(stack.medVaultAutomation.connect(stack.owner).performUpkeep(quarantineData))
            .to.emit(stack.medVaultAutomation, "TrialQuarantined")
            .withArgs(stuckTrialId, maxFailures);

        expect(await stack.medVaultAutomation.isQuarantined(stuckTrialId)).to.equal(true);
        expect(await stack.medVaultAutomation.finalized(stuckTrialId)).to.equal(false);

        const [neededHealthy, healthyData] = await stack.medVaultAutomation.checkUpkeep("0x");
        expect(neededHealthy).to.equal(true);
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["uint8", "uint256"],
            healthyData
        );
        expect(decoded[1]).to.equal(healthyTrialId);

        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(healthyData);
        expect(await stack.medVaultAutomation.finalized(healthyTrialId)).to.equal(true);
        const healthyTrial = await stack.trialManager.getTrial(healthyTrialId);
        expect(healthyTrial.active).to.equal(false);
    });

    it("M2-02: checkUpkeep gas stays bounded with many active trials", async function () {
        const stack = await deployMedVaultStack();
        const trialCount = 30;

        for (let i = 0; i < trialCount; i++) {
            await createTrialForSponsor(stack, i % 2 === 0 ? stack.sponsor : stack.sponsor2, {
                name: `Bulk trial ${i}`,
            });
        }

        const scanBatch = await stack.medVaultAutomation.ACTIVE_SCAN_BATCH_SIZE();
        expect(scanBatch).to.be.lessThan(trialCount);

        const gasBefore = await stack.medVaultAutomation.checkUpkeep.estimateGas("0x");

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const gasAfter = await stack.medVaultAutomation.checkUpkeep.estimateGas("0x");
        const ratio = Number(gasAfter) / Number(gasBefore);
        expect(ratio).to.be.lessThan(3);
    });

    it("M2-03: batch success resets consecutive failure counter", async function () {
        const stack = await deployMedVaultStack({ vaultHarness: true });
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);
        await registerOneParticipant(stack, trialId);

        await stack.sponsorIncentiveVault.setTestHelpersEnabled(true);
        await stack.sponsorIncentiveVault.setForceBatchRevertForTrial(trialId, true);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const [, failData] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(failData);
        expect(await stack.medVaultAutomation.consecutiveBatchFailures(trialId)).to.equal(1n);

        await stack.sponsorIncentiveVault.setForceBatchRevertForTrial(trialId, false);

        const [, successData] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(successData);
        expect(await stack.medVaultAutomation.consecutiveBatchFailures(trialId)).to.equal(0n);
        expect(await stack.medVaultAutomation.isQuarantined(trialId)).to.equal(false);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });
});
