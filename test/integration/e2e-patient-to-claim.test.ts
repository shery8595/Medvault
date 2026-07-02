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
import { grantConsentLegacy } from "../../test-support/consent";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import {
    freshTrialWithPatient,
    walletApplyWithConsent,
    sponsorAcceptApplication,
    fundRegisterAndDistribute,
    claimAndCompleteRewards,
    registerPatient,
    stageSemaphoreApply,
} from "../../test-support/journey";
import { ethers } from "hardhat";

describe("Integration: E2E patient journey", function () {
    it("E2E-01: register apply accept fund register distribute", async function () {
        const stack = await deployMedVaultStack();
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
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.isParticipantRegistered(trialId, stack.patient.address)).to.equal(
            true
        );
    });

    it("E2E-02: register without accept cannot join pool", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const nullifier = staged.nullifier;
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .registerAnonymousParticipant(trialId, nullifier),
            /App not accepted|must be accepted|No permit holder|AppNotAccepted/
        );
    });

    it("E2E-03: fund before accept still blocks wrong status", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 17n });
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .registerAnonymousParticipant(trialId, 123n),
            "No permit holder"
        );
    });

    it("E2E-04: distribute without participants reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 17n });
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId),
            "No participants"
        );
    });

    it("E2E-05: consent revoked still allows apply but gated consent false", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const nullifier = staged.nullifier;
        const status = await stack.eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId);
        expect(status).to.equal(0n);
    });

    it("E2E-06: sponsor reject blocks pool registration", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient, stack.patient, false);
        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 3);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.patient)
                .registerAnonymousParticipant(trialId, nullifier),
            /App not accepted|must be accepted|AppNotAccepted/
        );
    });

    it("E2E-07: trial active after registration", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.active).to.equal(true);
    });

    it("E2E-08: patient count on registry after register", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.medVaultRegistry.getPatientCount()).to.equal(1n);
    });

    it("E2E-09: wallet path through claim and completeWithdrawTo", async function () {
        const { stack, patient, trialId } = await freshTrialWithPatient();
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        const fundWei = 10n ** 18n;
        await fundRegisterAndDistribute(stack, trialId, nullifier, fundWei);
        const destination = stack.patient.address;
        const before = await ethers.provider.getBalance(destination);
        const { gasCost } = await claimAndCompleteRewards(
            stack,
            trialId,
            nullifier,
            destination,
            fundWei / 1_000_000_000_000n
        );
        const after = await ethers.provider.getBalance(destination);
        expect(after - before + gasCost).to.equal(fundWei);
    });
});
