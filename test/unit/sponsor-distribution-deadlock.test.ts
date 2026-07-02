import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { assertFhevmMock } from "../../test-support/fhe";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS, CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { sponsorAcceptApplication, fundTrialPool } from "../../test-support/journey";
import { completeMilestoneSigned } from "../../test-support/milestone";
import { confirmStagedReceipt } from "../../test-support/claimReceipt";

async function extraSigners(count: number): Promise<HardhatEthersSigner[]> {
    const all = await ethers.getSigners();
    return all.slice(5, 5 + count);
}

async function registerAcceptedParticipant(
    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
    trialId: bigint,
    signer: HardhatEthersSigner
) {
    const { registerPatient, walletApplyWithConsent } = await import("../../test-support/journey");
    const patient = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
    const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, signer);
    await sponsorAcceptApplication(stack, trialId, nullifier);
        await stack.sponsorIncentiveVault
        .connect(signer)
        .registerAnonymousParticipant(trialId, nullifier);
    return { patient, nullifier, signer };
}

describe("Unit: sponsor distribution deadlock fixes (Plan 00a)", function () {
    before(function () {
        assertFhevmMock();
    });

    it("SDD-01: >50 participants without milestones distributes fully via screening paginated", async function () {
        if (!process.env.RUN_LARGE_POOL_TEST) {
            this.skip();
        }
        this.timeout(600_000);
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const participantCount = 51;
        const fundWei = 10n ** 18n;
        await fundTrialPool(stack, trialId, fundWei);

        const wallets = await extraSigners(participantCount);
        for (const wallet of wallets) {
            await registerAcceptedParticipant(stack, trialId, wallet);
        }

        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(BigInt(participantCount));

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const batchSize = 10;
        let startIndex = 0n;
        while (startIndex < BigInt(participantCount)) {
            await stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributePartialPaginated(trialId, 0, startIndex, batchSize);
            startIndex = await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0);
        }

        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);

        await time.increase(91 * 24 * 60 * 60);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
    });

    it("SDD-02: paginated remainder reaches last payee across page boundaries", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 18n;
        await fundTrialPool(stack, trialId, fundWei);

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            await registerAcceptedParticipant(stack, trialId, signer);
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
        }
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.patient,
            trialId,
            1n
        );
        await completeMilestoneSigned(
            stack.trialMilestoneManager,
            stack.sponsor,
            stack.stranger,
            trialId,
            1n
        );

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        const milestoneShare = fundWei / 2n;
        const perParticipant = milestoneShare / 3n;

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 1, 0, 2);

        expect(await stack.sponsorIncentiveVault.lastPaidParticipantIndex(trialId, 1)).to.equal(1n);
        expect(await stack.sponsorIncentiveVault.milestoneRemainderPaid(trialId, 1)).to.equal(false);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 1, 2, 1);

        expect(await stack.sponsorIncentiveVault.milestoneRemainderPaid(trialId, 1)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 1)).to.equal(true);

        for (const signer of [stack.patient, stack.stranger]) {
            await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 1n, signer);
        }

        const distributedM1 = await stack.sponsorIncentiveVault.milestoneDistributedWei(trialId, 1);
        const unitScale = CET_MIN_DEPOSIT_WEI;
        const creditedPerEligible = (perParticipant / unitScale) * unitScale * 2n;
        expect(distributedM1 - creditedPerEligible).to.be.lte(2n);
        expect(creditedPerEligible - distributedM1).to.be.lte(2n);
    });

    it("SDD-03: sub-UNIT_SCALE rewards are not marked paid-with-zero", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const participantCount = 3;
        const fundWei = CET_MIN_DEPOSIT_WEI / 2n;
        await fundTrialPool(stack, trialId, fundWei);

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            await registerAcceptedParticipant(stack, trialId, signer);
        }

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        for (const signer of signers) {
            expect(
                await stack.sponsorIncentiveVault.participantMilestonePaid(trialId, signer.address, 0)
            ).to.equal(false);
        }
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });

    it("SDD-04: distribute() with milestones updates milestoneDistributedWei", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 18n;
        await fundTrialPool(stack, trialId, fundWei);

        await registerAcceptedParticipant(stack, trialId, stack.patient);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [now + 3600n]
        );

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        expect(await stack.sponsorIncentiveVault.milestoneDistributedWei(trialId, 0)).to.equal(0n);
        expect(
            await stack.sponsorIncentiveVault.getStagedShareWei(trialId, stack.patient.address, 0)
        ).to.be.gt(0n);

        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);

        const milestoneWei = await stack.sponsorIncentiveVault.milestoneDistributedWei(trialId, 0);
        expect(milestoneWei).to.be.gt(0n);
        expect(milestoneWei).to.be.lte(fundWei);
    });
});
