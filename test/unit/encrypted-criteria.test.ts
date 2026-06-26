import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { assertFhevmMock, mockDecryptBool } from "../../test-support/fhe";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createEncryptedTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { parseEventArg } from "../../test-support/fhe";
import { generateTestEligibilityProof, BN254_FIELD_ORDER } from "../../test-support/noirProof";
import { deriveEphemeralAddress } from "../../test-support/vaultEip712";

describe("Unit: encrypted sponsor criteria", function () {
    before(function () {
        assertFhevmMock();
    });

    it("ECR-01: encrypted criteria trial matches eligible patient", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createEncryptedTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(
                id.commitment,
                trialId,
                nullifier,
                stack.patient.address
            );
        const stageRc = await stageTx.wait();
        const finalCt = parseEventArg(
            stageRc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );
        const eligible = await mockDecryptBool(
            finalCt,
            await stack.eligibilityEngine.getAddress(),
            stack.patient.address
        );
        expect(eligible).to.equal(true);
    });

    it("ECR-02: trial reports encryptedCriteria flag", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createEncryptedTrialForSponsor(stack);
        const trial = await stack.trialManager.getTrial(trialId);
        expect(trial.encryptedCriteria).to.equal(true);
    });

    it("ECR-03: encrypted criteria Noir finalize with echo binding", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createEncryptedTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        const ephemeral = await deriveEphemeralAddress(id);
        const registrySigner = await impersonateAccount(await stack.medVaultRegistry.getAddress());
        const stageTx = await stack.eligibilityEngine
            .connect(registrySigner)
            .stageAnonymousEligibility(id.commitment, trialId, nullifier, ephemeral);
        const stageRc = await stageTx.wait();
        const finalCt = parseEventArg(
            stageRc!,
            stack.eligibilityEngine.interface,
            "AnonymousEligibilityStaged",
            "finalCt"
        );

        const bindingHash = await stack.eligibilityEngine.encryptedCriteriaBindingHash(trialId);
        const bindingField = BigInt(bindingHash) % BN254_FIELD_ORDER;
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            eligible: true,
            fheStageHandle: finalCt,
            criteriaMode: 1,
            encryptedCriteriaBindingHash: bindingField,
        });

        await stack.eligibilityEngine
            .connect(registrySigner)
            .finalizeAnonymousEligibilityWithProof(
                id.commitment,
                nullifier,
                trialId,
                ephemeral,
                stack.patient.address,
                proofBytes,
                publicInputs,
                true
            );

        expect(await stack.eligibilityEngine.noirVerifiedResults(nullifier, trialId)).to.equal(true);
        expect(BigInt(publicInputs[16]!)).to.equal(1n);
        expect(BigInt(publicInputs[7]!)).to.equal(bindingField);
    });
});
