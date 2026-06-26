import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { grantConsentLegacy } from "../../test-support/consent";
import { expectRevert } from "../../test-support/assertions";
import { Identity } from "@semaphore-protocol/identity";
import { registerPatientOnRegistry } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { registerPatient, walletApplyWithConsent } from "../../test-support/journey";
import { AAVE_POOL_SEPOLIA, AWETH_SEPOLIA, WETH_GATEWAY_SEPOLIA } from "../../test-support/constants";

describe("Unit: privacy-safe events", function () {
    it("PRIV-01: ConfidentialETH Deposit event omits amount fields", async function () {
        const stack = await deployMedVaultStack();
        const cEth = stack.confidentialETH;
        const tx = await stack.confidentialETH.connect(stack.patient).deposit({
            value: ethers.parseUnits("0.000001", "ether"),
        });
        const rc = await tx.wait();
        const deposit = rc?.logs
            .map((l) => {
                try {
                    return cEth.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "Deposit");
        expect(deposit).to.not.equal(undefined);
        expect(deposit!.args.length).to.equal(1);
    });

    it("PRIV-02: StakingManager Staked event omits amount", async function () {
        const stack = await deployMedVaultStack();
        const StakingManager = await ethers.getContractFactory("StakingManager");
        const staking = await StakingManager.deploy(
            await stack.confidentialETH.getAddress(),
            AAVE_POOL_SEPOLIA,
            WETH_GATEWAY_SEPOLIA,
            AWETH_SEPOLIA
        );
        await staking.waitForDeployment();
        const tx = await staking.connect(stack.patient).stake({ value: 10n ** 9n });
        const rc = await tx.wait();
        const staked = rc?.logs
            .map((l) => {
                try {
                    return staking.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "Staked");
        expect(staked?.args.length).to.equal(1);
    });

    it("PRIV-03: getTotalDeposited is sponsor-only", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.patient).getTotalDeposited(trialId),
            /Not authorized/
        );
        expect(
            await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId)
        ).to.equal(10n ** 18n);
    });

    it("PRIV-04: ClaimInitiated omits destination and nullifier", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2);
        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrial(trialId, { value: 10n ** 18n });
        await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .registerAnonymousParticipant(trialId, nullifier);

        const { time } = await import("@nomicfoundation/hardhat-network-helpers");
        const { DEFAULT_TRIAL_PARAMS } = await import("../../test-support/constants");
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        const units = 1;
        const { createEncryptedClaimUnits } = await import("../../test-support/withdraw");
        const encrypted = await createEncryptedClaimUnits(
            await stack.confidentialETH.getAddress(),
            await stack.sponsorIncentiveVault.getAddress(),
            units
        );
        const tx = await stack.sponsorIncentiveVault
            .connect(stack.patient)
            .claimParticipantRewards(
                trialId,
                nullifier,
                stack.patient.address,
                encrypted.handle,
                encrypted.inputProof
            );
        const rc = await tx.wait();
        const ev = rc?.logs
            .map((l) => {
                try {
                    return stack.sponsorIncentiveVault.interface.parseLog(l);
                } catch {
                    return null;
                }
            })
            .find((p) => p?.name === "ClaimInitiated");
        expect(ev?.args.trialId).to.equal(trialId);
        expect(ev?.args.permitHolder).to.properAddress;
        expect(ev?.args.sufficientHandle).to.be.a("string");
        expect(ev?.args.destination).to.equal(undefined);
        expect(ev?.args.nullifier).to.equal(undefined);
    });

    it("PRIV-05: hasConsentRecord rejects third-party reads", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);
        await expectRevert(
            stack.consentManager.connect(stack.stranger).hasConsentRecord(stack.patient.address, trialId),
            /Not authorized/
        );
    });
});
