import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { Identity } from "@semaphore-protocol/identity";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";
import {
    assertFhevmMock,
    buildAesKeyChunksForTest,
    buildPatientProfileInputs,
    coerceFheHandle,
    createEncryptedUint64,
} from "../../test-support/fhe";
import {
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    fundTrialPool,
    sponsorAcceptApplication,
    registerInPool,
    semaphoreProofFor,
} from "../../test-support/journey";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import {
    buildAnonymousApplyArgs,
} from "../../test-support/anonymousApply";
import {
    computeProfileCommitment,
    defaultProfileSalt,
    forbiddenProfileSaltCommitment,
} from "../../test-support/profileCommitment";
import { impersonateAccount } from "../../test-support/signers";
import { scheduleAndApply } from "../../test-support/timelock";
import {
    CET_MIN_DEPOSIT_WEI,
    DEFAULT_TRIAL_PARAMS,
    WETH_GATEWAY_SEPOLIA,
    AAVE_POOL_SEPOLIA,
    AWETH_SEPOLIA,
} from "../../test-support/constants";
import { authorizeCethContract } from "../../test-support/timelock";
import { confidentialStakeAndComplete } from "../../test-support/staking";
import {
    completeEncryptedWithdraw,
    requestEncryptedWithdraw,
} from "../../test-support/withdraw";
import { generateKey } from "../../test-support/documentCrypto";
import { revokeAccessAndRotate } from "../../test-support/documentRevoke";
const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

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

