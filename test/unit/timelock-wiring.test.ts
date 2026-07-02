import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { deployMedVaultStack, registerPatientOnRegistry } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";
import { advanceTimelock, scheduleAndApply } from "../../test-support/timelock";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { buildWithdrawToAuthorization } from "../../test-support/withdraw";
import { createEncryptedUint64 } from "../../test-support/fhe";
import { impersonateAccount } from "../../test-support/signers";
import { deployAnonymousPatientRegistry } from "../../scripts/lib/deployAnonymousPatientRegistry";

describe("Unit: timelock wiring and withdraw-to auth", function () {
    it("TL-01: instant TrialManager.setAutomationContract reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.trialManager.connect(stack.owner).setAutomationContract(stack.stranger.address),
            /Use scheduleAutomationContract/
        );
    });

    it("TL-02: scheduleAutomationContract requires timelock before apply", async function () {
        const stack = await deployMedVaultStack();
        const newAutomation = stack.stranger.address;
        await stack.trialManager.connect(stack.owner).scheduleAutomationContract(newAutomation);
        await expectRevert(
            stack.trialManager.connect(stack.owner).applyAutomationContract(),
            /Timelock active/
        );
        await advanceTimelock();
        await stack.trialManager.connect(stack.owner).applyAutomationContract();
        expect(await stack.trialManager.automationContract()).to.equal(newAutomation);
    });

    it("TL-02b: apply not executable at delay-1s, executable at delay", async function () {
        const stack = await deployMedVaultStack();
        const newAutomation = stack.stranger.address;
        const delay = Number(await stack.trialManager.READER_CHANGE_DELAY());
        expect(delay).to.equal(6 * 3600);
        await stack.trialManager.connect(stack.owner).scheduleAutomationContract(newAutomation);
        const eta = Number(await stack.trialManager.automationContractChangeEta());
        await expectRevert(
            stack.trialManager.connect(stack.owner).applyAutomationContract(),
            /Timelock active/
        );
        await time.increaseTo(eta - 1);
        await expect(
            stack.trialManager.connect(stack.owner).applyAutomationContract.staticCall()
        ).to.be.revertedWith("Timelock active");
        await time.increaseTo(eta);
        await stack.trialManager.connect(stack.owner).applyAutomationContract();
        expect(await stack.trialManager.automationContract()).to.equal(newAutomation);
    });

    it("TL-03: EligibilityEngine reader changes use scheduleAuthorizedReader", async function () {
        const stack = await deployMedVaultStack();
        const role = ethers.id("scoreLeaderboard");
        const newBoard = stack.stranger.address;
        await expectRevert(
            stack.eligibilityEngine.connect(stack.owner).setScoreLeaderboard(newBoard),
            /Use scheduleAuthorizedReader/
        );
        await scheduleAndApply(
            () => stack.eligibilityEngine.connect(stack.owner).scheduleAuthorizedReader(role, newBoard),
            () => stack.eligibilityEngine.connect(stack.owner).applyAuthorizedReader(role)
        );
        expect(await stack.eligibilityEngine.scoreLeaderboard()).to.equal(newBoard);
    });

    it("TL-04: MH-1 requires engine before registration (fresh registry)", async function () {
        const registry = await deployAnonymousPatientRegistry();
        expect(await registry.authorizedEngine()).to.equal(ethers.ZeroAddress);
        await expectRevert(registry.setAuthorizedEngine(ethers.ZeroAddress), /Zero address/);

        const stack = await deployMedVaultStack();
        expect(await stack.anonymousPatientRegistry.authorizedEngine()).to.not.equal(
            ethers.ZeroAddress
        );
    });

    it("TL-05: requestWithdrawTo requires valid user EIP-712 signature", async function () {
        const stack = await deployMedVaultStack();
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        await stack.confidentialETH
            .connect(vaultSigner)
            .depositFor(stack.patient.address, { value: CET_MIN_DEPOSIT_WEI });
        const enc = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            await stack.sponsorIncentiveVault.getAddress(),
            1
        );
        await expectRevert(
            stack.confidentialETH
                .connect(vaultSigner)
                .requestWithdrawTo(
                    stack.patient.address,
                    stack.sponsor.address,
                    enc.handle,
                    enc.inputProof,
                    0n,
                    BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600),
                    "0x" + "00".repeat(130)
                ),
            /Invalid withdraw-to signature|ECDSA/
        );

        const withdrawTo = await buildWithdrawToAuthorization(
            stack.confidentialETH,
            stack.patient,
            stack.sponsor.address,
            enc
        );
        await stack.confidentialETH
            .connect(vaultSigner)
            .requestWithdrawTo(
                stack.patient.address,
                stack.sponsor.address,
                enc.handle,
                enc.inputProof,
                withdrawTo.nonce,
                withdrawTo.deadline,
                withdrawTo.signature
            );
        expect(await stack.confidentialETH.pendingWithdrawToHandle(stack.patient.address)).to.not.equal(
            ethers.ZeroHash
        );
    });

    it("TL-06: deployMedVaultStack wires timelocked contracts end-to-end", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.anonymousPatientRegistry.checkRegistration(id.commitment)).to.equal(true);
        expect(await stack.trialManager.eligibilityEngine()).to.equal(
            await stack.eligibilityEngine.getAddress()
        );
        expect(
            await stack.confidentialETH.authorizedContracts(await stack.sponsorIncentiveVault.getAddress())
        ).to.equal(true);
    });
});
