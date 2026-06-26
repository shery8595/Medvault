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
import { expectRevert } from "../../test-support/assertions";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import {
    freshTrialWithPatient,
    walletApplyWithConsent,
    sponsorAcceptApplication,
    fundRegisterAndDistribute,
    claimAndCompleteRewards,
    weiToCethUnits,
    registerPatient,
} from "../../test-support/journey";
import { createEncryptedUint64 } from "../../test-support/fhe";

describe("Unit: SponsorIncentiveVault", function () {
    async function setupAcceptedApplicant(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2); // Accepted
        return { trialId, nullifier, id: patient.identity };
    }

    it("SIV-01: fundTrial locks deposit", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(true);
    });

    it("SIV-02: double fund before lock allowed", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 17n });
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 17n });
        const deposited = await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .getTotalDeposited(trialId);
        expect(deposited).to.equal(2n * 10n ** 17n);
    });

    it("SIV-03: isPoolFunded false before fund", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(false);
    });

    it("SIV-04: stranger cannot fund", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.stranger)
                .fundTrial(trialId, { value: 10n ** 18n }),
            "Only sponsor can fund"
        );
    });

    it("SIV-05: registerAnonymousParticipant after accepted", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        expect(await stack.sponsorIncentiveVault.isParticipantRegistered(trialId, stack.patient.address)).to.equal(
            true
        );
    });

    it("SIV-06: nullifier double registration reverts", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .registerAnonymousParticipant(trialId, nullifier),
            /Nullifier already used|reverted/
        );
    });

    it("SIV-07: distribute after trial end", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
    });

    it("SIV-08: unauthorized distribute reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.stranger).distribute(trialId),
            "Not authorized"
        );
    });

    it("SIV-09: getParticipantCount", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(1n);
    });

    it.skip("SIV-10: reclaimUndistributed when pool unfunded after trial end", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).reclaimUndistributed(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
    });

    it("SIV-11: owner resetPaginationState", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault.connect(stack.owner).resetPaginationState(trialId, 0);
    });

    it("SIV-12: fund locked after registration begins", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .fundTrial(trialId, { value: 1n }),
            "Funding locked"
        );
    });

    it("SIV-13: claim without registration reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const enc = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            await stack.sponsorIncentiveVault.getAddress(),
            1
        );
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .claimParticipantRewards(
                    trialId,
                    1n,
                    stack.patient.address,
                    enc.handle,
                    enc.inputProof
                ),
            /Patient not registered|reverted/
        );
    });

    it("SIV-14: distributePartial requires ended trial", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).distributePartial(trialId, 0),
            /Trial not yet ended|reverted/
        );
    });

    it("SIV-15: getTotalDeposited tracks funding", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const amt = 5n * 10n ** 17n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: amt });
        expect(
            await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId)
        ).to.equal(amt);
    });

    it("SIV-16: register without pool reverts", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .registerAnonymousParticipant(trialId, nullifier),
            "No incentive pool"
        );
    });

    it("SIV-17: claimParticipantRewards happy path with v0.9 complete", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        await fundRegisterAndDistribute(stack, trialId, nullifier);
        const units = weiToCethUnits(10n ** 18n);
        await claimAndCompleteRewards(stack, trialId, nullifier, stack.patient.address, units);
    });

    it("SIV-18: claim reverts for zero destination", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await setupAcceptedApplicant(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        const enc = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            await stack.sponsorIncentiveVault.getAddress(),
            1
        );
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .claimParticipantRewards(
                    trialId,
                    nullifier,
                    ethers.ZeroAddress,
                    enc.handle,
                    enc.inputProof
                ),
            /Zero destination/
        );
    });
});
