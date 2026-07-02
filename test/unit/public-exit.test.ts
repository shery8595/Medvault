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

describe("Unit: public exit (EIP-712 v2 + stealth recipient)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function stageWithdraw(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const { patient, confidentialETH } = stack;
        await confidentialETH.connect(patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const reqTx = await requestEncryptedWithdraw(confidentialETH, patient, 1);
        const reqRc = await reqTx.wait();
        if (!reqRc) throw new Error("Missing request receipt");
        const transferableHandle = parseEventArg(
            reqRc,
            confidentialETH.interface,
            "WithdrawRequested",
            "transferableHandle"
        );
        return { patient, confidentialETH, reqRc, transferableHandle };
    }

    async function transferableProof(transferableHandle: string) {
        return mockPublicDecryptProof(transferableHandle);
    }

    it("SUF-05 / PEX-01: relayer completes fast public exit to stealth recipient", async function () {
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

    it("SUF-05 / PEX-02: wrong stealth recipient reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, transferableHandle } = await stageWithdraw(stack);
        const signedRecipient = ethers.Wallet.createRandom().address;
        const actualRecipient = ethers.Wallet.createRandom().address;

        const transferable = await transferableProof(transferableHandle);
        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: signedRecipient,
            transferableHandle,
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
                    transferable.cleartexts,
                    transferable.proof
                ),
            /Invalid signature/
        );
    });

    it("SUF-05 / PEX-03: expired authorization reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, transferableHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const transferable = await transferableProof(transferableHandle);
        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt(await time.latest());
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            transferableHandle,
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
                    transferable.cleartexts,
                    transferable.proof
                ),
            /Authorization expired/
        );
    });

    it("SUF-05 / PEX-04: replay with consumed authorization reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, transferableHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const transferable = await transferableProof(transferableHandle);
        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            transferableHandle,
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
                transferable.cleartexts,
                transferable.proof
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
                    transferable.cleartexts,
                    transferable.proof
                ),
            /Invalid nonce|Nothing pending/
        );
    });

    it("SUF-05 / PEX-05: exit mode mismatch in signature reverts", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, transferableHandle } = await stageWithdraw(stack);
        const stealth = ethers.Wallet.createRandom().address;

        const transferable = await transferableProof(transferableHandle);
        const contractAddress = await confidentialETH.getAddress();
        const network = await ethers.provider.getNetwork();
        const nonce = await confidentialETH.withdrawNonces(patient.address);
        const deadline = BigInt((await time.latest()) + 3600);
        const signature = await signPublicExitAuthorization(patient, {
            contractAddress,
            chainId: network.chainId,
            owner: patient.address,
            stealthRecipient: stealth,
            transferableHandle,
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
                    transferable.cleartexts,
                    transferable.proof
                ),
            /Invalid signature/
        );
    });

    it("SUF-05 / PEX-06: reverting stealth recipient escrows to owner and preserves nonce", async function () {
        const stack = await deployMedVaultStack();
        const { patient, confidentialETH, reqRc } = await stageWithdraw(stack);

        const RejectOnce = await ethers.getContractFactory("RejectOnce");
        const rejecter = await RejectOnce.deploy();
        await rejecter.waitForDeployment();
        const rejecterAddr = await rejecter.getAddress();

        const nonceBefore = await confidentialETH.withdrawNonces(patient.address);

        const exitTx = await completePublicExit(
            confidentialETH,
            stack.stranger,
            patient,
            reqRc,
            rejecterAddr,
            0
        );
        await expect(exitTx).to.emit(confidentialETH, "InsolventWithdrawalAttempted");
        await expect(exitTx)
            .to.emit(confidentialETH, "FailedWithdrawEscrowed")
            .withArgs(patient.address, CET_MIN_DEPOSIT_WEI);

        expect(await confidentialETH.pendingFailedWithdrawWei(patient.address)).to.equal(
            CET_MIN_DEPOSIT_WEI
        );
        expect(await confidentialETH.pendingFailedWithdrawWei(rejecterAddr)).to.equal(0n);
        expect(await confidentialETH.withdrawNonces(patient.address)).to.equal(nonceBefore);

        await confidentialETH.connect(patient).claimFailedWithdraw();
        expect(await confidentialETH.pendingFailedWithdrawWei(patient.address)).to.equal(0n);
    });
});
