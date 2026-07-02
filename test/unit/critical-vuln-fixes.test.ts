import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { registerPatient, walletApplyWithConsent, stageSemaphoreApply } from "../../test-support/journey";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";
import { confirmStagedReceipt } from "../../test-support/claimReceipt";
import { assertFhevmMock } from "../../test-support/fhe";

describe("Unit: Critical vulnerability fixes", function () {
    before(function () {
        assertFhevmMock();
    });
    it("CRIT-1: confidentialFundingEnabled is false", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.sponsorIncentiveVault.confidentialFundingEnabled()).to.equal(false);
        expect(await stack.sponsorIncentiveVault.confidentialFundingAccountingReady()).to.equal(false);
    });

    it("CRIT-2: screening distribution preserves vault accounting invariant", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);
        expect(await stack.eligibilityEngine.getAnonymousApplicationStatus(nullifier, trialId)).to.equal(2);

        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);

        const deposited = await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId);
        const milestoneDist = await stack.sponsorIncentiveVault.milestoneDistributedWei(trialId, 0);
        expect(milestoneDist).to.be.lte(deposited);
        expect(
            await stack.sponsorIncentiveVault.participantMilestonePaid(trialId, stack.patient.address, 0)
        ).to.equal(true);
    });

    it("CRIT-2: vault screening gate false before finalize", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        expect(
            await stack.eligibilityEngine.isAnonymousApplicationAccepted(staged.nullifier, trialId)
        ).to.equal(false);
    });

    it("CRIT-3: updateDocumentKey reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.patientDocumentStore
                .connect(stack.patient)
                .updateDocumentKey(1n, 1n, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, ethers.ZeroHash, "0x"),
            /Use revokeAccess/
        );
    });

    it("CRIT-4: only EligibilityEngine may addApplicant / addToAggregate", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const nullifier = 77n;

        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(stack.owner).addApplicant(trialId, nullifier),
            /Only eligibility engine/
        );

        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(stack.owner).addToAggregate(trialId, nullifier),
            /Only eligibility engine/
        );

        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, nullifier),
            /revert/
        );
    });

    it("CRIT-4: aggregate updated after eligible finalize", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        expect(await stack.encryptedScoreLeaderboard.hasBeenAggregated(trialId, nullifier)).to.equal(true);
    });
});