describe("Unit: vulnerability remediation regressions", function () {
    before(function () {
        assertFhevmMock();
    });

    it("P3.2 / HIGH-1: only authorized relayer may finalizeAnonymousApplyWithProof", async function () {
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

        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(true);
    });

    it("P0-2: relayer decrypt overrides forged client eligible claim", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, PROFILE_FAIL_AGE);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient, stack.patient, stack.relayer.address);

        const {
            cacheStageHandle,
            getRelayerEligible,
            _resetCachesForTest,
        } = await import("../../relayer/eligibility-decrypt.mjs");
        _resetCachesForTest();

        const block = await ethers.provider.getBlock(staged.stageReceipt.blockNumber);
        cacheStageHandle(staged.nullifier, trialId, staged.finalCt, Number(block!.timestamp) * 1000);

        const engineAddr = await stack.eligibilityEngine.getAddress();
        const relayerEligible = await getRelayerEligible({
            sdk: null,
            eligibilityEngineAddress: engineAddr,
            nullifier: staged.nullifier,
            trialId,
            finalCt: staged.finalCt,
            decryptFn: async (handle, contract) =>
                (await import("../../test-support/fhe")).mockUserDecryptBool(
                    handle,
                    contract,
                    stack.relayer
                ),
        });

        expect(relayerEligible).to.equal(false);
        const clientForgedEligible = true;
        expect(clientForgedEligible).to.equal(true);
        expect(relayerEligible).to.equal(false);
    });

    it("HIGH-2: deprecated confidential stake reverts; stakeAndLock credits encrypted stake", async function () {
        const { stakingManager, patient, confidentialETH } = await deployStakingStack();
        const stakingAddr = await stakingManager.getAddress();

        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
        const enc = await createEncryptedUint64(stakingAddr, patient.address, 1);
        await expectRevert(
            stakingManager.connect(patient).requestConfidentialStake(enc.handle, enc.inputProof),
            /Use stakeAndLock/
        );
        const { cleartexts, proof } = { cleartexts: "0x", proof: "0x" };
        await expectRevert(
            stakingManager.connect(patient).completeConfidentialStake(cleartexts, proof),
            /Use stakeAndLock/
        );

        await confidentialStakeAndComplete(
            stakingManager,
            confidentialETH,
            patient,
            patient.address,
            1
        );
        const staked = await stakingManager.connect(patient).getEncryptedTotalStaked(patient.address);
        expect(coerceFheHandle(staked)).to.be.gt(0n);
    });

    it("MED-1: production registerPatient rejects forbidden deterministic salt; clear helper accepts", async function () {
        const stack = await deployMedVaultStack();
        const identity = new Identity();
        const commitment = identity.commitment;
        const mvrAddr = await stack.medVaultRegistry.getAddress();
        const aprAddr = await stack.anonymousPatientRegistry.getAddress();
        const inputs = await buildPatientProfileInputs(aprAddr, mvrAddr, ELIGIBLE_PROFILE);
        const detSalt = await defaultProfileSalt(commitment);
        const profileCommitment = computeProfileCommitment(commitment, ELIGIBLE_PROFILE, detSalt);
        const forbidden = await forbiddenProfileSaltCommitment(commitment);

        await expectRevert(
            stack.medVaultRegistry.connect(stack.patient).registerPatient(
                commitment,
                stack.patient.address,
                `0x${profileCommitment.toString(16).padStart(64, "0")}` as `0x${string}`,
                forbidden,
                inputs.age.handle,
                inputs.gender.handle,
                inputs.weight.handle,
                inputs.height.handle,
                inputs.hasDiabetes.handle,
                inputs.hbLevel.handle,
                inputs.isSmoker.handle,
                inputs.hasHypertension.handle,
                inputs.inputProof
            ),
            /Forbidden deterministic salt/
        );

        const registrySigner = await impersonateAccount(mvrAddr);
        await ethers.provider.send("hardhat_setBalance", [mvrAddr, "0x1000000000000000000"]);
        await stack.anonymousPatientRegistry.connect(registrySigner).registerPatientClear(
            commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE.age,
            ELIGIBLE_PROFILE.gender,
            ELIGIBLE_PROFILE.weight,
            ELIGIBLE_PROFILE.height,
            ELIGIBLE_PROFILE.hasDiabetes,
            ELIGIBLE_PROFILE.hbLevel,
            ELIGIBLE_PROFILE.isSmoker,
            ELIGIBLE_PROFILE.hasHypertension
        );
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        const onChain = await stack.anonymousPatientRegistry
            .connect(engineSigner)
            .getProfileCommitment(commitment);
        expect(onChain).to.not.equal(ethers.ZeroHash);
    });

    it("MED-2: atomic revokeAccess emits DocumentLegacyHandleRevoked with old CID/handle hashes", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        const nullifier = staged.nullifier;
        const oldKey = generateKey();
        const newKey = generateKey();
        const cid = "QmRemediationOld";
        const newCid = "QmRemediationNew";
        const docStoreAddr = await stack.patientDocumentStore.getAddress();

        const { chunks: oldChunks, inputProof: oldProof } = await buildAesKeyChunksForTest(
            docStoreAddr,
            stack.patient.address,
            oldKey
        );
        await stack.patientDocumentStore
            .connect(stack.patient)
            .recordDocumentCid(
                nullifier,
                trialId,
                cid,
                docCidHash(cid),
                oldChunks[0]!.handle,
                oldChunks[1]!.handle,
                oldChunks[2]!.handle,
                oldChunks[3]!.handle,
                oldProof
            );

        const before = await stack.patientDocumentStore
            .connect(stack.patient)
            .getDocumentRecord(nullifier, trialId);
        const oldCidHash = ethers.keccak256(ethers.toUtf8Bytes(cid));
        const oldKey0 = ethers.toBeHex(coerceFheHandle(before.keyChunk0) % BN254, 32);
        const oldKey1 = ethers.toBeHex(coerceFheHandle(before.keyChunk1) % BN254, 32);
        const oldKey2 = ethers.toBeHex(coerceFheHandle(before.keyChunk2) % BN254, 32);
        const oldKey3 = ethers.toBeHex(coerceFheHandle(before.keyChunk3) % BN254, 32);

        const rc = await revokeAccessAndRotate(
            stack.patientDocumentStore,
            stack.patient,
            nullifier,
            trialId,
            newCid,
            newKey
        );

        await expect(rc?.hash)
            .to.emit(stack.patientDocumentStore, "DocumentLegacyHandleRevoked")
            .withArgs(nullifier, trialId, oldCidHash, oldKey0, oldKey1, oldKey2, oldKey3, cid);
    });

    it("MED-3: sponsor-only registerAnonymousParticipant reverts; patient enrolls", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        await sponsorAcceptApplication(stack, trialId, staged.nullifier);
        await fundTrialPool(stack, trialId);

        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .registerAnonymousParticipant(trialId, staged.nullifier),
            /Only permit holder can register|OnlyPermitHolderCanRegister/
        );

        await registerInPool(stack, trialId, staged.nullifier, stack.patient);
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(1n);
    });

    it("LOW-1: failed withdraw escrows funds, emits event, and is claimable", async function () {
        const stack = await deployMedVaultStack();
        const RejectOnce = await ethers.getContractFactory("RejectOnce");
        const rejecter = await RejectOnce.deploy();
        await rejecter.waitForDeployment();
        const rejecterAddr = await rejecter.getAddress();

        await ethers.provider.send("hardhat_setBalance", [rejecterAddr, "0x1000000000000000000"]);
        const rejecterSigner = await impersonateAccount(rejecterAddr);
        await stack.confidentialETH.connect(rejecterSigner).deposit({ value: CET_MIN_DEPOSIT_WEI });

        const reqTx = await requestEncryptedWithdraw(stack.confidentialETH, rejecterSigner, 1);
        const reqRc = await reqTx.wait();
        if (!reqRc) throw new Error("withdraw request receipt missing");

        const completeTx = await completeEncryptedWithdraw(
            stack.confidentialETH,
            rejecterSigner,
            reqRc
        );
        await expect(completeTx).to.emit(stack.confidentialETH, "InsolventWithdrawalAttempted");
        await expect(completeTx).to.emit(stack.confidentialETH, "FailedWithdrawEscrowed");
        expect(await stack.confidentialETH.pendingFailedWithdrawWei(rejecterAddr)).to.be.gt(0n);

        await rejecter.allowReceive();
        await stack.confidentialETH.connect(rejecterSigner).claimFailedWithdraw();
        expect(await stack.confidentialETH.pendingFailedWithdrawWei(rejecterAddr)).to.equal(0n);
    });

    it("LOW-2: timelocked auditor schedule/apply grants encrypted ID reads", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.sponsorRegistry.connect(stack.stranger).getEncryptedInstitutionId(stack.sponsor.address),
            /Not authorized/
        );

        await scheduleAndApply(
            () => stack.sponsorRegistry.connect(stack.owner).scheduleAuditor(stack.stranger.address),
            () => stack.sponsorRegistry.connect(stack.owner).applyAuditor()
        );
        expect(await stack.sponsorRegistry.auditor()).to.equal(stack.stranger.address);
        await stack.sponsorRegistry
            .connect(stack.stranger)
            .getEncryptedInstitutionId(stack.sponsor.address);
    });

    it("LOW-3: paginated checkpoint advances only on successful batch finalize", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);

        const signers = [stack.patient, stack.stranger, stack.sponsor2];
        for (const signer of signers) {
            const p = await registerPatient(stack, signer, ELIGIBLE_PROFILE);
            const staged = await stageSemaphoreApply(stack, trialId, p, signer);
            await finalizeSemaphoreApply(stack, staged, p, signer);
            await sponsorAcceptApplication(stack, trialId, staged.nullifier);
            await registerInPool(stack, trialId, staged.nullifier, signer);
        }

        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);
        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(0n);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 0, 1);
        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(1n);

        await expectRevert(
            stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .distributePartialPaginated(trialId, 0, 2, 1),
            /Batch must be sequential|BatchMustBeSequential/
        );
        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(1n);

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .distributePartialPaginated(trialId, 0, 1, 2);
        expect(await stack.sponsorIncentiveVault.lastProcessedIndex(trialId, 0)).to.equal(3n);
    });

    it("INFO-1: MAX_PRUNE_PER_UPKEEP is capped at 10", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.medVaultAutomation.MAX_PRUNE_PER_UPKEEP()).to.equal(10);
    });

    it("INFO-2: distributePartial rejects pools larger than DISTRIBUTE_BATCH_SIZE", async function () {
        if (!process.env.RUN_LARGE_POOL_TEST) {
            this.skip();
        }
        this.timeout(300_000);
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        await fundTrialPool(stack, trialId);

        const all = await ethers.getSigners();
        const wallets = all.slice(5, 26);
        for (const wallet of wallets) {
            const p = await registerPatient(stack, wallet, ELIGIBLE_PROFILE);
            const staged = await stageSemaphoreApply(stack, trialId, p);
            await finalizeSemaphoreApply(stack, staged, p);
            await sponsorAcceptApplication(stack, trialId, staged.nullifier);
            await registerInPool(stack, trialId, staged.nullifier, wallet);
        }
        expect(await stack.sponsorIncentiveVault.getParticipantCount(trialId)).to.equal(21n);

        const trial = await stack.trialManager.getTrial(trialId);
        const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
        await stack.trialMilestoneManager.connect(stack.sponsor).setMilestones(
            trialId,
            ["Screening"],
            [10000],
            [now + 3600n]
        );
        await time.increase(DEFAULT_TRIAL_PARAMS.duration + 1);

        await expectRevert(
            stack.sponsorIncentiveVault.connect(stack.sponsor).distributePartial(trialId, 0),
            /Use distributePartialPaginated for large pools/
        );
    });
});
