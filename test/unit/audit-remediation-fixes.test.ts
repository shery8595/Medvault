import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    fundTrialPool,
    sponsorAcceptApplication,
    registerInPool,
    walletApplyWithConsent,
} from "../../test-support/journey";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import { completeMilestoneSigned } from "../../test-support/milestone";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import {
    buildAnonymousApplyArgs,
    defaultApplyDeadline,
    signAnonymousApplyPermit,
    signConsentWalletBinding,
} from "../../test-support/anonymousApply";
import { semaphoreProofFor } from "../../test-support/journey";
import { impersonateAccount } from "../../test-support/signers";
import { CET_MIN_DEPOSIT_WEI, WETH_GATEWAY_SEPOLIA, AAVE_POOL_SEPOLIA, AWETH_SEPOLIA } from "../../test-support/constants";
import { authorizeCethContract } from "../../test-support/timelock";
import { createEncryptedUint64 } from "../../test-support/fhe";
import { confidentialStakeAndComplete } from "../../test-support/staking";

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
    await authorizeCethContract(
        stack.confidentialETH,
        stack.owner,
        await stakingManager.getAddress(),
        true
    );
    return { ...stack, stakingManager };
}

describe("Unit: audit remediation fixes (HIGH-1 / MEDIUM-1..4)", function () {
    it("HIGH-1: non-relayer finalizeAnonymousApplyWithProof reverts; relayer succeeds", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId,
            profile: patient.profile,
            profileSalt: patient.profileSalt,
            eligible: true,
            fheStageHandle: staged.finalCt,
        });
        const proofFresh = semaphoreProofFor(
            staged.trialId,
            staged.nullifier,
            patient.commitment,
            stack.patient.address
        );
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
                    proofFresh,
                    patient.commitment,
                    stack.patient.address,
                    applyArgs.consentWallet,
                    applyArgs.deadline,
                    applyArgs.permitSignature,
                    applyArgs.consentWalletSignature,
                    proofBytes,
                    publicInputs
            ),
            /Only authorized relayer/
        );

        await expect(
            stack.medVaultRegistry
                .connect(stack.relayer)
                .finalizeAnonymousApplyWithProof(
                    trialId,
                    proofFresh,
                    patient.commitment,
                    stack.patient.address,
                    applyArgs.consentWallet,
                    applyArgs.deadline,
                    applyArgs.permitSignature,
                    applyArgs.consentWalletSignature,
                    proofBytes,
                    publicInputs
            )
        ).to.emit(stack.medVaultRegistry, "AnonymousApplication");
    });

    it("HIGH-1: direct EligibilityEngine finalize reverts", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: patient.identity,
            commitment: patient.commitment,
            trialId,
            profile: patient.profile,
            profileSalt: patient.profileSalt,
            eligible: true,
            fheStageHandle: staged.finalCt,
        });

        await expectRevert(
            stack.eligibilityEngine.finalizeAnonymousEligibilityWithProof(
                patient.commitment,
                staged.nullifier,
                trialId,
                stack.patient.address,
                stack.patient.address,
                proofBytes,
                publicInputs
            ),
            /Only authorized registry/
        );
    });

    it("MEDIUM-4: manual milestone payout then paginated batch does not stall", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            const p = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
            const { nullifier } = await walletApplyWithConsent(stack, trialId, p, signer);
            await sponsorAcceptApplication(stack, trialId, nullifier);
            await registerInPool(stack, trialId, nullifier, signer);
        }

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening", "Phase2"],
            [5000, 5000],
            [now + 3600n, trial.endTime]
        );
        for (const signer of signers) {
            await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, signer, trialId, 0n);
            await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, signer, trialId, 1n);
        }
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributeMilestoneToParticipant(trialId, stack.patient.address, 1);
        expect(await stack.sponsorIncentiveVault.milestoneRemainderPaid(trialId, 1)).to.equal(true);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 1, 0, 3);
        expect(
            await stack.sponsorIncentiveVault.entitlementStaged(trialId, stack.stranger.address, 1)
        ).to.equal(true);
    });

    it("MEDIUM-2: abandoned reclaim opens claim window when staged entitlements exist", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const fundWei = 10n ** 18n;
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: fundWei });

        const patient = await registerPatient(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        await registerInPool(stack, trialId, nullifier, stack.patient);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [now + 3600n]
        );
        await completeMilestoneSigned(stack.trialMilestoneManager, stack.sponsor, stack.patient, trialId, 0n);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).distribute(trialId);

        await stack.sponsorRegistry.connect(stack.owner).removeSponsor(stack.sponsor.address);
        await time.increase(91 * 24 * 60 * 60);

        await stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(false);
        const openedAt = await stack.sponsorIncentiveVault.abandonedReclaimOpenedAt(trialId);
        expect(openedAt).to.be.gt(0n);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId),
            /ParticipantClaimWindowOpen/
        );

        await time.increase(7 * 24 * 60 * 60 + 1);
        await stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
    });

    it("MEDIUM-2: abandoned reclaim without staged entitlements succeeds immediately", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await stack.sponsorIncentiveVault.connect(stack.sponsor).fundTrial(trialId, { value: 10n ** 17n });
        const patient = await registerPatient(stack);
        const { nullifier } = await walletApplyWithConsent(stack, trialId, patient);
        await sponsorAcceptApplication(stack, trialId, nullifier);
        await registerInPool(stack, trialId, nullifier, stack.patient);

        await stack.sponsorRegistry.connect(stack.owner).removeSponsor(stack.sponsor.address);
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        await time.increase(91 * 24 * 60 * 60);

        await stack.sponsorIncentiveVault.connect(stack.owner).reclaimAbandonedToOwner(trialId);
        expect(await stack.sponsorIncentiveVault.reclaimFinalized(trialId)).to.equal(true);
    });

    it("MEDIUM-3: locked balance blocks confidentialTransfer", async function () {
        const { stakingManager, patient, confidentialETH, stranger } = await deployStakingStack();
        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await confidentialStakeAndComplete(stakingManager, confidentialETH, patient, patient.address, 1);
        expect(await confidentialETH.isBalanceLocked(patient.address)).to.equal(true);

        const enc = await createEncryptedUint64(
            await confidentialETH.getAddress(),
            stranger.address,
            1
        );
        await expectRevert(
            confidentialETH
                .connect(patient)
                ["confidentialTransfer(address,bytes32,bytes)"](stranger.address, enc.handle, enc.inputProof),
            /Balance locked/
        );
    });

    it("MEDIUM-1: rotateTrustedContract bumps ACL epoch", async function () {
        const stack = await deployMedVaultStack();
        const kind = 1; // EligibilityEngine
        expect(await stack.anonymousPatientRegistry.aclEpochForKind(kind)).to.equal(1n);
        await expect(stack.anonymousPatientRegistry.connect(stack.owner).rotateTrustedContract(kind, stack.sponsor.address))
            .to.emit(stack.anonymousPatientRegistry, "AclEpochRotated")
            .withArgs(kind, 2n, stack.sponsor.address);
        expect(await stack.anonymousPatientRegistry.aclEpochForKind(kind)).to.equal(2n);
    });
});
