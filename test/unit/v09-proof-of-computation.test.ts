import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import { deployMedVaultStack, createTrialForSponsor, registerPatientOnRegistry } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI, AWETH_SEPOLIA, WETH_GATEWAY_SEPOLIA, AAVE_POOL_SEPOLIA } from "../../test-support/constants";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { expectRevert } from "../../test-support/assertions";
import {
    assertFhevmMock,
    mockPublicDecryptProof,
    mockDecryptBool,
    parseEventArg,
    coerceFheHandle,
    createEncryptedUint64,
} from "../../test-support/fhe";
import {
    requestEncryptedWithdraw,
    completeEncryptedWithdraw,
    requestEncryptedWithdrawTo,
    completeEncryptedWithdrawTo,
} from "../../test-support/withdraw";
import { confidentialStakeAndComplete, completePrivateUnstakeFromReceipt } from "../../test-support/staking";
import { generateTestEligibilityProof } from "../../test-support/noirProof";

describe("Unit: v0.9 proof-of-computation flows", function () {
    before(function () {
        assertFhevmMock();
    });

    describe("ConfidentialETH.requestWithdraw → completeWithdraw", function () {
        it("V09-01: sufficient proof completes withdraw and transfers ETH", async function () {
            const stack = await deployMedVaultStack();
            const { patient, confidentialETH } = stack;

            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
            const reqTx = await requestEncryptedWithdraw(confidentialETH, patient, 1);
            const reqRc = await reqTx.wait();

            const completeTx = await completeEncryptedWithdraw(confidentialETH, patient, reqRc!);
            const completeRc = await completeTx.wait();
            const withdrawnUser = parseEventArg(
                completeRc!,
                confidentialETH.interface,
                "Withdrawal",
                "user"
            );
            expect(withdrawnUser.toLowerCase()).to.equal(patient.address.toLowerCase());
        });

        it("V09-02: blocks concurrent requestWithdraw while pending", async function () {
            const stack = await deployMedVaultStack();
            const { patient, confidentialETH } = stack;
            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
            await requestEncryptedWithdraw(confidentialETH, patient, 1);
            await expectRevert(
                requestEncryptedWithdraw(confidentialETH, patient, 1),
                /Withdrawal already pending/
            );
        });

        it("V09-03: cancelPendingWithdraw after timeout", async function () {
            const stack = await deployMedVaultStack();
            const { patient, confidentialETH } = stack;
            const timeout = await confidentialETH.CANCEL_TIMEOUT_FUNDS();

            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
            await requestEncryptedWithdraw(confidentialETH, patient, 1);

            await expectRevert(
                confidentialETH.connect(patient).cancelPendingWithdraw(),
                /Timeout not elapsed/
            );

            await time.increase(timeout + 1n);
            await confidentialETH.connect(patient).cancelPendingWithdraw();
        });

        it("V09-04: forged proof reverts with KMSInvalidSigner", async function () {
            const stack = await deployMedVaultStack();
            const { patient, confidentialETH } = stack;

            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
            const reqTx = await requestEncryptedWithdraw(confidentialETH, patient, 1);
            const reqRc = await reqTx.wait();
            const sufficientHandle = parseEventArg(
                reqRc!,
                confidentialETH.interface,
                "WithdrawRequested",
                "sufficientHandle"
            );

            const { cleartexts, proof } = await mockPublicDecryptProof(sufficientHandle);
            const forgedCleartexts = ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [false]);

            const revealTx = await confidentialETH
                .connect(patient)
                .revealWithdrawAmount(cleartexts, proof);
            const revealRc = await revealTx.wait();
            const amountHandle = parseEventArg(
                revealRc!,
                confidentialETH.interface,
                "WithdrawAmountRevealed",
                "amountHandle"
            );
            const amount = await mockPublicDecryptProof(amountHandle);

            await expectRevert(
                confidentialETH.connect(patient).completeWithdraw(forgedCleartexts, amount.proof),
                /KMSInvalidSigner|InvalidKMSSignatures/
            );
            await expectRevert(
                confidentialETH.connect(patient).completeWithdraw(amount.cleartexts, amount.proof + "00"),
                /KMSInvalidSigner|InvalidKMSSignatures/
            );
        });
    });

    describe("ConfidentialETH.requestWithdrawTo (authorized)", function () {
        it("V09-05: ETH lands at stored destination", async function () {
            const stack = await deployMedVaultStack();
            const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
            const destination = stack.sponsor.address;

            await stack.confidentialETH
                .connect(vaultSigner)
                .depositFor(stack.patient.address, { value: CET_MIN_DEPOSIT_WEI });

            const reqTx = await requestEncryptedWithdrawTo(
                stack.confidentialETH,
                vaultSigner,
                stack.patient.address,
                destination,
                1
            );
            const reqRc = await reqTx.wait();
            const destBefore = await ethers.provider.getBalance(destination);

            await completeEncryptedWithdrawTo(
                stack.confidentialETH,
                stack.owner,
                stack.patient.address,
                reqRc!
            );

            const destAfter = await ethers.provider.getBalance(destination);
            expect(destAfter - destBefore).to.equal(CET_MIN_DEPOSIT_WEI);
        });

        it("V09-06: requestWithdrawTo reverts for non-authorized caller", async function () {
            const stack = await deployMedVaultStack();
            const encrypted = await createEncryptedUint64(
                await stack.confidentialETH.getAddress(),
                stack.stranger.address,
                1
            );
            await expectRevert(
                stack.confidentialETH
                    .connect(stack.stranger)
                    .requestWithdrawTo(
                        stack.patient.address,
                        stack.stranger.address,
                        encrypted.handle,
                        encrypted.inputProof
                    ),
                /Not authorized/
            );
        });
    });

    describe("StakingManager.requestPublicUnstake → completePublicUnstake", function () {
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

        it("V09-07: sufficient proof completes public unstake", async function () {
            const { stakingManager, patient } = await deployStakingStack();
            const stakeAmount = CET_MIN_DEPOSIT_WEI * 2n;

            await stakingManager.connect(patient).stake({ value: stakeAmount });

            const awethMock = await ethers.getContractAt("MockAave", AWETH_SEPOLIA);
            const gatewayMock = await ethers.getContractAt("MockAave", WETH_GATEWAY_SEPOLIA);
            const stakingAddr = await stakingManager.getAddress();
            await awethMock.testCredit(patient.address, stakeAmount);
            await gatewayMock.testCredit(stakingAddr, stakeAmount);
            await awethMock.connect(patient).approve(stakingAddr, stakeAmount);

            const reqTx = await stakingManager.connect(patient).requestPublicUnstake(stakeAmount);
            const reqRc = await reqTx.wait();
            const sufficientHandle = parseEventArg(
                reqRc!,
                stakingManager.interface,
                "PublicUnstakeRequested",
                "sufficientHandle"
            );

            const { cleartexts, proof } = await mockPublicDecryptProof(sufficientHandle);
            const unstakeTx = await stakingManager.connect(patient).completePublicUnstake(cleartexts, proof);
            await expect(unstakeTx).to.emit(stakingManager, "PublicUnstaked").withArgs(patient.address);
        });

        it("V09-08: cancelPendingUnstake after timeout", async function () {
            const { stakingManager, patient } = await deployStakingStack();
            const timeout = await stakingManager.CANCEL_TIMEOUT_FUNDS();
            await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 2n });
            await stakingManager.connect(patient).requestPublicUnstake(CET_MIN_DEPOSIT_WEI * 2n);

            await time.increase(timeout + 1n);
            await stakingManager.connect(patient).cancelPendingUnstake();
        });
    });

    describe("StakingManager.requestPrivateUnstake → completePrivateUnstake", function () {
        async function deployPrivateStakingStack() {
            const stack = await deployMedVaultStack();
            const StakingManager = await ethers.getContractFactory("StakingManager");
            const stakingManager = await StakingManager.deploy(
                await stack.confidentialETH.getAddress(),
                AAVE_POOL_SEPOLIA,
                WETH_GATEWAY_SEPOLIA,
                AWETH_SEPOLIA
            );
            await stakingManager.waitForDeployment();
            await stack.confidentialETH.authorizeContract(await stakingManager.getAddress());
            return { ...stack, stakingManager };
        }

        it("V09-09: private unstake returns encrypted stake to cETH without Aave exit", async function () {
            const { stakingManager, patient, confidentialETH } = await deployPrivateStakingStack();
            const stakingAddr = await stakingManager.getAddress();
            const cEthAddr = await confidentialETH.getAddress();

            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });

            await confidentialStakeAndComplete(
                stakingManager,
                confidentialETH,
                patient,
                patient.address,
                1
            );

            const encUnstake = await createEncryptedUint64(stakingAddr, patient.address, 1);
            const reqTx = await stakingManager
                .connect(patient)
                .requestPrivateUnstake(encUnstake.handle, encUnstake.inputProof);
            const reqRc = await reqTx.wait();
            if (!reqRc) throw new Error("requestPrivateUnstake receipt missing");

            const completeTx = await completePrivateUnstakeFromReceipt(
                stakingManager,
                confidentialETH,
                patient,
                reqRc
            );
            await expect(completeTx).to.emit(stakingManager, "PrivateUnstaked").withArgs(patient.address);

            const balanceHandle = await confidentialETH.getBalance(patient.address);
            expect(coerceFheHandle(balanceHandle)).to.be.gt(0n);
        });

        it("V09-10: private unstake event omits amount", async function () {
            const { stakingManager, patient, confidentialETH } = await deployPrivateStakingStack();
            const stakingAddr = await stakingManager.getAddress();

            await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
            await confidentialStakeAndComplete(
                stakingManager,
                confidentialETH,
                patient,
                patient.address,
                1
            );

            const encUnstake = await createEncryptedUint64(stakingAddr, patient.address, 1);
            const reqTx = await stakingManager
                .connect(patient)
                .requestPrivateUnstake(encUnstake.handle, encUnstake.inputProof);
            const reqRc = await reqTx.wait();
            if (!reqRc) throw new Error("requestPrivateUnstake receipt missing");
            const completeTx = await completePrivateUnstakeFromReceipt(
                stakingManager,
                confidentialETH,
                patient,
                reqRc
            );
            const completeRc = await completeTx.wait();
            const unstaked = completeRc?.logs
                .map((l) => {
                    try {
                        return stakingManager.interface.parseLog(l);
                    } catch {
                        return null;
                    }
                })
                .find((p) => p?.name === "PrivateUnstaked");
            expect(unstaked?.args.length).to.equal(1);
        });
    });

    describe("EligibilityEngine.finalizeAnonymousEligibilityWithProof", function () {
        async function stageEligible(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
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
            const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
            const stageTx = await stack.eligibilityEngine
                .connect(registrySigner)
                .stageAnonymousEligibility(
                    id.commitment,
                    trialId,
                    nullifier,
                    stack.patient.address
                );
            const stageRc = await stageTx.wait();
            const finalCt = parseEventArg(
                stageRc!,
                stack.eligibilityEngine.interface,
                "AnonymousEligibilityStaged",
                "finalCt"
            );
            return { trialId, nullifier, finalCt, registrySigner, commitment: id.commitment, id };
        }

        it("V09-11: eligible finalize persists anonymousResults", async function () {
            const stack = await deployMedVaultStack();
            const { trialId, nullifier, finalCt, registrySigner, commitment, id } = await stageEligible(stack);

            const { proofBytes, publicInputs } = await generateTestEligibilityProof({
                identity: id,
                commitment,
                trialId,
                profile: ELIGIBLE_PROFILE,
                eligible: true,
                fheStageHandle: finalCt,
            });

            await stack.eligibilityEngine
                .connect(registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    commitment,
                    nullifier,
                    trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    publicInputs,
                    true
                );

            const result = await stack.eligibilityEngine.getAnonymousResult(nullifier, trialId);
            expect(coerceFheHandle(result)).to.be.gt(0n);
        });

        it("V09-12: ineligible path uses cancelStagedAnonymousEligibility", async function () {
            const stack = await deployMedVaultStack();
            const id = new Identity();
            await registerPatientOnRegistry(
                stack,
                stack.patient,
                id.commitment,
                stack.patient.address,
                PROFILE_FAIL_AGE
            );
            const trialId = await createTrialForSponsor(stack);
            const nullifier = deriveNullifier(id, trialId);
            const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
            const stageTx = await stack.eligibilityEngine
                .connect(registrySigner)
                .stageAnonymousEligibility(
                    id.commitment,
                    trialId,
                    nullifier,
                    stack.patient.address
                );
            const stageRc = await stageTx.wait();
            const finalCt = parseEventArg(
                stageRc!,
                stack.eligibilityEngine.interface,
                "AnonymousEligibilityStaged",
                "finalCt"
            );

            expect(await mockDecryptBool(finalCt, await stack.eligibilityEngine.getAddress(), stack.patient.address)).to.equal(false);
            await stack.eligibilityEngine
                .connect(registrySigner)
                .cancelStagedAnonymousEligibility(nullifier, trialId, stack.patient.address);
        });

        it("V09-13: forged noir proof reverts", async function () {
            const stack = await deployMedVaultStack();
            const { trialId, nullifier, registrySigner, commitment } = await stageEligible(stack);
            const bogusInputs = Array.from({ length: 16 }, () => ethers.ZeroHash);

            await expectRevert(
                stack.eligibilityEngine
                    .connect(registrySigner)
                    .finalizeAnonymousEligibilityWithProof(
                        commitment,
                        nullifier,
                        trialId,
                    stack.patient.address,
                    stack.patient.address,
                    "0x" + "00".repeat(128),
                        bogusInputs,
                        true
                    ),
                /Invalid Noir proof|reverted/
            );
        });
    });
});
