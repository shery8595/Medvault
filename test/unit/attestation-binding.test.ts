import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { assertFhevmMock, mockDecryptBool } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import { ELIGIBLE_PROFILE, PROFILE_FAIL_AGE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { parseEventArg } from "../../test-support/fhe";
import {
    computeEligibleLocally,
    generateTestEligibilityProof,
    trialCriteriaFromDefaults,
    buildEligibilityPublicInputs,
    CRITERIA_SCHEMA_HASH,
} from "../../test-support/noirProof";
import { poseidon3 } from "poseidon-lite";
import { computeProfileCommitment } from "../../test-support/profileCommitment";
import { semaphoreScopeField } from "../../test-support/semaphore";

describe("Unit: Zama FHE vs Noir attestation differential", function () {
    before(function () {
        assertFhevmMock();
    });

    it("DIFF-01: FHE mock decrypt matches Noir compliance mirror for eligible profile", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
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

        const fheEligible = await mockDecryptBool(
            finalCt,
            await stack.eligibilityEngine.getAddress(),
            stack.patient.address
        );
        const criteria = trialCriteriaFromDefaults();
        const noirEligible = computeEligibleLocally(ELIGIBLE_PROFILE, criteria);
        expect(fheEligible).to.equal(noirEligible);
    });

    it("DIFF-02: FHE mock decrypt matches Noir compliance mirror for ineligible profile", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            PROFILE_FAIL_AGE
        );
        const trialId = await createTrialForSponsor(stack);
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

        const fheEligible = await mockDecryptBool(
            finalCt,
            await stack.eligibilityEngine.getAddress(),
            stack.patient.address
        );
        const criteria = trialCriteriaFromDefaults();
        const noirEligible = computeEligibleLocally(PROFILE_FAIL_AGE, criteria);
        expect(fheEligible).to.equal(noirEligible);
    });
});

describe("Unit: attestation anti-replay binding", function () {
    before(function () {
        assertFhevmMock();
    });

    async function stageEligible(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const id = new Identity();
        await registerPatientOnRegistry(
            stack,
            stack.patient,
            id.commitment,
            stack.patient.address,
            ELIGIBLE_PROFILE
        );
        const trialId = await createTrialForSponsor(stack);
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
        return { id, trialId, nullifier, finalCt, registrySigner, commitment: id.commitment };
    }

    it("BIND-01: wrong FHE stage hash reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier, finalCt, registrySigner, commitment, id } =
            await stageEligible(stack);

        const { proofBytes } = await generateTestEligibilityProof({
            identity: id,
            commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            eligible: true,
            fheStageHandle: finalCt,
        });

        const scope = trialId;
        const secret = id.secretScalar;
        const profileCommitment = computeProfileCommitment(commitment, ELIGIBLE_PROFILE);
        const resultHash = poseidon3([1n, scope, secret]);
        const criteria = trialCriteriaFromDefaults();
        const wrongStageInputs = buildEligibilityPublicInputs(
            scope,
            nullifier,
            profileCommitment,
            resultHash,
            true,
            ethers.ZeroHash,
            criteria
        );

        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    commitment,
                    nullifier,
                    trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    wrongStageInputs,
                    true
                ),
            /FHE stage mismatch/
        );
    });

    it("BIND-02: wrong trial scope reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const stagedA = await stageEligible(stack);
        const trialB = await createTrialForSponsor(stack);

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: stagedA.id,
            commitment: stagedA.commitment,
            trialId: trialB,
            profile: ELIGIBLE_PROFILE,
            eligible: true,
            fheStageHandle: stagedA.finalCt,
        });

        await expectRevert(
            stack.eligibilityEngine
                .connect(stagedA.registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    stagedA.commitment,
                    stagedA.nullifier,
                    stagedA.trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    publicInputs,
                    true
                ),
            /Scope mismatch|FHE stage mismatch/
        );
    });

    it("BIND-03: attestationReceipt stores seal metadata after finalize", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier, finalCt, registrySigner, commitment, id } =
            await stageEligible(stack);

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            eligible: true,
            fheStageHandle: finalCt,
        });

        await stack.eligibilityEngine
            .connect(registrySigner)
            .finalizeAnonymousEligibilityWithProof(
                commitment,
                nullifier,
                trialId,
                stack.patient.address,
                stack.patient.address,
                proofBytes,
                publicInputs,
                true
            );

        const receipt = await stack.eligibilityEngine.attestationReceipt(nullifier, trialId);
        expect(receipt.verified).to.equal(true);
        expect(receipt.fheStageHash).to.equal(finalCt);
        expect(receipt.criteriaSchemaHash).to.equal(CRITERIA_SCHEMA_HASH);
        expect(receipt.resultHash).to.equal(publicInputs[3]);
    });

    it("BIND-04: tampered staged_fhe_handle witness fails proof generation", async function () {
        const stack = await deployMedVaultStack();
        const { trialId, nullifier, finalCt, commitment, id } = await stageEligible(stack);

        await expect(
            generateTestEligibilityProof({
                identity: id,
                commitment,
                trialId,
                profile: ELIGIBLE_PROFILE,
                eligible: true,
                fheStageHandle: finalCt,
                tamperStagedWitness: true,
            })
        ).to.be.rejected;
    });
});
