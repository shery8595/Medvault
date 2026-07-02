import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    buildMockSemaphoreProof,
    deriveNullifier,
} from "../../test-support/semaphore";
import {
    defaultApplyDeadline,
    signAnonymousApplyPermit,
    stageAnonymousApply,
} from "../../test-support/anonymousApply";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";
import { authorizeCethContract } from "../../test-support/timelock";

describe("Security regression", function () {
    it("SEC-C2: front-run stage with attacker permit signature reverts", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const proof = buildMockSemaphoreProof(
            trialId,
            nullifier,
            id.commitment,
            stack.patient.address
        );
        const registryAddress = await stack.medVaultRegistry.getAddress();
        const deadline = await defaultApplyDeadline();
        const attackerSig = await signAnonymousApplyPermit(stack.stranger, registryAddress, {
            trialId,
            commitment: id.commitment,
            nullifier,
            permitRecipient: stack.stranger.address,
            deadline,
        });
        await expectRevert(
            stack.medVaultRegistry
                .connect(stack.stranger)
                .stageAnonymousApply(
                    trialId,
                    proof,
                    id.commitment,
                    stack.stranger.address,
                    deadline,
                    attackerSig
                ),
            /Commitment\/signal mismatch|Invalid permit recipient signature/
        );
        await stageAnonymousApply(
            stack.medVaultRegistry,
            stack.patient,
            trialId,
            id,
            stack.patient.address
        );
    });

    it("SEC-C1: balance lock blocks concurrent withdraw during confidential stake", async function () {
        const stack = await deployMedVaultStack();
        const MockAave = await ethers.getContractFactory("MockAave");
        const mockAave = await MockAave.deploy();
        await mockAave.waitForDeployment();
        const WETH_GATEWAY = ethers.getAddress("0x397ff45b0dbe027ead4a30fe8dca7d9ef3c0a1d0");
        const AWETH = ethers.getAddress("0x5e8c8a7243651f7ec38c39beaa9b60fb4a04cf8b");
        const AAVE_POOL = ethers.getAddress("0x6ae43d3271ff6888e7fc43fd7321a503ff738951");
        await ethers.provider.send("hardhat_setCode", [
            WETH_GATEWAY,
            await ethers.provider.getCode(await mockAave.getAddress()),
        ]);
        await ethers.provider.send("hardhat_setCode", [
            AWETH,
            await ethers.provider.getCode(await mockAave.getAddress()),
        ]);
        const StakingManager = await ethers.getContractFactory("StakingManager");
        const stakingManager = await StakingManager.deploy(
            await stack.confidentialETH.getAddress(),
            AAVE_POOL,
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

        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const { createEncryptedUint64 } = await import("../../test-support/fhe");
        const { time } = await import("@nomicfoundation/hardhat-network-helpers");
        const stakingAddr = await stakingManager.getAddress();
        const until = BigInt((await time.latest()) + 86400);
        await stack.confidentialETH.connect(stack.patient).setOperator(stakingAddr, until);
        const enc = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            stakingAddr,
            1
        );
        await stakingManager.connect(stack.patient).stakeAndLock(enc.handle, enc.inputProof);
        expect(await stack.confidentialETH.isBalanceLocked(stack.patient.address)).to.equal(true);
        await expectRevert(
            stack.confidentialETH
                .connect(stack.patient)
                .requestWithdraw(enc.handle, enc.inputProof),
            /Balance locked/
        );
    });

    it("SEC-H1: depositFor credits reverting recipient without external ETH push", async function () {
        const stack = await deployMedVaultStack();
        const Reverter = await ethers.getContractFactory("RewardReverter");
        const reverter = await Reverter.deploy();
        await reverter.waitForDeployment();
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        await stack.confidentialETH
            .connect(vaultSigner)
            .depositFor(await reverter.getAddress(), { value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH
            .connect(vaultSigner)
            .getBalance(await reverter.getAddress());
        expect(bal).to.not.equal(0n);
    });
});
