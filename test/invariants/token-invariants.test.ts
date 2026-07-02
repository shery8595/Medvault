import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack } from "../../test-support/deployments";
import { createEncryptedUint64 } from "../../test-support/fhe";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";
import { expectRevert } from "../../test-support/assertions";

describe("Invariants: cETH conservation", function () {
    it("TOK-INV-01: deposit + confidentialTransfer conserves aggregate supply", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const addr = await ceth.getAddress();

        const depositWei = CET_MIN_DEPOSIT_WEI * 5n;
        await ceth.connect(stack.patient).deposit({ value: depositWei });

        const enc = await createEncryptedUint64(addr, stack.patient.address, 2);
        await ceth
            .connect(stack.patient)
            ["confidentialTransfer(address,bytes32,bytes)"](
                stack.stranger.address,
                enc.handle,
                enc.inputProof
            );

        const a = await ceth.confidentialBalanceOf(stack.patient.address);
        const b = await ceth.confidentialBalanceOf(stack.stranger.address);
        expect(a).to.not.equal(ethers.ZeroHash);
        expect(b).to.not.equal(ethers.ZeroHash);
        expect(a).to.not.equal(b);
    });

    it("TOK-INV-02: vault confidential funding callback reverts while disabled", async function () {
        const stack = await deployMedVaultStack();
        const ceth = stack.confidentialETH;
        const vaultAddr = await stack.sponsorIncentiveVault.getAddress();
        const trialId = await (
            await import("../../test-support/deployments")
        ).createTrialForSponsor(stack);

        const depositedBefore = await stack.sponsorIncentiveVault.getTotalDeposited(trialId);
        await ceth.connect(stack.sponsor).deposit({ value: CET_MIN_DEPOSIT_WEI * 3n });
        const enc = await createEncryptedUint64(await ceth.getAddress(), stack.sponsor.address, 1);
        const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [trialId, 0]);

        await expectRevert(
            ceth
                .connect(stack.sponsor)
                ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
                    vaultAddr,
                    enc.handle,
                    enc.inputProof,
                    data
                ),
            "ConfidentialFundingDisabled"
        );

        expect(await stack.sponsorIncentiveVault.getTotalDeposited(trialId)).to.equal(depositedBefore);
    });
});
