import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";

describe("Unit: TrialMilestoneManager", function () {
    it("TMM-01: setMilestones sponsor only", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Treatment"],
            [5000, 5000],
            [trial.endTime - 100n, trial.endTime]
        );
        const milestones = await stack.trialMilestoneManager.getMilestones(trialId);
        expect(milestones.length).to.equal(2);
    });

    it("TMM-02: stranger cannot setMilestones", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        await expectRevert(
            stack.trialMilestoneManager.connect(stack.stranger).setMilestones(
                trialId,
                ["A"],
                [10000],
                [trial.endTime]
            ),
            "Only sponsor"
        );
    });

    it("TMM-03: completeMilestone requires registered participant", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [trial.endTime]
        );
        await expectRevert(
            stack.trialMilestoneManager
                .connect(stack.sponsor)
                .completeMilestone(trialId, stack.patient.address, 0, (await time.latest()) + 3600, "0x"),
            "revert"
        );
    });

    it("TMM-04: weight sum must equal 10000", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        await expectRevert(
            stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
                trialId,
                ["A", "B"],
                [3000, 3000],
                [trial.endTime, trial.endTime]
            ),
            "revert"
        );
    });

    it("TMM-05: getParticipantProgress default zero", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const progress = await stack.trialMilestoneManager.getParticipantProgress(
            trialId,
            stack.patient.address
        );
        expect(progress).to.equal(0n);
    });

    it("TMM-06: milestone deadline cannot exceed trial end", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        await expectRevert(
            stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
                trialId,
                ["Late"],
                [10000],
                [trial.endTime + 1000n]
            ),
            "revert"
        );
    });
});
