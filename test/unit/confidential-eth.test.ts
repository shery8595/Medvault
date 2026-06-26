import { expect } from "chai";
import { deployMedVaultStack } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";
import { impersonateAccount } from "../../test-support/signers";
import { requestEncryptedWithdraw } from "../../test-support/withdraw";
import { coerceFheHandle, createEncryptedUint64 } from "../../test-support/fhe";
import { transferEncryptedWithProof } from "../../test-support/transfer";

describe("Unit: ConfidentialETH", function () {
    it("CET-01: deposit increases balance handle", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH.getBalance(stack.patient.address);
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
        const bal = await stack.confidentialETH.getBalance(stack.patient.address);
        expect(coerceFheHandle(bal)).to.be.gt(0n);
    });

    it("CET-05: authorize and deauthorize contract", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH
            .connect(stack.owner)
            .deauthorizeContract(await stack.sponsorIncentiveVault.getAddress());
        expect(
            await stack.confidentialETH.authorizedContracts(
                await stack.sponsorIncentiveVault.getAddress()
            )
        ).to.equal(false);
        await stack.confidentialETH
            .connect(stack.owner)
            .authorizeContract(await stack.sponsorIncentiveVault.getAddress());
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
        await stack.confidentialETH
            .connect(vaultSigner)
            .depositFor(stack.patient.address, { value: CET_MIN_DEPOSIT_WEI * 2n });
        const bal = await stack.confidentialETH.getBalance(stack.patient.address);
        await transferEncryptedWithProof(
            stack.confidentialETH,
            vaultSigner,
            stack.patient.address,
            stack.sponsor.address,
            bal
        );
        const sponsorBal = await stack.confidentialETH.getBalance(stack.sponsor.address);
        expect(coerceFheHandle(sponsorBal)).to.be.gt(0n);
    });

    it("CET-08: requestWithdrawTo only authorized", async function () {
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

    it("CET-09: CANCEL_TIMEOUT_FUNDS is one hour", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.confidentialETH.CANCEL_TIMEOUT_FUNDS()).to.equal(3600n);
    });

    it("CET-10: getBalance returns handle", async function () {
        const stack = await deployMedVaultStack();
        await stack.confidentialETH.connect(stack.patient).deposit({ value: CET_MIN_DEPOSIT_WEI });
        const bal = await stack.confidentialETH.getBalance(stack.patient.address);
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
});
