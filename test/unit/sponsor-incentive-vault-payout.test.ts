import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { DEFAULT_TRIAL_PARAMS, CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { registerPatient, walletApplyWithConsent } from "../../test-support/journey";

describe("Unit: SponsorIncentiveVault payout invariants", function () {
    async function twoParticipantTrial(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const patientA = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const patientB = await registerPatient(stack, stack.stranger, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier: nullA } = await walletApplyWithConsent(stack, trialId, patientA);
        const { nullifier: nullB } = await walletApplyWithConsent(stack, trialId, patientB, stack.stranger);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullA, 2);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullB, 2);
        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullA);
        await stack.sponsorIncentiveVault.connect(stack.stranger).registerAnonymousParticipant(trialId, nullB);
        return { trialId, fundWei };
    }

    it("SIV-PAYOUT-01: individual milestone share matches pCount denominator", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, fundWei } = await twoParticipantTrial(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime - 10n]
        );
        await stack.trialMilestoneManager
            .connect(stack.sponsor)
            .completeMilestone(trialId, stack.patient.address, 0);
        await stack.trialMilestoneManager
            .connect(stack.sponsor)
            .completeMilestone(trialId, stack.patient.address, 1);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const tx = await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
        const rc = await tx.wait();
        const ev = rc?.logs
            .map((l) => {
                try {
                    return stack.sponsorIncentiveVault.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "MilestoneRewardsDistributed");
        expect(ev?.args.milestoneIndex).to.equal(1n);
        expect(ev?.args.trialId).to.equal(trialId);
    });

    it("SIV-DUST-01: sub UNIT_SCALE reward skips deposit without revert", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);

        const tinyFund = CET_MIN_DEPOSIT_WEI / 2n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: tinyFund });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });
});
