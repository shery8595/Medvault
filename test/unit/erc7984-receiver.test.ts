import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import type { Contract } from "ethers";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { authorizeCethContract } from "../../test-support/timelock";
import { coerceFheHandle, createEncryptedUint64, mockUserDecryptUint64 } from "../../test-support/fhe";
import { confidentialStakeAndComplete } from "../../test-support/staking";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";

function encodeTrialFundingData(trialId: bigint, milestoneIndex = 0n): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [trialId, milestoneIndex]
    );
}

async function confidentialTransferAndCall(
    cETH: Contract,
    signer: { address: string },
    to: string,
    units: bigint | number,
    data: string
) {
    const cethAddr = await cETH.getAddress();
    const encrypted = await createEncryptedUint64(cethAddr, signer.address, units);
    return cETH
        .connect(signer)
        ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
            to,
            encrypted.handle,
            encrypted.inputProof,
            data
        );
}

describe("Unit: ERC-7984 IERC7984Receiver (Plan 02)", function () {
    async function deployStakingStack() {
        const stack = await deployMedVaultStack();
        const MockAave = await ethers.getContractFactory("MockAave");
        const mockAave = await MockAave.deploy();
        await mockAave.waitForDeployment();
        const mockCode = await ethers.provider.getCode(await mockAave.getAddress());
        const WETH_GATEWAY = "0x20040a64612555042335926d72B4E5F667a67fA1";
        const AWETH = "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";
        await ethers.provider.send("hardhat_setCode", [WETH_GATEWAY, mockCode]);
        await ethers.provider.send("hardhat_setCode", [AWETH, mockCode]);
        const StakingManager = await ethers.getContractFactory("StakingManager");
        const stakingManager = await StakingManager.deploy(
            await stack.confidentialETH.getAddress(),
            "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
            WETH_GATEWAY,
            AWETH
        );
        await stakingManager.waitForDeployment();
        await authorizeCethContract(
            stack.confidentialETH,
            stack.owner,
            await stakingManager.getAddress(),
            true
        );
        return { ...stack, stakingManager };
    }

    it("RCV-01: confidential funding disabled — callback reverts ConfidentialFundingDisabled", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const units = 5n;

        expect(await stack.sponsorIncentiveVault.confidentialFundingEnabled()).to.equal(false);
        expect(await stack.sponsorIncentiveVault.confidentialFundingAccountingReady()).to.equal(false);
        const depositedBefore = await stack.sponsorIncentiveVault.getTotalDeposited(trialId);
        expect(depositedBefore).to.equal(0n);

        await stack.confidentialETH.connect(stack.sponsor).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        const data = encodeTrialFundingData(trialId);

        await expectRevert(
            confidentialTransferAndCall(
                stack.confidentialETH,
                stack.sponsor,
                vaultAddr,
                units,
                data
            ),
            "ConfidentialFundingDisabled"
        );

        expect(await stack.sponsorIncentiveVault.getTotalDeposited(trialId)).to.equal(depositedBefore);
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(false);
    });

    it("RCV-02: non-sponsor confidential fund attempt reverts ConfidentialFundingDisabled", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const units = 3n;

        await stack.confidentialETH.connect(stack.stranger).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        const depositedBefore = await stack.sponsorIncentiveVault.getTotalDeposited(trialId);
        const data = encodeTrialFundingData(trialId);

        await expectRevert(
            confidentialTransferAndCall(
                stack.confidentialETH,
                stack.stranger,
                vaultAddr,
                units,
                data
            ),
            "ConfidentialFundingDisabled"
        );

        expect(await stack.sponsorIncentiveVault.getTotalDeposited(trialId)).to.equal(depositedBefore);
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(false);
    });

    it("RCV-03: atomic confidential stake via confidentialTransferAndCall", async function () {
        const { stakingManager, confidentialETH, patient } = await deployStakingStack();
        const stakingAddr = await stakingManager.getAddress();
        const units = 4n;

        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        await confidentialTransferAndCall(confidentialETH, patient, stakingAddr, units, "0x");

        const staked = await stakingManager.connect(patient).getEncryptedTotalStaked(patient.address);
        expect(coerceFheHandle(staked)).to.be.gt(0n);
        const mgrSigner = await impersonateAccount(stakingAddr);
        const mgrBal = await confidentialETH.connect(mgrSigner).getBalance(stakingAddr);
        expect(coerceFheHandle(mgrBal)).to.be.gt(0n);
    });

    it("RCV-04: failed stake callback refunds sender (pending unstake blocks)", async function () {
        const { stakingManager, confidentialETH, patient } = await deployStakingStack();
        const stakingAddr = await stakingManager.getAddress();
        const units = 2n;

        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * units * 2n });
        await confidentialStakeAndComplete(
            stakingManager,
            confidentialETH,
            patient,
            patient.address,
            units
        );
        const encUnstake = await createEncryptedUint64(stakingAddr, patient.address, units);
        await stakingManager
            .connect(patient)
            .requestPrivateUnstake(encUnstake.handle, encUnstake.inputProof);

        const cethAddr = await confidentialETH.getAddress();
        const balHandleBefore = await confidentialETH.connect(patient).getBalance(patient.address);
        const balBefore = await mockUserDecryptUint64(balHandleBefore, cethAddr, patient.address);
        await expectRevert(
            confidentialTransferAndCall(confidentialETH, patient, stakingAddr, units, "0x"),
            "Balance locked"
        );
        const balHandleAfter = await confidentialETH.connect(patient).getBalance(patient.address);
        const balAfter = await mockUserDecryptUint64(balHandleAfter, cethAddr, patient.address);
        expect(balAfter).to.equal(balBefore);
    });

    it("RCV-05: KMS two-phase stake still uses transferEncrypted", async function () {
        const { stakingManager, confidentialETH, patient } = await deployStakingStack();
        const units = 2n;
        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * units * 2n });
        await confidentialStakeAndComplete(
            stakingManager,
            confidentialETH,
            patient,
            patient.address,
            units
        );
        const staked = await stakingManager.connect(patient).getEncryptedTotalStaked(patient.address);
        expect(coerceFheHandle(staked)).to.be.gt(0n);
    });

    it("RCV-06: vault funding callback reverts while confidential path disabled", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const units = 1n;

        await stack.confidentialETH.connect(stack.sponsor).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        await expectRevert(
            confidentialTransferAndCall(
                stack.confidentialETH,
                stack.sponsor,
                vaultAddr,
                units,
                encodeTrialFundingData(trialId)
            ),
            "ConfidentialFundingDisabled"
        );
        expect(hre.fhevm.isMock).to.equal(true);
    });
});
