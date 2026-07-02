import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMedVaultStack } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";
import { authorizeCethContract } from "../../test-support/timelock";
import { computeEncryptedAmountCommitment } from "../../test-support/withdraw";
import { impersonateAccount } from "../../test-support/signers";
import {
    requestEncryptedWithdraw,
    completeEncryptedWithdraw,
} from "../../test-support/withdraw";
import { coerceFheHandle, createEncryptedUint64, mockUserDecryptUint64 } from "../../test-support/fhe";
import { transferEncryptedWithProof } from "../../test-support/transfer";

describe("Unit: ConfidentialETH", function () {
    it("CET-01: deposit increases balance handle", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        expect(coerceFheHandle(bal)).to.be.gt(0n);
    });

    it("CET-02: zero deposit reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.confidentialETH.connect(stack.patient).deposit({ value: 0 }),
            /Amount must be > 0|reverted/
        );
    });

    it("CET-03: unauthorized depositFor reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.confidentialETH
                .connect(stack.stranger)
                .depositFor(stack.patient.address, { value: CET_MIN_DEPOSIT_WEI }),
            /Not authorized|reverted/
        );
    });

    it("CET-04: authorized depositFor succeeds", async function () {
        const stack = await deployMedVaultStack();
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        await stack.confidentialETH
            .connect(vaultSigner)
            .depositFor(stack.patient.address, { value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        expect(coerceFheHandle(bal)).to.be.gt(0n);
    });

    it("CET-05: authorize and deauthorize contract via timelock", async function () {
        const stack = await deployMedVaultStack();
        await authorizeCethContract(
            stack.confidentialETH,
            stack.owner,
            await stack.sponsorIncentiveVault.getAddress(),
            false
        );
        expect(
            await stack.confidentialETH.authorizedContracts(
                await stack.sponsorIncentiveVault.getAddress()
            )
        ).to.equal(false);
        await authorizeCethContract(
            stack.confidentialETH,
            stack.owner,
            await stack.sponsorIncentiveVault.getAddress(),
            true
        );
        expect(
            await stack.confidentialETH.authorizedContracts(
                await stack.sponsorIncentiveVault.getAddress()
            )
        ).to.equal(true);
    });

    it("CET-06: requestWithdraw without complete leaves pending", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        await requestEncryptedWithdraw(stack.confidentialETH, stack.patient, 1);
        await expectRevert(
            requestEncryptedWithdraw(stack.confidentialETH, stack.patient, 1),
            /Withdrawal already pending/
        );
    });

    it("CET-07: transferEncrypted between authorized contracts", async function () {
        const stack = await deployMedVaultStack();
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        // transferEncrypted requires from == msg.sender; deposit to the vault and transfer its own balance.
        await stack.confidentialETH
            .connect(vaultSigner)
            .depositFor(vaultAddr, { value: CET_MIN_DEPOSIT_WEI * 2n });
        await stack.confidentialETH.connect(vaultSigner).lockBalance(vaultAddr);
        const bal = await stack.confidentialETH.connect(vaultSigner).getBalance(vaultAddr);
        await transferEncryptedWithProof(
            stack.confidentialETH,
            vaultSigner,
            vaultAddr,
            stack.sponsor.address,
            bal
        );
        await stack.confidentialETH.connect(vaultSigner).unlockBalance(vaultAddr);
        const sponsorBal = await stack.confidentialETH
            .connect(stack.sponsor)
            .getBalance(stack.sponsor.address);
        expect(coerceFheHandle(sponsorBal)).to.be.gt(0n);
    });

    it("CET-08: requestWithdrawTo only authorized", async function () {
        const stack = await deployMedVaultStack();
        const encrypted = await createEncryptedUint64(
            await stack.confidentialETH.getAddress(),
            stack.stranger.address,
            1
        );
        const amountCommitment = computeEncryptedAmountCommitment(encrypted.handle, encrypted.inputProof);
        await expectRevert(
            stack.confidentialETH
                .connect(stack.stranger)
                .requestWithdrawTo(
                    stack.patient.address,
                    stack.stranger.address,
                    encrypted.handle,
                    encrypted.inputProof,
                    0n,
                    BigInt((await time.latest()) + 3600),
                    "0x" + "00".repeat(65)
                ),
            /Not authorized/
        );
    });

    it("CET-09: CANCEL_TIMEOUT_FUNDS is one hour", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.confidentialETH.CANCEL_TIMEOUT_FUNDS()).to.equal(3600n);
    });

    it("CET-10: getBalance returns handle", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        expect(coerceFheHandle(bal)).to.be.gt(0n);
    });

    it("CET-11: min deposit below UNIT_SCALE reverts", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.confidentialETH.connect(stack.patient).deposit({ value: 1n }),
            /Min deposit|reverted/
        );
    });

    it("CET-12: UNIT_SCALE constant", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.confidentialETH.UNIT_SCALE()).to.equal(CET_MIN_DEPOSIT_WEI);
    });

    it("CET-13: implements IERC7984 metadata and balanceOf", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.confidentialETH.name()).to.equal("Confidential ETH");
        expect(await stack.confidentialETH.symbol()).to.equal("cETH");
        expect(await stack.confidentialETH.decimals()).to.equal(6);
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const stdBal = await stack.confidentialETH.confidentialBalanceOf(stack.patient.address);
        const legacyBal = await stack.confidentialETH
            .connect(stack.patient)
            .getBalance(stack.patient.address);
        expect(coerceFheHandle(stdBal)).to.equal(coerceFheHandle(legacyBal));
        expect(coerceFheHandle(stdBal)).to.be.gt(0n);
    });

    it("CET-15: unauthorized getBalance reverts", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        await expectRevert(
            stack.confidentialETH.connect(stack.stranger).getBalance(stack.patient.address),
            /Not authorized/
        );
    });

    it("CET-16: authorized contract getBalance succeeds", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const vaultSigner = await impersonateAccount(await stack.sponsorIncentiveVault.getAddress());
        const bal = await stack.confidentialETH
            .connect(vaultSigner)
            .getBalance(stack.patient.address);
        expect(coerceFheHandle(bal)).to.be.gt(0n);
    });

    it("CET-14: ERC7984 IERC165 and operator model", async function () {
        const stack = await deployMedVaultStack();
        const ceth = await ethers.getContractAt(
            "ConfidentialETH7984",
            await stack.confidentialETH.getAddress()
        );
        expect(await ceth.supportsInterface("0x01ffc9a7")).to.equal(true);
        expect(await ceth.isOperator(stack.owner.address, stack.owner.address)).to.equal(true);
        const until = BigInt((await time.latest()) + 86400);
        await expect(ceth.connect(stack.patient).setOperator(stack.sponsor.address, until)).to.not.be
            .reverted;
        expect(await ceth.isOperator(stack.patient.address, stack.sponsor.address)).to.equal(true);
    });

    it("CET-17: pending withdraw blocks confidentialTransfer", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();

        await ceth.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await requestEncryptedWithdraw(ceth, stack.patient, 1);

        const enc = await createEncryptedUint64(addr, stack.patient.address, 1);
        await expectRevert(
            ceth
                .connect(stack.patient)
                ["confidentialTransfer(address,bytes32,bytes)"](
                    stack.stranger.address,
                    enc.handle,
                    enc.inputProof
                ),
            /Pending withdraw blocks transfer/
        );
    });

    it("CET-18: pending withdraw blocks confidentialTransferFrom via operator", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();
        const until = BigInt((await time.latest()) + 86400);

        await ceth.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await ceth.connect(stack.patient).setOperator(stack.sponsor.address, until);
        await requestEncryptedWithdraw(ceth, stack.patient, 1);

        const enc = await createEncryptedUint64(addr, stack.sponsor.address, 1);
        await expectRevert(
            ceth
                .connect(stack.sponsor)
                ["confidentialTransferFrom(address,address,bytes32,bytes)"](
                    stack.patient.address,
                    stack.stranger.address,
                    enc.handle,
                    enc.inputProof
                ),
            /Pending withdraw blocks transfer/
        );
    });

    it("CET-19: pending withdraw blocks setOperator", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const until = BigInt((await time.latest()) + 86400);

        await ceth.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        await requestEncryptedWithdraw(ceth, stack.patient, 1);

        await expectRevert(
            ceth.connect(stack.patient).setOperator(stack.sponsor.address, until),
            /Pending withdraw blocks operator set/
        );
    });

    it("CET-20: post-cancel confidentialTransfer succeeds", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();
        const timeout = await ceth.CANCEL_TIMEOUT_FUNDS();

        await ceth.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI * 2n });
        await requestEncryptedWithdraw(ceth, stack.patient, 1);
        await time.increase(timeout + 1n);
        await ceth.connect(stack.patient).cancelPendingWithdraw();

        const enc = await createEncryptedUint64(addr, stack.patient.address, 1);
        await expect(
            ceth
                .connect(stack.patient)
                ["confidentialTransfer(address,bytes32,bytes)"](
                    stack.stranger.address,
                    enc.handle,
                    enc.inputProof
                )
        ).to.not.be.reverted;
    });

    it("CET-21: completeWithdraw burns units and contract stays solvent", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();
        const depositWei = CET_MIN_DEPOSIT_WEI * 2n;
        const withdrawUnits = 1n;
        const unitScale = await ceth.UNIT_SCALE();

        await ceth.connect(stack.patient).deposit({ value: depositWei });
        const balBefore = await mockUserDecryptUint64(
            await ceth.confidentialBalanceOf(stack.patient.address),
            addr,
            stack.patient
        );
        const contractBalBefore = await ethers.provider.getBalance(addr);

        const reqTx = await requestEncryptedWithdraw(ceth, stack.patient, withdrawUnits);
        const reqRc = await reqTx.wait();
        if (!reqRc) throw new Error("withdraw request receipt missing");

        const completeTx = await completeEncryptedWithdraw(ceth, stack.patient, reqRc);
        await expect(completeTx).to.emit(ceth, "Withdrawal");

        const balAfter = await mockUserDecryptUint64(
            await ceth.confidentialBalanceOf(stack.patient.address),
            addr,
            stack.patient
        );
        const contractBalAfter = await ethers.provider.getBalance(addr);

        expect(balAfter).to.equal(balBefore - withdrawUnits);
        expect(contractBalAfter).to.equal(contractBalBefore - withdrawUnits * unitScale);
        expect(contractBalAfter).to.be.gte(0n);
    });

    it("CET-22: audit PoC transfer-then-complete blocked while pending", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();
        const depositWei = CET_MIN_DEPOSIT_WEI;

        await ceth.connect(stack.patient).deposit({ value: depositWei });
        const contractBalBefore = await ethers.provider.getBalance(addr);

        const reqTx = await requestEncryptedWithdraw(ceth, stack.patient, 1);
        const reqRc = await reqTx.wait();
        if (!reqRc) throw new Error("withdraw request receipt missing");

        const enc = await createEncryptedUint64(addr, stack.patient.address, 1);
        await expectRevert(
            ceth
                .connect(stack.patient)
                ["confidentialTransfer(address,bytes32,bytes)"](
                    stack.stranger.address,
                    enc.handle,
                    enc.inputProof
                ),
            /Pending withdraw blocks transfer/
        );

        const completeTx = await completeEncryptedWithdraw(ceth, stack.patient, reqRc);
        await expect(completeTx).to.emit(ceth, "Withdrawal");

        const contractBalAfter = await ethers.provider.getBalance(addr);
        expect(contractBalAfter).to.equal(contractBalBefore - CET_MIN_DEPOSIT_WEI);
    });
});
