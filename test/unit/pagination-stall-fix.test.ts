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

describe("Unit: pagination stall fix (MED-2 / Plan P3)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function registerThreeParticipants(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        trialId: bigint
    ) {
        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            const patient = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
            const staged = await stageSemaphoreApply(stack, trialId, patient, signer);
            await finalizeSemaphoreApply(stack, staged, patient, signer);
            await sponsorAcceptApplication(stack, trialId, staged.nullifier);
            await registerInPool(stack, trialId, staged.nullifier, signer);
        }
        return signers;
    }

    it("P3-01: one reverting participant does not stall paginated batch or performUpkeep", async function () {
        const stack = await deployMedVaultStack({ vaultHarness: true });
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);

        const signers = await registerThreeParticipants(stack, trialId);
        const failingParticipant = signers[1].address;

        await stack.sponsorIncentiveVault.setTestHelpersEnabled(true);
        await stack.sponsorIncentiveVault.setForceCreditRevertForParticipant(failingParticipant, true);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(0n);

        await expect(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributePartialPaginated(trialId, 0, 0, 3)
        )
            .to.emit(stack.sponsorIncentiveVault, "ParticipantCreditFailed")
            .withArgs(trialId, 0n, failingParticipant, (reason: string) => reason.length > 0);

        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(3n);

        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.patient.address, 0)
        ).to.equal(true);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, failingParticipant, 0)
        ).to.equal(false);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.sponsor2.address, 0)
        ).to.equal(true);
    });

    it("P3-02: performUpkeep completes screening when one participant credit reverts", async function () {
        const stack = await deployMedVaultStack({ vaultHarness: true });
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);

        const signers = await registerThreeParticipants(stack, trialId);
        await stack.sponsorIncentiveVault.setTestHelpersEnabled(true);
        await stack.sponsorIncentiveVault.setForceCreditRevertForParticipant(signers[0].address, true);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
        await expect(stack.medVaultAutomation.connect(stack.owner).performUpkeep(data))
            .to.emit(stack.sponsorIncentiveVault, "ParticipantCreditFailed")
            .withArgs(trialId, 0n, signers[0].address, (reason: string) => reason.length > 0);

        expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, signers[1].address, 0)
        ).to.equal(true);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, signers[2].address, 0)
        ).to.equal(true);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, signers[0].address, 0)
        ).to.equal(false);
    });
});
