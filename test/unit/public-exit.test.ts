import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMedVaultStack } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { assertFhevmMock, mockPublicDecryptProof, parseEventArg } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import {
    requestEncryptedWithdraw,
    completePublicExit,
    signPublicExitAuthorization,
} from "../../test-support/withdraw";

describe("Unit: public exit (EIP-712 + stealth recipient)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function stageWithdraw(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const { patient, confidentialETH } = stack;
        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const reqTx = await requestEncryptedWithdraw(confidentialETH, patient, 1);
        const reqRc = await reqTx.wait();
        if (!reqRc) throw new Error("Missing request receipt");
        const sufficientHandle = parseEventArg(
            reqRc,
            confidentialETH.interface,
            "WithdrawRequested",
            "sufficientHandle"
        );
        return { patient, confidentialETH, reqRc, sufficientHandle };
    }

    it("PEX-01: relayer completes fast public exit to stealth recipient", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;
        const before = await ethers.provider.getBalance(stealth);

        const exitTx = await completePublicExit(
            confidentialETH,
            stack.stranger,
            patient,
            reqRc,
            stealth,
            0
        );
        await expect(exitTx).to.emit(confidentialETH, "PublicExitCompleted");

        const after = await ethers.provider.getBalance(stealth);
        expect(after - before).to.equal(CET_MIN_DEPOSIT_WEI);
    });

    it("PEX-02: wrong stealth recipient reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc, sufficientHandle } = await stageWithdraw(stack);
        const signedRecipient = ethers.Wallet.createRandom().address;
        const actualRecipient = ethers.Wallet.createRandom().address;

        const sufficient = await mockPublicDecryptProof(sufficientHandle);
        const revealTx = await confidentialETH
            .connect(patient)
            .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
        const revealRc = await revealTx.wait();
        const amountHandle = parseEventArg(
            revealRc!,
            confidentialETH.interface,
            "WithdrawAmountRevealed",
            "amountHandle"
        );
        const amount = await mockPublicDecryptProof(amountHandle);

        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: signedRecipient,
            sufficientHandle,
            exitMode: 0,
            nonce,
            deadline,
        });

        await expectRevert(
            confidentialETH
                .connect(stack.stranger)
                .completePublicExit(
                    patient.address,
                    actualRecipient,
                    0,
                    nonce,
                    deadline,
                    signature,
                    sufficient.cleartexts,
                    sufficient.proof,
                    amount.cleartexts,
                    amount.proof
                ),
            /Invalid signature/
        );
    });

    it("PEX-03: expired authorization reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc, sufficientHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const sufficient = await mockPublicDecryptProof(sufficientHandle);
        const revealTx = await confidentialETH
            .connect(patient)
            .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
        const revealRc = await revealTx.wait();
        const amountHandle = parseEventArg(
            revealRc!,
            confidentialETH.interface,
            "WithdrawAmountRevealed",
            "amountHandle"
        );
        const amount = await mockPublicDecryptProof(amountHandle);

        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt(await time.latest());
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            sufficientHandle,
            exitMode: 0,
            nonce,
            deadline,
        });

        await time.increase(1);
        await expectRevert(
            confidentialETH
                .connect(stack.stranger)
                .completePublicExit(
                    patient.address,
                    stealth,
                    0,
                    nonce,
                    deadline,
                    signature,
                    sufficient.cleartexts,
                    sufficient.proof,
                    amount.cleartexts,
                    amount.proof
                ),
            /Authorization expired/
        );
    });

    it("PEX-04: replay with consumed authorization reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc, sufficientHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const sufficient = await mockPublicDecryptProof(sufficientHandle);
        const revealTx = await confidentialETH
            .connect(patient)
            .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
        const revealRc = await revealTx.wait();
        const amountHandle = parseEventArg(
            revealRc!,
            confidentialETH.interface,
            "WithdrawAmountRevealed",
            "amountHandle"
        );
        const amount = await mockPublicDecryptProof(amountHandle);

        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            sufficientHandle,
            exitMode: 0,
            nonce,
            deadline,
        });

        await confidentialETH
            .connect(stack.stranger)
            .completePublicExit(
                patient.address,
                stealth,
                0,
                nonce,
                deadline,
                signature,
                sufficient.cleartexts,
                sufficient.proof,
                amount.cleartexts,
                amount.proof
            );

        await expectRevert(
            confidentialETH
                .connect(stack.stranger)
                .completePublicExit(
                    patient.address,
                    stealth,
                    0,
                    nonce,
                    deadline,
                    signature,
                    sufficient.cleartexts,
                    sufficient.proof,
                    amount.cleartexts,
                    amount.proof
                ),
            /Invalid nonce|Nothing pending/
        );
    });

    it("PEX-05: exit mode mismatch in signature reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc, sufficientHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const sufficient = await mockPublicDecryptProof(sufficientHandle);
        const revealTx = await confidentialETH
            .connect(patient)
            .revealWithdrawAmount(sufficient.cleartexts, sufficient.proof);
        const revealRc = await revealTx.wait();
        const amountHandle = parseEventArg(
            revealRc!,
            confidentialETH.interface,
            "WithdrawAmountRevealed",
            "amountHandle"
        );
        const amount = await mockPublicDecryptProof(amountHandle);

        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            sufficientHandle,
            exitMode: 0,
            nonce,
            deadline,
        });

        await expectRevert(
            confidentialETH
                .connect(stack.stranger)
                .completePublicExit(
                    patient.address,
                    stealth,
                    1,
                    nonce,
                    deadline,
                    signature,
                    sufficient.cleartexts,
                    sufficient.proof,
                    amount.cleartexts,
                    amount.proof
                ),
            /Invalid signature/
        );
    });
});
