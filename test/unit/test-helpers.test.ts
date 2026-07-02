import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, mintClearCeth, seedPatientClear } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { computeProfileCommitment, defaultProfileSalt } from "../../test-support/profileCommitment";
import { impersonateAccount } from "../../test-support/signers";
import { expectRevert } from "../../test-support/assertions";
import { Identity } from "@semaphore-protocol/identity";
import { scheduleAndApply } from "../../test-support/timelock";
import { mockUserDecryptUint64 } from "../../test-support/fhe";
import { execSync } from "node:child_process";
import path from "node:path";

describe("Unit: Cleartext test helpers (Hardhat-gated)", function () {
    it("HCU-01: mintClear credits confidential balance on Hardhat", async function () {
        const stack = await deployMedVaultStack();
        await mintClearCeth(stack, stack.patient.address, 42n);
        const handle = await stack.confidentialETH.confidentialBalanceOf(stack.patient.address);
        const units = await mockUserDecryptUint64(
            handle,
            await stack.confidentialETH.getAddress(),
            stack.patient.address
        );
        expect(units).to.equal(42n);
    });

    it("HCU-02: registerPatientClear stores Poseidon-matching profile commitment", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await seedPatientClear(stack, id.commitment, stack.patient.address, ELIGIBLE_PROFILE);
        const expected = computeProfileCommitment(
            id.commitment,
            ELIGIBLE_PROFILE,
            await defaultProfileSalt(id.commitment)
        );
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        const onChain = await stack.anonymousPatientRegistry
            .connect(engineSigner)
            .getProfileCommitment(id.commitment);
        expect(onChain).to.equal(`0x${expected.toString(16).padStart(64, "0")}`);
        expect(await stack.anonymousPatientRegistry.checkRegistration(id.commitment)).to.equal(true);
    });

    it("HCU-03: mintClear reverts when testHelpersEnabled is false", async function () {
        const stack = await deployMedVaultStack();
        await scheduleAndApply(
            () => stack.confidentialETH.connect(stack.owner).scheduleTestHelpersEnabled(false),
            () => stack.confidentialETH.connect(stack.owner).applyTestHelpersEnabled()
        );
        await expectRevert(
            stack.confidentialETH.mintClear(stack.patient.address, 1),
            "TestHelpersDisabled"
        );
    });

    it("HCU-04: registerPatientClear reverts when testHelpersEnabled is false", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await scheduleAndApply(
            () => stack.anonymousPatientRegistry.connect(stack.owner).scheduleTestHelpersEnabled(false),
            () => stack.anonymousPatientRegistry.connect(stack.owner).applyTestHelpersEnabled()
        );
        await expectRevert(
            stack.anonymousPatientRegistry.registerPatientClear(
                id.commitment,
                stack.patient.address,
                ELIGIBLE_PROFILE.age,
                ELIGIBLE_PROFILE.gender,
                ELIGIBLE_PROFILE.weight,
                ELIGIBLE_PROFILE.height,
                ELIGIBLE_PROFILE.hasDiabetes,
                ELIGIBLE_PROFILE.hbLevel,
                ELIGIBLE_PROFILE.isSmoker,
                ELIGIBLE_PROFILE.hasHypertension
            ),
            "TestHelpersDisabled"
        );
    });

    it("HCU-05: onlyTestHelpers enforces block.chainid == 31337 in source", async function () {
        const fs = await import("node:fs");
        const gate = fs.readFileSync("contracts/test/TestHelpers.sol", "utf8");
        const ceth = fs.readFileSync("contracts/ConfidentialETH7984.sol", "utf8");
        const apr = fs.readFileSync("contracts/AnonymousPatientRegistry.sol", "utf8");
        expect(gate).to.include("block.chainid != HARDHAT_CHAIN_ID");
        expect(ceth).to.include("onlyTestHelpers");
        expect(apr).to.include("onlyTestHelpers");
        expect(gate).to.include("31337");
    });

    it("HCU-06: verify-production-deploy.mjs fails when deploy script enables test helpers", async function () {
        const root = path.resolve(__dirname, "../..");
        const script = path.join(root, "scripts", "verify-production-deploy.mjs");
        const probe = "scheduleTestHelpersEnabled(true)";
        const deployPath = path.join(root, "scripts", "deploy.ts");
        const original = await import("node:fs").then((fs) => fs.readFileSync(deployPath, "utf8"));
        const injected = original + `\n// probe\nvoid ${JSON.stringify(probe)};\n`;
        const fs = await import("node:fs");
        fs.writeFileSync(deployPath, injected);
        try {
            let failed = false;
            try {
                execSync(`node "${script}"`, { cwd: root, stdio: "pipe" });
            } catch {
                failed = true;
            }
            expect(failed).to.equal(true);
        } finally {
            fs.writeFileSync(deployPath, original);
        }
    });
});
