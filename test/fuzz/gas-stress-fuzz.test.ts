import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor, mintClearCeth } from "../../test-support/deployments";
import { CET_MIN_DEPOSIT_WEI } from "../../test-support/constants";

const RUNS = Number((hre.config as { fuzz?: { runs?: number } }).fuzz?.runs ?? 256);

describe("Fuzz: gas-stress confidential flows", function () {
    this.timeout(600_000);

    for (let i = 0; i < RUNS; i++) {
        it(`GAS-FUZZ-${i}: deposit + mintClear + transfer cycle`, async function () {
            const stack = await deployMedVaultStack();
            const ceth = stack.confidentialETH;
            const addr = await ceth.getAddress();
            const depositWei = CET_MIN_DEPOSIT_WEI * BigInt(1 + (i % 5));
            const tx1 = await ceth.connect(stack.patient).deposit({ value: depositWei });
            const r1 = await tx1.wait();

            const mintUnits = 1n + BigInt(i % 10);
            const tx2 = await ceth.mintClear(stack.patient.address, mintUnits);
            const r2 = await tx2.wait();

            const enc = await (
                await import("../../test-support/fhe")
            ).createEncryptedUint64(addr, stack.patient.address, 1);
            const tx3 = await ceth
                .connect(stack.patient)
                ["confidentialTransfer(address,bytes32,bytes)"](
                    stack.stranger.address,
                    enc.handle,
                    enc.inputProof
                );
            const r3 = await tx3.wait();

            expect(r1!.gasUsed).to.be.gt(0n);
            expect(r2!.gasUsed).to.be.gt(0n);
            expect(r3!.gasUsed).to.be.gt(0n);

            const strangerBal = await ceth.confidentialBalanceOf(stack.stranger.address);
            expect(strangerBal).to.not.equal(ethers.ZeroHash);
        });
    }

    for (let i = 0; i < Math.min(RUNS, 32); i++) {
        it(`GAS-FUZZ-VAULT-${i}: sponsor vault fundTrial gas bounded`, async function () {
            const stack = await deployMedVaultStack();
            await mintClearCeth(stack, stack.sponsor.address, 5n);
            const trialId = await createTrialForSponsor(stack);
            const fundWei = CET_MIN_DEPOSIT_WEI * BigInt(2 + (i % 8));
            const tx = await stack.sponsorIncentiveVault
                .connect(stack.sponsor)
                .fundTrial(trialId, { value: fundWei });
            const rec = await tx.wait();
            expect(rec!.gasUsed).to.be.lt(800_000n);
        });
    }
});
