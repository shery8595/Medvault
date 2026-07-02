import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { DEFAULT_TRIAL_PARAMS } from "../../test-support/constants";
import {
    registerPatient,
    stageSemaphoreApply,
    finalizeSemaphoreApply,
    sponsorAcceptApplication,
    fundTrialPool,
    endTrialAndDistribute,
} from "../../test-support/journey";
import {
    deriveEphemeralAddress,
    deriveEphemeralWallet,
    signClaimAuthorizationForTest,
    signRegisterAuthorizationForTest,
} from "../../test-support/vaultEip712";
import { createEncryptedUint64, mockUserDecryptUint64 } from "../../test-support/fhe";
import { confirmStagedReceipt } from "../../test-support/claimReceipt";
import { buildWithdrawToAuthorization, computeEncryptedAmountCommitment } from "../../test-support/withdraw";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function gaslessClaimFor(
    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
    patient: Awaited<ReturnType<typeof registerPatient>>,
    ephemeral: string,
    trialId: bigint,
    nullifier: bigint,
    destination: string,
    units: bigint,
    claimNonce: bigint,
    claimDeadline: bigint
) {
    const vaultAddress = await stack.sponsorIncentiveVault.getAddress();
    const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
    const enc = await createEncryptedUint64(
        await stack.confidentialETH.getAddress(),
        vaultAddress,
        Number(units)
    );
    const amountCommitment = computeEncryptedAmountCommitment(enc.handle, enc.inputProof);
    const claimSig = await signClaimAuthorizationForTest(patient.identity, vaultAddress, chainId, {
        trialId,
        nullifier,
        permitHolder: ephemeral,
        destination,
        units,
        encryptedAmountCommitment: amountCommitment,
        nonce: claimNonce,
        deadline: claimDeadline,
    });
    const ephemeralWallet = deriveEphemeralWallet(patient.identity).connect(ethers.provider);
    const withdrawTo = await buildWithdrawToAuthorization(
        stack.confidentialETH,
        ephemeralWallet,
        destination,
        enc
    );
    return stack.sponsorIncentiveVault
        .connect(stack.patient)
        .claimParticipantRewardsFor(
            trialId,
            nullifier,
            ephemeral,
            destination,
            units,
            amountCommitment,
            enc.handle,
            enc.inputProof,
            claimNonce,
            claimDeadline,
            claimSig,
            withdrawTo.nonce,
            withdrawTo.deadline,
            withdrawTo.signature
        );
}

