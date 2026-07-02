import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { DEFAULT_TRIAL_PARAMS, CET_MIN_DEPOSIT_WEI, WETH_GATEWAY_SEPOLIA, AAVE_POOL_SEPOLIA, AWETH_SEPOLIA } from "../../test-support/constants";
import {
    registerPatient,
    walletApplyWithConsent,
    stageSemaphoreApply,
    fundTrialPool,
    sponsorAcceptApplication,
    registerInPool,
} from "../../test-support/journey";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";
import { completeMilestoneSigned } from "../../test-support/milestone";
import {
    createEncryptedBool,
} from "../../test-support/fhe";
import { signConsentGrant } from "../../test-support/anonymousApply";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import {
    defaultApplyDeadline,
    signAnonymousApplyPermit,
    signConsentWalletBinding,
} from "../../test-support/anonymousApply";
import { semaphoreProofFor } from "../../test-support/journey";

async function deployStaking() {
    const stack = await deployMedVaultStack();
    const MockAave = await ethers.getContractFactory("MockAave");
    const mockAave = await MockAave.deploy();
    await mockAave.waitForDeployment();
    const WETH_GATEWAY = WETH_GATEWAY_SEPOLIA;
    const AWETH = AWETH_SEPOLIA;
    const AAVE_POOL = AAVE_POOL_SEPOLIA;
    const mockCode = await ethers.provider.getCode(await mockAave.getAddress());
    await ethers.provider.send("hardhat_setCode", [WETH_GATEWAY, mockCode]);
    await ethers.provider.send("hardhat_setCode", [AWETH, mockCode]);
    const StakingManager = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManager.deploy(
        await stack.confidentialETH.getAddress(),
        AAVE_POOL,
        WETH_GATEWAY,
        AWETH
    );
    await stakingManager.waitForDeployment();
    const { authorizeCethContract } = await import("../../test-support/timelock");
    await authorizeCethContract(
        stack.confidentialETH,
        stack.owner,
        await stakingManager.getAddress(),
        true
    );
    return { ...stack, stakingManager };
}

