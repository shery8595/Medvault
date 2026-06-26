import { expect } from "chai";
import { ethers } from "hardhat";
import { impersonateAccount } from "../../test-support/signers";
import { Identity } from "@semaphore-protocol/identity";
import { deployMedVaultStack, registerPatientOnRegistry } from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { expectRevert } from "../../test-support/assertions";

describe("Unit: AnonymousPatientRegistry", function () {
    it("APR-01: registry registers patient", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        const commitment = id.commitment;
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.anonymousPatientRegistry.checkRegistration(commitment)).to.equal(true);
    });

    it("APR-02: unauthorized registry reverts", async function () {
        const stack = await deployMedVaultStack();
        const { buildPatientProfileInputs } = await import("../../test-support/fhe");
        const inputs = await buildPatientProfileInputs(
            await stack.anonymousPatientRegistry.getAddress(),
            stack.stranger.address,
            ELIGIBLE_PROFILE
        );
        const { computeProfileCommitment } = await import("../../test-support/profileCommitment");
        const profileCommitment = `0x${computeProfileCommitment(1n, ELIGIBLE_PROFILE).toString(16).padStart(64, "0")}`;
        await expectRevert(
            stack.anonymousPatientRegistry
                .connect(stack.stranger)
                .registerPatient(
                    1n,
                    stack.stranger.address,
                    profileCommitment,
                    inputs.age.handle,
                    inputs.gender.handle,
                    inputs.weight.handle,
                    inputs.height.handle,
                    inputs.hasDiabetes.handle,
                    inputs.hbLevel.handle,
                    inputs.isSmoker.handle,
                    inputs.hasHypertension.handle,
                    inputs.inputProof
                ),
            /Only authorized registry|reverted/
        );
    });

    it("APR-03: engine reads patient via getPatient", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        const profile = await stack.anonymousPatientRegistry.connect(engineSigner).getPatientProfile(id.commitment);
        expect(profile.exists).to.equal(true);
    });

    it("APR-04: checkRegistration", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        expect(await stack.anonymousPatientRegistry.checkRegistration(id.commitment)).to.equal(
            false
        );
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.anonymousPatientRegistry.checkRegistration(id.commitment)).to.equal(
            true
        );
    });

    it("APR-05: getPatientCount increments", async function () {
        const stack = await deployMedVaultStack();
        expect(await stack.anonymousPatientRegistry.getPatientCount()).to.equal(0n);
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        expect(await stack.anonymousPatientRegistry.getPatientCount()).to.equal(1n);
    });

    it("APR-06: engine swap blocked after registration", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        await expectRevert(
            stack.anonymousPatientRegistry
                .connect(stack.owner)
                .setAuthorizedEngine(stack.stranger.address),
            "Cannot change engine"
        );
    });

    it("APR-07: getPatientProfile view for registered commitment", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const engineSigner = await impersonateAccount(await stack.eligibilityEngine.getAddress());
        const profile = await stack.anonymousPatientRegistry.connect(engineSigner).getPatientProfile(id.commitment);
        expect(profile.exists).to.equal(true);
    });

    it("APR-08: zero address guards on setters", async function () {
        const stack = await deployMedVaultStack();
        await expectRevert(
            stack.anonymousPatientRegistry
                .connect(stack.owner)
                .setAuthorizedRegistry("0x0000000000000000000000000000000000000000"),
            "Zero address"
        );
    });
});
