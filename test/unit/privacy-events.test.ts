import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { grantConsentLegacy } from "../../test-support/consent";
import { expectRevert } from "../../test-support/assertions";
import { Identity } from "@semaphore-protocol/identity";
import { registerPatientOnRegistry } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { registerPatient, walletApplyWithConsent } from "../../test-support/journey";
import { parseClaimInitiatedLog } from "../../test-support/vaultEvents";
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
        const MockAave = await ethers.getContractFactory("MockAave");
        const mockAave = await MockAave.deploy();
        await mockAave.waitForDeployment();
        const mockCode = await ethers.provider.getCode(await mockAave.getAddress());
        await ethers.provider.send("hardhat_setCode", [WETH_GATEWAY_SEPOLIA, mockCode]);
        await ethers.provider.send("hardhat_setCode", [AWETH_SEPOLIA, mockCode]);
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

        const { confirmStagedReceipt } = await import("../../test-support/claimReceipt");
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, stack.patient);

        const { patientConfidentialBalanceUnits } = await import("../../test-support/journey");
        const units = await patientConfidentialBalanceUnits(stack, stack.patient.address);
        expect(units).to.be.gt(0n);
        const { claimParticipantRewardsTx } = await import("../../test-support/withdraw");
        const tx = await claimParticipantRewardsTx(
            stack.confidentialETH,
            stack.sponsorIncentiveVault,
            stack.patient,
            trialId,
            nullifier,
            stack.patient.address,
            units
        );
        const rc = await tx.wait();
        const ev = parseClaimInitiatedLog(rc);
        expect(ev).to.not.equal(undefined);
        expect(ev!.args.trialId).to.equal(trialId);
        expect(ev!.args.permitHolder).to.properAddress;
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

    it("SUF-06: withdraw/stake request events expose transferableHandle (not sufficientHandle)", async function () {
        const cEth = await ethers.getContractFactory("ConfidentialETH7984");
        const cEthIface = cEth.interface;
        const withdrawEv = cEthIface.getEvent("WithdrawRequested");
        expect(withdrawEv?.inputs.some((i) => i.name === "transferableHandle")).to.equal(true);
        expect(withdrawEv?.inputs.some((i) => i.name === "sufficientHandle")).to.equal(false);
        expect(cEthIface.getEvent("WithdrawAmountRevealed")).to.equal(null);

        const staking = await ethers.getContractFactory("StakingManager");
        const stakingIface = staking.interface;
        for (const name of ["ConfidentialStakeRequested", "PrivateUnstakeRequested", "PublicUnstakeRequested"]) {
            const ev = stakingIface.getEvent(name);
            expect(ev?.inputs.some((i) => i.name === "transferableHandle")).to.equal(true);
            expect(ev?.inputs.some((i) => i.name === "sufficientHandle")).to.equal(false);
        }
    });

    it("ACL-05: revokeAllConsent increments epoch; getActiveConsent is encrypted-false", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);

        await stack.consentManager.connect(stack.patient).revokeAllConsent();
        expect(
            await stack.consentManager.connect(stack.patient).getPatientConsentEpoch(stack.patient.address)
        ).to.equal(1n);

        await expectRevert(
            stack.consentManager
                .connect(stack.patient)
                .getEncryptedConsent(stack.patient.address, trialId),
            "Consent revoked or superseded"
        );

        const { coerceFheHandle } = await import("../../test-support/fhe");
        const active = await stack.consentManager
            .connect(stack.patient)
            .getActiveConsent(stack.patient.address, trialId);
        expect(coerceFheHandle(active)).to.be.gt(0n);
    });
});