describe("Unit: High-severity vulnerability fixes", function () {
    it("H-7: getEncryptedTotalStaked rejects non-owner caller", async function () {
        const { stakingManager, patient, stranger } = await deployStaking();
        await stakingManager.connect(patient).stake({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await expectRevert(
            stakingManager.connect(stranger).getEncryptedTotalStaked(patient.address),
            /Not authorized/
        );
        await stakingManager.connect(patient).getEncryptedTotalStaked(patient.address);
    });

    it("H-8: paginated screening leaves milestone open until all eligible paid", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);
        const patientA = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const patientB = await registerPatient(stack, stack.stranger, ELIGIBLE_PROFILE);
        const { nullifier: nullA } = await walletApplyWithConsent(stack, trialId, patientA);
        const { nullifier: nullB } = await walletApplyWithConsent(stack, trialId, patientB, stack.stranger);
        await sponsorAcceptApplication(stack, trialId, nullA);
        await sponsorAcceptApplication(stack, trialId, nullB);
        await registerInPool(stack, trialId, nullA, stack.patient);
        await registerInPool(stack, trialId, nullB, stack.stranger);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [now + 3600n]
        );
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.patient, trialId, 0n);
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.stranger, trialId, 0n);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 0, 1);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(false);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 1, 1);
        expect(await stack.sponsorIncentiveVault.milestoneDistributed(trialId, 0)).to.equal(true);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.stranger.address, 0)
        ).to.equal(true);
    });

    it("H-9: distributeMilestoneToParticipant blocked during pagination", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);
        const patientA = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const patientB = await registerPatient(stack, stack.stranger, ELIGIBLE_PROFILE);
        const { nullifier: nullA } = await walletApplyWithConsent(stack, trialId, patientA);
        const { nullifier: nullB } = await walletApplyWithConsent(stack, trialId, patientB, stack.stranger);
        await sponsorAcceptApplication(stack, trialId, nullA);
        await sponsorAcceptApplication(stack, trialId, nullB);
        await registerInPool(stack, trialId, nullA, stack.patient);
        await registerInPool(stack, trialId, nullB, stack.stranger);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime]
        );
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.patient, trialId, 0n);
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.stranger, trialId, 0n);
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.patient, trialId, 1n);
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.stranger, trialId, 1n);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 1, 0, 1);
        expect(await stack.sponsorIncentiveVault.paginationStarted(trialId, 1)).to.equal(true);

        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributeMilestoneToParticipant(trialId, stack.stranger.address, 1),
            /Pagination in progress|PaginationInProgress/
        );
    });

    it("H-1: finalize without patient consent signature reverts", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const recipient = stack.patient.address;
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId: staged.trialId,
            profile: patient.profile,
            eligible: true,
            fheStageHandle: staged.finalCt,
        });
        const registryAddress = await stack.medVaultRegistry.getAddress();
        const deadline = await defaultApplyDeadline();
        const proofFresh = semaphoreProofFor(
            staged.trialId,
            staged.nullifier,
            patient.commitment,
            recipient
        );
        const permitSignature = await signAnonymousApplyPermit(stack.patient, registryAddress, {
            trialId: staged.trialId,
            commitment: patient.commitment,
            nullifier: staged.nullifier,
            permitRecipient: recipient,
            deadline,
        });
        const consentWallet = stack.patient.address;
        const consentWalletSignature = await signConsentWalletBinding(stack.patient, registryAddress, {
            nullifier: staged.nullifier,
            trialId: staged.trialId,
            consentWallet,
            deadline,
        });
        const encConsent = await createEncryptedBool(registryAddress, stack.relayer.address, true);
        const badConsentSignature = await signConsentGrant(stack.stranger, registryAddress, {
            consentHandle: encConsent.handle,
            trialId: staged.trialId,
            consentWallet,
            deadline,
        });

        await expectRevert(
            stack.medVaultRegistry.connect(stack.relayer).finalizeAnonymousApplyWithConsent(
                staged.trialId,
                proofFresh,
                patient.commitment,
                recipient,
                consentWallet,
                deadline,
                permitSignature,
                consentWalletSignature,
                encConsent.handle,
                encConsent.inputProof,
                deadline,
                badConsentSignature,
                proofBytes,
                publicInputs
            ),
            /Invalid consent grant signature/
        );
    });

    it("H-4: registerPatientClear from stranger reverts even with test helpers", async function () {
        const stack = await deployMedVaultStack();
        const id = (await import("@semaphore-protocol/identity")).Identity;
        const identity = new id();
        await expectRevert(
            stack.anonymousPatientRegistry.connect(stack.stranger).registerPatientClear(
                identity.commitment,
                stack.patient.address,
                ELIGIBLE_PROFILE.age,
                ELIGIBLE_PROFILE.gender,
                ELIGIBLE_PROFILE.weight,
                ELIGIBLE_PROFILE.height,
                ELIGIBLE_PROFILE.hasDiabetes,
                ELIGIBLE_PROFILE.hbLevel,
                ELIGIBLE_PROFILE.isSmoker,
                ELIGIBLE_PROFILE.hasHypertension
            ),
            /Only authorized registry/
        );
    });

    it("H-10: setTrialManager reverts (immutable trialManager)", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.trialMilestoneManager.connect(stack.owner).setTrialManager(stack.owner.address),
            /immutable|TrialManager is immutable/
        );
    });

    it("H-11: completeMilestone without patient signature reverts", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);
        const patient = await registerPatient(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        await registerInPool(stack, trialId, nullifier, stack.patient);
        const trial = await stack.trialManager.getTrial(trialId);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [trial.endTime]
        );
        await expectRevert(
            stack.trialMilestoneManager
                .connect(stack.sponsor)
                .completeMilestone(trialId, stack.patient.address, 0, (await time.latest()) + 3600, "0x"),
            /Invalid patient signature|ECDSA|revert/i
        );
    });

    it("H-14: batchCompare reverts when range exceeds MAX_BATCH_COMPARE", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.encryptedScoreLeaderboard.setTrialSponsor(trialId, stack.sponsor.address);
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        for (let i = 1n; i <= 20n; i++) {
            await stack.encryptedScoreLeaderboard.connect(engineSigner).addApplicant(trialId, i);
        }
        await expectRevert(
            stack.encryptedScoreLeaderboard.connect(stack.sponsor).batchCompare(trialId, 1n, 0, 16),
            /Batch too large/
        );
    });

    it("H-17: transferEncrypted from token contract balance reverts", async function () {
        const stack = await deployMedVaultStack();
        const cethAddr = await stack.confidentialETH.getAddress();
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        const { createEncryptedUint64 } = await import("../../test-support/fhe");
        const enc = await createEncryptedUint64(cethAddr, stack.patient.address, 1n);
        await expectRevert(
            stack.confidentialETH.connect(vaultSigner).transferEncrypted(
                cethAddr,
                stack.patient.address,
                enc.handle
            ),
            /Bad from/
        );
    });
});
