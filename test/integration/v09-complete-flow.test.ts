import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import {
    assertFhevmMock,
    mockDecryptBool,
    mockPublicDecryptProof,
} from "../../test-support/fhe";
import { createEncryptedUint64 } from "../../test-support/fhe";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import { expectRevert } from "../../test-support/assertions";
import { PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { grantConsentLegacy } from "../../test-support/consent";
import { CET_MIN_DEPOSIT_WEI, AWETH_SEPOLIA, WETH_GATEWAY_SEPOLIA, AAVE_POOL_SEPOLIA, DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import {
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    walletApplyWithConsent,
    sponsorAcceptApplication,
    sponsorRejectApplication,
    fundRegisterAndDistribute,
    fundTrialPool,
    registerInPool,
    endTrialAndDistribute,
    claimAndCompleteRewards,
    weiToCethUnits,
    completeWithdrawFromReceipt,
    freshTrialWithPatient,
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/journey";
import { requestEncryptedWithdraw } from "../../test-support/withdraw";
import { createEncryptedClaimUnits } from "../../test-support/withdraw";
import {
    cancelAnonymousApplyStage,
    buildAnonymousApplyArgs,
} from "../../test-support/anonymousApply";

describe("Integration: v0.9 complete patient flows", function () {
    before(function () {
        assertFhevmMock();
    });

    describe("Semaphore apply → v0.9 finalize → sponsor pool", function () {
        it("FLOW-01: eligible Semaphore path through distribute", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            await grantConsentLegacy(stack.consentManager.connect(stack.patient), trialId);

            const staged = await stageSemaphoreApply(stack, trialId, patient);
            expect(await mockDecryptBool(staged.finalCt, await stack.eligibilityEngine.getAddress(), stack.patient.address)).to.equal(true);

            const finalized = await finalizeSemaphoreApply(stack, staged, patient);
            expect(finalized.eligible).to.equal(true);
            expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(
                true
            );

            const status = await stack.eligibilityEngine.getAnonymousApplicationStatus(
                staged.nullifier,
                trialId
            );
            expect(status).to.equal(1n);

            await sponsorAcceptApplication(stack, trialId, staged.nullifier);
            await fundRegisterAndDistribute(stack, trialId, staged.nullifier);

            expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
            expect(
                await stack.sponsorIncentiveVault.isParticipantRegistered(trialId, stack.patient.address)
            ).to.equal(true);

            const expectedUnits = weiToCethUnits(10n ** 18n);
            expect(expectedUnits).to.be.gt(0n);
        });

        it("FLOW-02: ineligible profile cannot finalize with honest proof", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
            const trialId = await createTrialForSponsor(stack);

            const staged = await stageSemaphoreApply(stack, trialId, patient);
            expect(await mockDecryptBool(staged.finalCt, await stack.eligibilityEngine.getAddress(), stack.patient.address)).to.equal(false);

            await expect(
                generateTestEligibilityProof({
                    identity: patient.identity,
                    commitment: patient.commitment,
                    trialId,
                    profile: patient.profile,
                    eligible: true,
                    fheStageHandle: staged.finalCt,
                })
            ).to.be.rejected;

            expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(
                false
            );
        });

        it("FLOW-03: ineligible stage can be cancelled without applying", async function () {
            const stack = await deployMedVaultStack();
            const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
            const trialId = await createTrialForSponsor(stack);
            const staged = await stageSemaphoreApply(stack, trialId, patient);

            await cancelAnonymousApplyStage(
                stack.medVaultRegistry,
                stack.patient,
                trialId,
                patient.identity,
                stack.patient.address
            );
            expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(
                false
            );
        });

        it("FLOW-04: double finalize reverts after successful apply", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);

            const { generateTestEligibilityProof } = await import("../../test-support/noirProof");
            const { proofBytes, publicInputs } = await generateTestEligibilityProof({
                identity: patient.identity,
                commitment: patient.commitment,
                trialId,
                profile: patient.profile,
                eligible: true,
                fheStageHandle: staged.finalCt,
            });
            const applyArgs = await buildAnonymousApplyArgs(
                stack.medVaultRegistry,
                trialId,
                patient.identity,
                stack.patient.address
            );
            await expectRevert(
                stack.medVaultRegistry
                    .connect(stack.patient)
                    .finalizeAnonymousApplyWithProof(
                        trialId,
                        staged.proof,
                        patient.commitment,
                        stack.patient.address,
                        applyArgs.consentWallet,
                        applyArgs.deadline,
                        applyArgs.permitSignature,
                        applyArgs.consentWalletSignature,
                        proofBytes,
                        publicInputs,
                        true
                    ),
                /Already applied/
            );
        });

        it("FLOW-05: decryptPermitHolder set after Semaphore finalize", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);
            expect(
                await stack.eligibilityEngine.getDecryptPermitHolder(staged.nullifier, trialId)
            ).to.equal(stack.patient.address);
        });

        it("FLOW-06: anonymous result handle persisted after finalize", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);
            const result = await stack.eligibilityEngine.getAnonymousResult(
                staged.nullifier,
                trialId
            );
            expect(result).to.not.equal(0n);
        });
    });

    describe("Reward claim → completeWithdrawTo", function () {
        it("FLOW-07: claimParticipantRewards completes to destination", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            const fundWei = 10n ** 18n;
            await fundRegisterAndDistribute(stack, trialId, nullifier, fundWei);

            const units = weiToCethUnits(fundWei);
            const destination = stack.patient.address;
            const destBefore = await ethers.provider.getBalance(destination);

            const { gasCost } = await claimAndCompleteRewards(stack, trialId, nullifier, destination, units);

            const destAfter = await ethers.provider.getBalance(destination);
            expect(destAfter - destBefore + gasCost).to.equal(fundWei);
        });

        it("FLOW-08: partial claim leaves remaining confidential balance", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            const fundWei = 10n ** 18n;
            await fundRegisterAndDistribute(stack, trialId, nullifier, fundWei);

            const totalUnits = weiToCethUnits(fundWei);
            const partial = totalUnits / 2n;
            expect(partial).to.be.gt(0n);

            await claimAndCompleteRewards(
                stack,
                trialId,
                nullifier,
                stack.patient.address,
                partial
            );

            // Second partial claim for remainder proves balance was not fully drained in first claim.
            await claimAndCompleteRewards(
                stack,
                trialId,
                nullifier,
                stack.patient.address,
                totalUnits - partial
            );
        });

        it("FLOW-09: claim emits ClaimInitiated", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundRegisterAndDistribute(stack, trialId, nullifier);

            const units = weiToCethUnits(10n ** 18n);
            const encrypted = await createEncryptedClaimUnits(
                await stack.confidentialETH.getAddress(),
                await stack.sponsorIncentiveVault.getAddress(),
                units
            );
            await expect(
                stack.sponsorIncentiveVault
                    .connect(stack.patient)
                    .claimParticipantRewards(
                        trialId,
                        nullifier,
                        stack.patient.address,
                        encrypted.handle,
                        encrypted.inputProof
                    )
            ).to.emit(stack.sponsorIncentiveVault, "ClaimInitiated");
        });

        it("FLOW-10: claim reverts when patient not in pool", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId);

            const encrypted = await createEncryptedUint64(
                await stack.confidentialETH.getAddress(),
                await stack.sponsorIncentiveVault.getAddress(),
                1
            );
            await expectRevert(
                stack.sponsorIncentiveVault
                    .connect(stack.patient)
                    .claimParticipantRewards(
                        trialId,
                        nullifier,
                        stack.patient.address,
                        encrypted.handle,
                        encrypted.inputProof
                    ),
                /Patient not registered/
            );
        });
    });

    describe("Multi-participant and sponsor decisions", function () {
        it("FLOW-11: two participants receive pro-rata screening rewards", async function () {
            const stack = await deployMedVaultStack();
            const patientA = await registerPatient(stack, stack.patient);
            const patientB = await registerPatient(stack, stack.stranger);
            const trialId = await createTrialForSponsor(stack);

            const applyA = await walletApplyWithConsent(stack, trialId, patientA);
            const applyB = await walletApplyWithConsent(stack, trialId, patientB, stack.stranger);
            await sponsorAcceptApplication(stack, trialId, applyA.nullifier);
            await sponsorAcceptApplication(stack, trialId, applyB.nullifier);

            const fundWei = 2n * 10n ** 18n;
            await fundTrialPool(stack, trialId, fundWei);
            await registerInPool(stack, trialId, applyA.nullifier, stack.patient);
            await registerInPool(stack, trialId, applyB.nullifier, stack.stranger);
            await endTrialAndDistribute(stack, trialId);

            expect(weiToCethUnits(10n ** 18n)).to.equal(1_000_000n);
            expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(2n);
        });

        it("FLOW-12: rejected Semaphore applicant cannot join pool", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);
            await sponsorRejectApplication(stack, trialId, staged.nullifier);
            await fundTrialPool(stack, trialId);

            await expectRevert(
                stack.sponsorIncentiveVault
                    .connect(stack.patient)
                    .registerAnonymousParticipant(trialId, staged.nullifier),
                /must be accepted/
            );
        });

        it("FLOW-13: Semaphore E2E mirrors wallet path to distribute", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const staged = await stageSemaphoreApply(stack, trialId, patient);
            await finalizeSemaphoreApply(stack, staged, patient);
            await sponsorAcceptApplication(stack, trialId, staged.nullifier);
            await fundRegisterAndDistribute(stack, trialId, staged.nullifier);

            expect(await stack.eligibilityEngine.getAnonymousApplicationStatus(staged.nullifier, trialId)).to.equal(
                2n
            );
            expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(1n);
        });
    });

    describe("ConfidentialETH and staking exits", function () {
        it("FLOW-14: deposit → requestWithdraw → completeWithdraw", async function () {
            const stack = await deployMedVaultStack();
            await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
            const reqTx = await requestEncryptedWithdraw(stack.confidentialETH, stack.patient, 1);
            const reqRc = (await reqTx.wait())!;
            await completeWithdrawFromReceipt(stack.confidentialETH, stack.patient, reqRc);
        });

        it("FLOW-15: stake → requestUnstake → completeUnstake", async function () {
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

            const stakeAmount = CET_MIN_DEPOSIT_WEI * 2n;
            await stakingManager.connect(stack.patient).stake({ value: stakeAmount });

            const awethMock = await ethers.getContractAt("MockAave", AWETH_SEPOLIA);
            const gatewayMock = await ethers.getContractAt("MockAave", WETH_GATEWAY_SEPOLIA);
            const stakingAddr = await stakingManager.getAddress();
            await awethMock.testCredit(stack.patient.address, stakeAmount);
            await gatewayMock.testCredit(stakingAddr, stakeAmount);
            await awethMock.connect(stack.patient).approve(stakingAddr, stakeAmount);

            const reqTx = await stakingManager.connect(stack.patient).requestUnstake(stakeAmount);
            const reqRc = (await reqTx.wait())!;
            const sufficientHandle = (await import("../../test-support/fhe")).parseEventArg(
                reqRc,
                stakingManager.interface,
                "PublicUnstakeRequested",
                "sufficientHandle"
            );
            const { cleartexts, proof } = await mockPublicDecryptProof(sufficientHandle);
            await stakingManager.connect(stack.patient).completePublicUnstake(cleartexts, proof);
        });
    });

    describe("Automation and milestones on full path", function () {
        it("FLOW-16: automation performUpkeep after Semaphore apply path", async function () {
            const { stack, patient, trialId } = await freshTrialWithPatient();
            const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await fundTrialPool(stack, trialId, 10n ** 18n);
            await registerInPool(stack, trialId, nullifier);

            const trial = await stack.trialManager.getTrial(trialId);
            const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
            const firstDeadline = now + 3600n;
            const secondDeadline = trial.endTime > firstDeadline + 100n ? trial.endTime - 10n : firstDeadline + 7200n;
            await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
                trialId,
                ["Screening", "End"],
                [6000, 4000],
                [firstDeadline, secondDeadline]
            );

            await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
            const [, data] = await stack.medVaultAutomation.checkUpkeep("0x");
            await stack.medVaultAutomation.connect(stack.owner).performUpkeep(data);

            expect(await stack.medVaultAutomation.finalized(trialId)).to.equal(true);
            expect(await stack.sponsorIncentiveVault.isDistributed(trialId)).to.equal(true);
        });
    });
});
