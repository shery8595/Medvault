import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { registerPatient, walletApplyWithConsent } from "../../test-support/journey";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { mockUserDecryptUint64 } from "../../test-support/fhe";
import { confirmStagedReceipt } from "../../test-support/claimReceipt";

describe("Unit: Zero-revelation screening rewards", function () {
    it("ZR-01: eligible participant receives confidential screening reward", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);

        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });
        await stack.sponsorIncentiveVault.connect(stack.patient).registerAnonymousParticipant(trialId, nullifier);

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);

        const balHandle = await stack.confidentialETH.confidentialBalanceOf(stack.patient.address);
        const units = await mockUserDecryptUint64(
            balHandle,
            await stack.confidentialETH.getAddress(),
            stack.patient.address
        );
        expect(units).to.be.gt(0n);
    });

    it("ZR-02: makeEncryptedPoolSizePublic does not touch patient handles", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault.connect(stack.sponsor).makeEncryptedPoolSizePublic(trialId);
        const pool = await stack.sponsorIncentiveVault.getEncryptedPoolSize(trialId);
        expect(pool).to.not.equal(ethers.ZeroHash);
    });
});
