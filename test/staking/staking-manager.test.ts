import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI, AWETH_SEPOLIA, WETH_GATEWAY_SEPOLIA, AAVE_POOL_SEPOLIA } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";
import { coerceFheHandle } from "../../test-support/fhe";

describe("Staking: StakingManager", function () {
    async function deployStakingStack() {
        const stack = await deployMedVaultStack();
        const MockAave = await ethers.getContractFactory("MockAave");
        const mockAave = await MockAave.deploy();
        await mockAave.waitForDeployment();
        const mockCode = await ethers.provider.getCode(await mockAave.getAddress());
        await ethers.provider.send("hardhat_setCode", [WETH_GATEWAY_SEPOLIA, mockCode]);
        await ethers.provider.send("hardhat_setCode", [AWETH_SEPOLIA, mockCode]);
        const StakingManager = await ethers.getContractFactory("StakingManager");
        const stakingManager = await StakingManager.deploy(
            await stack.confidentialETH.getAddress(),
            AAVE_POOL_SEPOLIA,
            WETH_GATEWAY_SEPOLIA,
            AWETH_SEPOLIA
        );
        await stakingManager.waitForDeployment();
        await stack.confidentialETH.authorizeContract(await stakingManager.getAddress());
        return { ...stack, stakingManager, mockAave };
    }

    it("STK-01: stake increases encrypted total", async function () {
        const { stakingManager, patient, confidentialETH } = await deployStakingStack();
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 2n });
        const total = await stakingManager.getEncryptedTotalStaked(patient.address);
        expect(coerceFheHandle(total)).to.be.gt(0n);
    });

    it("STK-02: requestUnstake without complete leaves pending", async function () {
        const { stakingManager, patient } = await deployStakingStack();
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await stakingManager.connect(patient).requestUnstake(CET_MIN_DEPOSIT_WEI * 2n);
        await expectRevert(
            stakingManager.connect(patient).requestUnstake(CET_MIN_DEPOSIT_WEI * 2n),
            /Unstake already pending/
        );
    });

    it("STK-03: stake below minimum reverts", async function () {
        const { stakingManager, patient } = await deployStakingStack();
        await expectRevert(
            stakingManager.connect(patient).stake({ value: 1n }),
            "revert"
        );
    });

    it("STK-04: CANCEL_TIMEOUT_FUNDS is one hour", async function () {
        const { stakingManager } = await deployStakingStack();
        expect(await stakingManager.CANCEL_TIMEOUT_FUNDS()).to.equal(3600n);
    });

    it("STK-05: double stake accumulates", async function () {
        const { stakingManager, patient } = await deployStakingStack();
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 3n });
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 3n });
        const total = await stakingManager.getEncryptedTotalStaked(patient.address);
        expect(total).to.not.equal(0n);
    });

    it("STK-06: stake zero value reverts", async function () {
        const { stakingManager, patient } = await deployStakingStack();
        await expectRevert(stakingManager.connect(patient).stake({ value: 0 }), "revert");
    });

    it("STK-07: getEncryptedTotalStaked readable", async function () {
        const { stakingManager, patient } = await deployStakingStack();
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 2n });
        const total = await stakingManager.getEncryptedTotalStaked(patient.address);
        expect(total).to.not.equal(undefined);
    });

    it("STK-08: authorized cETH for staking manager", async function () {
        const { stakingManager, confidentialETH } = await deployStakingStack();
        expect(
            await confidentialETH.authorizedContracts(await stakingManager.getAddress())
        ).to.equal(true);
    });
});