describe("Unit: gasless ephemeral claim and register", function () {
    async function setupEphemeralApplicant() {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const ephemeral = await deriveEphemeralAddress(patient.identity);
        const trialId = await createTrialForSponsor(stack);
        const staged = await stageSemaphoreApply(
            stack,
            trialId,
            patient,
            stack.patient,
            ephemeral,
            patient.identity
        );
        await finalizeSemaphoreApply(
            stack,
            staged,
            patient,
            stack.patient,
            ephemeral,
            patient.identity
        );
        await sponsorAcceptApplication(stack, trialId, staged.nullifier);
        return { stack, patient, ephemeral, trialId, nullifier: staged.nullifier };
    }

    it("GASLESS-01: register and claim to main wallet via EIP-712 authorization", async function () {
        const { stack, patient, ephemeral, trialId, nullifier } = await setupEphemeralApplicant();
        await fundTrialPool(stack, trialId);

        const vaultAddress = await stack.sponsorIncentiveVault.getAddress();
        const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
        const regDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        const regSig = await signRegisterAuthorizationForTest(patient.identity, vaultAddress, chainId, {
            trialId,
            nullifier,
            permitHolder: ephemeral,
            nonce: 1n,
            deadline: regDeadline,
        });
        await stack.sponsorIncentiveVault
            .connect(stack.stranger)
            .registerAnonymousParticipantFor(trialId, nullifier, ephemeral, 1n, regDeadline, regSig);

        await endTrialAndDistribute(stack, trialId);

        const ephemeralWallet = deriveEphemeralWallet(patient.identity).connect(ethers.provider);
        const ephemeralSigner = await impersonateAccount(ephemeral);
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, ephemeralSigner);

        const balanceHandle = await stack.confidentialETH
            .connect(ephemeralWallet)
            .getBalance(ephemeral);
        const units = await mockUserDecryptUint64(
            balanceHandle,
            await stack.confidentialETH.getAddress(),
            ephemeralWallet
        );
        expect(units).to.be.gt(0n);

        const claimDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        const destination = stack.patient.address;
        await gaslessClaimFor(
            stack,
            patient,
            ephemeral,
            trialId,
            nullifier,
            destination,
            units,
            2n,
            claimDeadline
        );

        const pendingHandle = await stack.confidentialETH.pendingWithdrawToHandle(ephemeral);
        expect(pendingHandle).to.not.equal(ethers.ZeroHash);
    });

    it("GASLESS-02: replayed claim authorization reverts", async function () {
        const { stack, patient, ephemeral, trialId, nullifier } = await setupEphemeralApplicant();
        await fundTrialPool(stack, trialId);

        const vaultAddress = await stack.sponsorIncentiveVault.getAddress();
        const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
        const regDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        const regSig = await signRegisterAuthorizationForTest(patient.identity, vaultAddress, chainId, {
            trialId,
            nullifier,
            permitHolder: ephemeral,
            nonce: 11n,
            deadline: regDeadline,
        });
        await stack.sponsorIncentiveVault
            .connect(stack.stranger)
            .registerAnonymousParticipantFor(trialId, nullifier, ephemeral, 11n, regDeadline, regSig);
        await endTrialAndDistribute(stack, trialId);

        const ephemeralWallet = deriveEphemeralWallet(patient.identity).connect(ethers.provider);
        const ephemeralSigner = await impersonateAccount(ephemeral);
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, ephemeralSigner);

        const balanceHandle = await stack.confidentialETH
            .connect(ephemeralWallet)
            .getBalance(ephemeral);
        const units = await mockUserDecryptUint64(
            balanceHandle,
            await stack.confidentialETH.getAddress(),
            ephemeralWallet
        );
        const claimDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        await gaslessClaimFor(
            stack,
            patient,
            ephemeral,
            trialId,
            nullifier,
            stack.patient.address,
            units,
            22n,
            claimDeadline
        );

        await expectRevert(
            gaslessClaimFor(
                stack,
                patient,
                ephemeral,
                trialId,
                nullifier,
                stack.patient.address,
                units,
                22n,
                claimDeadline
            ),
            "Auth already used"
        );
    });

    it("GASLESS-03: expired claim authorization reverts", async function () {
        const { stack, patient, ephemeral, trialId, nullifier } = await setupEphemeralApplicant();
        await fundTrialPool(stack, trialId);

        const vaultAddress = await stack.sponsorIncentiveVault.getAddress();
        const chainId = BigInt((await ethers.provider.getNetwork()).chainId);
        const regDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        const regSig = await signRegisterAuthorizationForTest(patient.identity, vaultAddress, chainId, {
            trialId,
            nullifier,
            permitHolder: ephemeral,
            nonce: 31n,
            deadline: regDeadline,
        });
        await stack.sponsorIncentiveVault
            .connect(stack.stranger)
            .registerAnonymousParticipantFor(trialId, nullifier, ephemeral, 31n, regDeadline, regSig);
        await endTrialAndDistribute(stack, trialId);

        const ephemeralWallet = deriveEphemeralWallet(patient.identity).connect(ethers.provider);
        const ephemeralSigner = await impersonateAccount(ephemeral);
        await confirmStagedReceipt(stack.sponsorIncentiveVault, trialId, 0n, ephemeralSigner);

        const balanceHandle = await stack.confidentialETH
            .connect(ephemeralWallet)
            .getBalance(ephemeral);
        const units = await mockUserDecryptUint64(
            balanceHandle,
            await stack.confidentialETH.getAddress(),
            ephemeralWallet
        );
        const claimDeadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 60);
        await time.increase(120);

        await expectRevert(
            gaslessClaimFor(
                stack,
                patient,
                ephemeral,
                trialId,
                nullifier,
                stack.patient.address,
                units,
                32n,
                claimDeadline
            ),
            "Signature expired"
        );
    });
});
