import { expect } from "chai";
import { ethers } from "hardhat";
import { assertFhevmMock, buildPatientProfileInputs } from "../../test-support/fhe";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deployMedVaultStack } from "../../test-support/deployments";
import { authorizeRelayer } from "../../test-support/timelock";
import { computeProfileCommitment, randomProfileSalt, profileSaltCommitment } from "../../test-support/profileCommitment";
import { Identity } from "@semaphore-protocol/identity";

describe("Integration: relayer registration privacy", function () {
    before(function () {
        assertFhevmMock();
    });

    it("REL-REG-01: relayer path does not store walletToCommitment", async function () {
        const stack = await deployMedVaultStack();
        const relayer = stack.stranger;
        await authorizeRelayer(stack.medVaultRegistry, stack.owner, relayer.address);

        const id = new Identity();
        const mvrAddr = await stack.medVaultRegistry.getAddress();
        const aprAddr = await stack.anonymousPatientRegistry.getAddress();
        const inputs = await buildPatientProfileInputs(aprAddr, mvrAddr, ELIGIBLE_PROFILE);
        const profileSalt = randomProfileSalt();
        const profileCommitment = computeProfileCommitment(
            id.commitment,
            ELIGIBLE_PROFILE,
            profileSalt
        );
        const saltCommitment = profileSaltCommitment(profileSalt);
        const nonce = await stack.medVaultRegistry.registerNonces(stack.patient.address);

        const healthDataHash = await stack.medVaultRegistry.computeHealthDataHash(
            inputs.age.handle,
            inputs.gender.handle,
            inputs.weight.handle,
            inputs.height.handle,
            inputs.hasDiabetes.handle,
            inputs.hbLevel.handle,
            inputs.isSmoker.handle,
            inputs.hasHypertension.handle,
            inputs.inputProof
        );

        const domain = {
            name: "MedVaultRegistry",
            version: "1",
            chainId: (await ethers.provider.getNetwork()).chainId,
            verifyingContract: mvrAddr,
        };
        const types = {
            RegisterViaRelayer: [
                { name: "patientWallet", type: "address" },
                { name: "identityCommitment", type: "uint256" },
                { name: "viewPermitRecipient", type: "address" },
                { name: "profileCommitment", type: "bytes32" },
                { name: "healthDataHash", type: "bytes32" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        };
        const deadline = BigInt((await ethers.provider.getBlock("latest"))!.timestamp + 3600);
        const value = {
            patientWallet: stack.patient.address,
            identityCommitment: id.commitment,
            viewPermitRecipient: stack.patient.address,
            profileCommitment: `0x${profileCommitment.toString(16).padStart(64, "0")}`,
            healthDataHash,
            nonce,
            deadline,
        };
        const signature = await stack.patient.signTypedData(domain, types, value);

        await stack.medVaultRegistry.connect(relayer).registerPatientViaRelayer(
            stack.patient.address,
            id.commitment,
            stack.patient.address,
            value.profileCommitment,
            saltCommitment,
            inputs.age.handle,
            inputs.gender.handle,
            inputs.weight.handle,
            inputs.height.handle,
            inputs.hasDiabetes.handle,
            inputs.hbLevel.handle,
            inputs.isSmoker.handle,
            inputs.hasHypertension.handle,
            inputs.inputProof,
            nonce,
            deadline,
            signature
        );

        await expect(
            stack.medVaultRegistry.getCommitmentForWallet(stack.patient.address)
        ).to.be.revertedWith("Can only query own commitment");

        const linked = await stack.medVaultRegistry
            .connect(stack.patient)
            .getCommitmentForWallet(stack.patient.address);
        expect(linked).to.equal(0n);
        expect(await stack.medVaultRegistry.connect(stack.patient).isRegistered()).to.equal(true);
    });
});
