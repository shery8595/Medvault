import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { registerPatient, walletApplyWithConsent, deployMedVaultStack, createTrialForSponsor } from "../../test-support/journey";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";

describe("Integration: vault funding and distribution", function () {
    async function fundedParticipant(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, stack.patient, false);
        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        return { trialId, nullifier };
    }

    it("INT-VAULT-01: fund register distribute flow", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });

    it("INT-VAULT-02: fund emits IncentiveFunded", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expect(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .fundTrial(trialId, { value: 10n ** 17n })
        ).to.emit(stack.sponsorIncentiveVault, "IncentiveFunded");
    });

    it("INT-VAULT-03: milestone set and partial distribute path", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        const firstDeadline = now + 3600n;
        const secondDeadline = trial.endTime > firstDeadline + 100n ? trial.endTime - 10n : firstDeadline + 7200n;
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "End"],
            [6000, 4000],
            [firstDeadline, secondDeadline]
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(true);
    });

    it("INT-VAULT-04: automation performUpkeep releases screening (milestone 0)", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        const firstDeadline = now + 3600n;
        const secondDeadline = trial.endTime > firstDeadline + 100n ? trial.endTime - 10n : firstDeadline + 7200n;
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "End"],
            [5000, 5000],
            [firstDeadline, secondDeadline]
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await stack.medVaultAutomation.connect(stack.owner).performUpkeep(data);
        expect(await stack.medVaultAutomation.finalized(trialId)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(true);
    });

    it("INT-VAULT-05: getEncryptedPoolSize handle exists after fund", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        const size = await stack.sponsorIncentiveVault.getEncryptedPoolSize(trialId);
        expect(size).to.not.equal(0n);
    });

    it("INT-VAULT-06: distributePartial after screening distributed", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        const firstDeadline = now + 3600n;
        const secondDeadline = trial.endTime > firstDeadline + 100n ? trial.endTime - 10n : firstDeadline + 7200n;
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [firstDeadline, secondDeadline]
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distributePartial(trialId, 0);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(true);
    });

    it("INT-VAULT-07: participant count after register", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(1n);
    });

    it("INT-VAULT-08: isPoolFunded true", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 16n });
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(true);
    });

    it("INT-VAULT-09: distribute logs to DAL", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await fundedParticipant(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        const before = await stack.dataAccessLog.getLogCount();
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        const after = await stack.dataAccessLog.getLogCount();
        expect(after).to.be.greaterThan(before);
    });

    it("INT-VAULT-10: pagination reset by owner", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault.connect(stack.owner).resetPaginationState(trialId, 0);
    });
});
