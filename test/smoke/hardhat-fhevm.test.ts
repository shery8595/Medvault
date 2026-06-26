import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { deployMedVaultStack } from "../../test-support/deployments";

describe("Smoke: Hardhat + Zama fhEVM", function () {
    it("SMOKE-01: signers available", async function () {
        const signers = await ethers.getSigners();
        expect(signers.length).to.be.greaterThan(0);
    });

    it("SMOKE-02: @fhevm/hardhat-plugin initialized", async function () {
        expect(hre.fhevm).to.not.be.undefined;
        expect(hre.fhevm.isMock).to.equal(true);
        expect(hre.fhevm.createEncryptedInput).to.be.a("function");
        expect(hre.fhevm.publicDecrypt).to.be.a("function");
    });

    it("SMOKE-03: deployMedVaultStack completes", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.trialManager.getAddress()).to.be.properAddress;
        expect(await stack.medVaultRegistry.getAddress()).to.be.properAddress;
    });

    it("SMOKE-04: TrialManager view callable", async function () {
        const stack = await deployMedVaultStack();
        const counter = await stack.trialManager.trialCounter();
        expect(counter).to.equal(1n);
    });
});
