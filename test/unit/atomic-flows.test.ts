import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { Contract } from "ethers";
import {
    assertFhevmMock,
    coerceFheHandle,
    createEncryptedBool,
    createEncryptedUint64,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { authorizeCethContract } from "../../test-support/timelock";
import { expectRevert } from "../../test-support/assertions";
import {
    registerPatient,
    stageSemaphoreApply,
    semaphoreProofFor,
    type StagedSemaphoreApply,
    type RegisteredPatient,
} from "../../test-support/journey";
import {
    defaultApplyDeadline,
    signAnonymousApplyPermit,
    signConsentWalletBinding,
    signConsentGrant,
} from "../../test-support/anonymousApply";
import { generateTestEligibilityProof } from "../../test-support/noirProof";
import { mockUserDecryptBool } from "../../test-support/fhe";

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

async function finalizeSemaphoreApplyWithConsent(
    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
    staged: StagedSemaphoreApply,
    patient: RegisteredPatient
) {
    const recipient = stack.patient.address;
    const eligible = await mockUserDecryptBool(
        staged.finalCt,
        await stack.eligibilityEngine.getAddress(),
        stack.patient
    );
    expect(eligible).to.equal(true);

    const { proofBytes, publicInputs } = await generateTestEligibilityProof({
        identity: patient.identity,
        commitment: patient.commitment,
        trialId: staged.trialId,
        profile: patient.profile,
        profileSalt: patient.profileSalt,
        eligible: true,
        fheStageHandle: staged.finalCt,
    });

    const proofFresh = semaphoreProofFor(
        staged.trialId,
        staged.nullifier,
        patient.commitment,
        recipient
    );

    const registryAddress = await stack.medVaultRegistry.getAddress();
    const deadline = await defaultApplyDeadline();
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

    const relayerAddr = await stack.relayer.getAddress();
    const encConsent = await createEncryptedBool(registryAddress, relayerAddr, true);
    const consentGrantSignature = await signConsentGrant(stack.patient, registryAddress, {
        consentHandle: encConsent.handle,
        trialId: staged.trialId,
        consentWallet,
        deadline,
    });

    return stack.medVaultRegistry
        .connect(stack.relayer)
        .finalizeAnonymousApplyWithConsent(
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
            consentGrantSignature,
            proofBytes,
            publicInputs
            );
}

describe("Unit: atomic flows (Plan 04)", function () {
    before(function () {
        assertFhevmMock();
    });

    it("ATOM-01: anonymous apply remains 2-tx canonical (no stageAndFinalizeAnonymousApply)", async function () {
        const stack = await deployMedVaultStack();
        const iface = stack.medVaultRegistry.interface;
        expect(iface.getFunction("stageAnonymousApply")).to.not.equal(undefined);
        expect(iface.getFunction("finalizeAnonymousApplyWithProof")).to.not.equal(undefined);
        expect(iface.getFunction("finalizeAnonymousApplyWithConsent")).to.not.equal(undefined);
        expect(iface.getFunction("stageAndFinalizeAnonymousApply")).to.be.null;
    });

    it("ATOM-02: finalizeAnonymousApplyWithConsent inlines consent (no prior grantConsent tx)", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack);
        const trialId = await createTrialForSponsor(stack);

        expect(
            await stack.consentManager
                .connect(stack.patient)
                .hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(false);

        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApplyWithConsent(stack, staged, patient);

        expect(
            await stack.consentManager
                .connect(stack.patient)
                .hasConsentRecord(stack.patient.address, trialId)
        ).to.equal(true);
        expect(await stack.medVaultRegistry.hasAppliedToTrial(trialId, staged.nullifier)).to.equal(true);
    });

    it("ATOM-03: fundTrialAndSetMilestones ETH path sets milestones and funds pool", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const fundWei = 2n * 10n ** 18n;

        await stack.sponsorIncentiveVault
            .connect(stack.sponsor)
            .fundTrialAndSetMilestones(
                trialId,
                ["Screening", "Treatment"],
                [5000, 5000],
                [trial.endTime - 100n, trial.endTime],
                { value: fundWei }
            );

        const milestones = await stack.trialMilestoneManager.getMilestones(trialId);
        expect(milestones.length).to.equal(2);
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(true);
        expect(await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId)).to.equal(
            fundWei
        );
    });

    it("ATOM-04: confidential fund+milestones disabled — callback reverts ConfidentialFundingDisabled", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const units = 5n;

        const depositedBefore = await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId);
        await stack.confidentialETH.connect(stack.sponsor).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        const data = await stack.sponsorIncentiveVault.encodeConfidentialFundAndMilestonesData(
            trialId,
            ["Screening", "Follow-up"],
            [6000, 4000],
            [trial.endTime - 200n, trial.endTime]
        );

        await expectRevert(
            confidentialTransferAndCall(stack.confidentialETH, stack.sponsor, vaultAddr, units, data),
            "ConfidentialFundingDisabled"
        );

        expect(await stack.sponsorIncentiveVault.connect(stack.sponsor).getTotalDeposited(trialId)).to.equal(
            depositedBefore
        );
        expect(await stack.sponsorIncentiveVault.isPoolFunded(trialId)).to.equal(false);
        const milestones = await stack.trialMilestoneManager.getMilestones(trialId);
        expect(milestones.length).to.equal(0);
    });

    it("ATOM-05: stakeAndLock atomic confidential stake + balance lock", async function () {
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
        const stakingAddr = await stakingManager.getAddress();
        await authorizeCethContract(stack.confidentialETH, stack.owner, stakingAddr, true);

        const units = 3n;
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        const lockData = await stakingManager.stakeAndLockCallbackData();
        await confidentialTransferAndCall(
            stack.confidentialETH,
            stack.patient,
            stakingAddr,
            units,
            lockData
        );

        const staked = await stakingManager.connect(stack.patient).getEncryptedTotalStaked(stack.patient.address);
        expect(coerceFheHandle(staked)).to.be.gt(0n);
        expect(await stack.confidentialETH.isBalanceLocked(stack.patient.address)).to.equal(true);
    });

    it("ATOM-06: stakeAndLock entrypoint via operator + confidentialTransferFromAndCall", async function () {
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
        const stakingAddr = await stakingManager.getAddress();
        await authorizeCethContract(stack.confidentialETH, stack.owner, stakingAddr, true);

        const until = BigInt((await time.latest()) + 86400);
        await stack.confidentialETH.connect(stack.patient).setOperator(stakingAddr, until);
        expect(await stack.confidentialETH.isOperator(stack.patient.address, stakingAddr)).to.equal(true);

        const units = 2n;
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI * units });
        const enc = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            stakingAddr,
            units
        );
        await stakingManager
            .connect(stack.patient)
            .stakeAndLock(enc.handle, enc.inputProof);

        expect(await stack.confidentialETH.isBalanceLocked(stack.patient.address)).to.equal(true);
    });
});
