import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    mintClearCeth,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import {
    registerPatient,
    walletApplyWithConsent,
    sponsorAcceptApplication,
    fundTrialPool,
    registerInPool,
} from "../../test-support/journey";
import {
    assertFhevmMock,
    coerceFheHandle,
    createEncryptedBool,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import {
    CHALLENGE_WINDOW_SECS,
    confirmStagedReceipt,
    tryConfirmStagedReceipt,
} from "../../test-support/claimReceipt";

describe("Unit: SponsorIncentiveVault claim + prune (P0-1)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function screeningSetup(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        await fundTrialPool(stack, trialId);
        await registerInPool(stack, trialId, nullifier);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        return { trialId, nullifier, patient, fundWei: 10n ** 18n };
    }

    it("P01-01: distribute stages only — cETH moves on confirmReceipt", async function () {
        const stack = await deployMedVaultStack();
        const { trialId } = await screeningSetup(stack);
        const cethAddr = await stack.confidentialETH.getAddress();

        const before = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        const mid = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);

        const beforeUnits =
            coerceFheHandle(before) === 0n ? 0n : await mockUserDecryptUint64(before, cethAddr, stack.patient);
        const midUnits =
            coerceFheHandle(mid) === 0n
                ? 0n
                : await mockUserDecryptUint64(mid, cethAddr, stack.patient);
        expect(midUnits - beforeUnits).to.equal(0n);

        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);
        const after = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        const afterUnits = await mockUserDecryptUint64(after, cethAddr, stack.patient);
        expect(afterUnits - midUnits).to.be.gt(0n);
        expect(await stack.sponsorIncentiveVault.confirmedPayout(trialId, stack.patient.address, 0)).to.equal(true);
    });

    it("P01-02: ineligible ciphertext cannot confirmReceipt", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await screeningSetup(stack);
        const engineAddr = await stack.eligibilityEngine.getAddress();
        const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);
        await stack.eligibilityEngine.overwriteAnonymousResultForTest(
            nullifier,
            trialId,
            falseCt.handle,
            falseCt.inputProof
        );

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        const result = await tryConfirmStagedReceipt(
            stack.sponsorIncentiveVault,
            trialId,
            0n,
            stack.patient
        );
        expect(result.ok).to.equal(false);
    });

    it("P01-03: prune frees forged slot after challenge window", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier } = await screeningSetup(stack);
        const engineAddr = await stack.eligibilityEngine.getAddress();
        const falseCt = await createEncryptedBool(engineAddr, stack.owner.address, false);
        await stack.eligibilityEngine.overwriteAnonymousResultForTest(
            nullifier,
            trialId,
            falseCt.handle,
            falseCt.inputProof
        );

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        await time.increase(CHALLENGE_WINDOW_SECS + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).pruneUnconfirmedSlots(trialId, 0);

        expect(
            await stack.sponsorIncentiveVault.isParticipantRegistered(trialId, stack.patient.address)
        ).to.equal(false);
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(0n);

        await registerInPool(stack, trialId, nullifier);
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(1n);
    });

    it("P01-04: confirmedDistributedWei tracks only delivered payouts", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, fundWei } = await screeningSetup(stack);

        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        expect(await stack.sponsorIncentiveVault.getConfirmedDistributedWei(trialId)).to.equal(0n);

        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);
        const confirmed = await stack.sponsorIncentiveVault.getConfirmedDistributedWei(trialId);
        expect(confirmed).to.be.gt(0n);
        expect(confirmed).to.be.lte(fundWei);
    });

    it("P01-05: recoverStrandedCeth sweeps vault cETH balance", async function () {
        const stack = await deployMedVaultStack();
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const cethAddr = await stack.confidentialETH.getAddress();
        const units = 1000n;
        await mintClearCeth(stack, vaultAddr, units);

        const recipient = stack.stranger.address;
        await stack.sponsorIncentiveVault.connect(stack.owner).recoverStrandedCeth(recipient);

        const recipBal = await stack.confidentialETH
            .connect(stack.stranger)
            .getBalance(recipient);
        const recipUnits = await mockUserDecryptUint64(recipBal, cethAddr, stack.stranger);
        expect(recipUnits).to.equal(units);
    });
});
