import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { registerPatient, walletApplyWithConsent } from "../../test-support/journey";
import { completeMilestoneSigned } from "../../test-support/milestone";
import { confirmStagedReceipt, CHALLENGE_WINDOW_SECS } from "../../test-support/claimReceipt";

describe("Unit: vault security fixes (H-1/M-1/M-3/M-4)", function () {
    async function threeParticipantTrial(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [now + 3600n]
        );

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            const patient = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, signer);
            await stack.eligibilityEngine
                .connect(stack.sponsor)
                .updateAnonymousApplicationStatus(trialId, nullifier, 2);
            await stack.sponsorIncentiveVault.connect(signer).registerAnonymousParticipant(trialId, nullifier);
        }
        return { trialId, fundWei };
    }

    it("H-1: paginated screening batch 2+ succeeds after batch 1", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, fundWei } = await threeParticipantTrial(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 0, 1);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 1, 1);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 2, 1);

        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(true);
        for (const signer of [stack.patient, stack.stranger, stack.sponsor2]) {
            expect(
                await stack.sponsorIncentiveVault.entitlementStaged(trialId, signer.address, 0)
            ).to.equal(true);
        }
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);
        const distributed = await stack.sponsorIncentiveVault.getConfirmedDistributedWei(trialId);
        expect(distributed).to.be.gt(0n);
        expect(distributed).to.be.lte(fundWei);
    });

    it("M-1: bulk distribute cannot double-pay remainder after individual payout", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            const patient = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, signer);
            await stack.eligibilityEngine
                .connect(stack.sponsor)
                .updateAnonymousApplicationStatus(trialId, nullifier, 2);
            await stack.sponsorIncentiveVault.connect(signer).registerAnonymousParticipant(trialId, nullifier);
        }

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime - 10n]
        );
        for (const signer of signers) {
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                signer,
                trialId,
                0n
            );
            await completeMilestoneSigned(
                stack.trialMilestoneManager,
                stack.sponsor,
                signer,
                trialId,
                1n
            );
        }
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);

        expect(await stack.sponsorIncentiveVault.milestoneRemainderPaid(trialId, 1)).to.equal(true);

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distributePartial(trialId, 1);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.stranger.address, 1)
        ).to.equal(true);
    });

    it("M-3: owner reclaim to unverified sponsor reverts; reclaimAbandonedToOwner succeeds", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 17n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await time.increase(91 * 24 * 60 * 60);

        await stack.sponsorRegistry.connect(stack.owner).removeSponsor(stack.sponsor.address);
        expect(await stack.sponsorRegistry.isVerifiedSponsor(stack.sponsor.address)).to.equal(false);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId),
            /Sponsor no longer verified|SponsorNoLongerVerified/
        );

        const ownerBefore = await ethers.provider.getBalance(stack.owner.address);
        await stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId);
        const tx = await stack.sponsorIncentiveVault.connect(stack.owner).claimReclaimed(trialId);
        const rc = await tx.wait();
        const gas = rc!.gasUsed * rc!.gasPrice;
        const ownerAfter = await ethers.provider.getBalance(stack.owner.address);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
        expect(ownerAfter + gas - ownerBefore).to.be.gt(0n);
    });

    it("P2 / HIGH-1: reclaimAbandonedToOwner succeeds when sponsor removed mid-trial with participants", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, fundWei } = await threeParticipantTrial(stack);

        await stack.sponsorRegistry.connect(stack.owner).removeSponsor(stack.sponsor.address);
        expect(await stack.sponsorRegistry.isVerifiedSponsor(stack.sponsor.address)).to.equal(false);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await time.increase(91 * 24 * 60 * 60);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId),
            /Sponsor no longer verified|SponsorNoLongerVerified/
        );

        const ownerBefore = await ethers.provider.getBalance(stack.owner.address);
        await stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.pendingReclaimRecipient(trialId)).to.equal(
            stack.owner.address
        );
        expect(await stack.sponsorIncentiveVault.pendingReclaimWei(trialId)).to.equal(fundWei);

        const tx = await stack.sponsorIncentiveVault.connect(stack.owner).claimReclaimed(trialId);
        const rc = await tx.wait();
        const gas = rc!.gasUsed * rc!.gasPrice;
        const ownerAfter = await ethers.provider.getBalance(stack.owner.address);
        expect(ownerAfter + gas - ownerBefore).to.be.gt(0n);
        expect(await stack.sponsorIncentiveVault.pendingReclaimWei(trialId)).to.equal(0n);
    });

    it("P2 / HIGH-1: verified sponsor path still requires full distribution before reclaim", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await threeParticipantTrial(stack);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await time.increase(91 * 24 * 60 * 60);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId),
            /Sponsor still verified|SponsorStillVerified/
        );

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId),
            /Screening not yet distributed/
        );
    });

    it("M-4: reclaim blocked while eligible-unpaid completer exists after grace", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime - 10n]
        );
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.patient,
            trialId,
            0n
        );
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.patient,
            trialId,
            1n
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        await time.increase(91 * 24 * 60 * 60);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId),
            /Milestones not fully distributed|MilestonesNotFullyDistributed/
        );

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
        expect(
            await stack.sponsorIncentiveVault.confirmedPayout(trialId, stack.patient.address, 1)
        ).to.equal(false);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.patient.address, 1)
        ).to.equal(true);
    });
});
