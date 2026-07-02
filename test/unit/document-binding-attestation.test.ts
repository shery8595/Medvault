import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "@semaphore-protocol/identity";
import { assertFhevmMock } from "../../test-support/fhe";
import { expectRevert } from "../../test-support/assertions";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    registerPatientOnRegistry,
} from "../../test-support/deployments";
import { deriveNullifier } from "../../test-support/semaphore";
import { impersonateAccount } from "../../test-support/signers";
import { parseEventArg, buildAesKeyChunksForTest } from "../../test-support/fhe";
import {
    generateTestEligibilityProof,
    type DocumentBindingFields,
} from "../../test-support/noirProof";
import { generateKey } from "../../test-support/documentCrypto";
import { docCidHashField, readDocumentBindingFields } from "../../test-support/documentBinding";
import { revokeAccessAndRotate } from "../../test-support/documentRevoke";

describe("Unit: document-bound attestation (has_document==1)", function () {
    before(function () {
        assertFhevmMock();
    });

    async function stageWithDocument(stack: Awaited<ReturnType<typeof deployMedVaultStack>>) {
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
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

        const cid = "QmDocBindAttest";
        const aesKey = generateKey();
        const aesKeyCtHash = ethers.toBeHex(
            BigInt(ethers.keccak256(ethers.toUtf8Bytes("test-aes-ct"))) % 21888242871839275222246405745257275088548364400416034343698204186575808495617n,
            32
        ) as `0x${string}`;
        const docStoreAddr = await stack.patientDocumentStore.getAddress();
        const { chunks, inputProof } = await buildAesKeyChunksForTest(
            docStoreAddr,
            stack.patient.address,
            aesKey
        );
        await stack.patientDocumentStore
            .connect(stack.patient)
            .recordDocumentCid(
                nullifier,
                trialId,
                cid,
                aesKeyCtHash,
                chunks[0]!.handle,
                chunks[1]!.handle,
                chunks[2]!.handle,
                chunks[3]!.handle,
                inputProof
            );

        const documentBinding = await readDocumentBindingFields(stack, nullifier, trialId);
        return {
            id,
            trialId,
            nullifier,
            finalCt,
            registrySigner,
            commitment: id.commitment,
            profileSalt,
            documentBinding,
        };
    }

    async function finalizeWithBinding(
        stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
        staged: Awaited<ReturnType<typeof stageWithDocument>>,
        publicInputOverrides?: Partial<Record<number, `0x${string}`>>
    ) {
        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: staged.id,
            commitment: staged.commitment,
            trialId: staged.trialId,
            profile: ELIGIBLE_PROFILE,
            profileSalt: staged.profileSalt,
            eligible: true,
            fheStageHandle: staged.finalCt,
            documentBinding: staged.documentBinding,
        });

        const inputs = [...publicInputs] as `0x${string}`[];
        if (publicInputOverrides) {
            for (const [idx, val] of Object.entries(publicInputOverrides)) {
                inputs[Number(idx)] = val;
            }
        }

        return stack.eligibilityEngine
            .connect(staged.registrySigner)
            .finalizeAnonymousEligibilityWithProof(
                staged.commitment,
                staged.nullifier,
                staged.trialId,
                stack.patient.address,
                stack.patient.address,
                proofBytes,
                inputs
                );
    }

    it("DOC-BIND-01: has_document==1 proof with matching on-chain document finalizes", async function () {
        const stack = await deployMedVaultStack();
        const staged = await stageWithDocument(stack);
        await finalizeWithBinding(stack, staged);

        const receipt = await stack.eligibilityEngine.attestationReceipt(
            staged.nullifier,
            staged.trialId
        );
        expect(receipt.verified).to.equal(true);
    });

    it("DOC-BIND-02: Doc CID hash mismatch reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const staged = await stageWithDocument(stack);
        const wrongCidHash = ethers.toBeHex(docCidHashField("QmWrongCid"), 32) as `0x${string}`;

        await expectRevert(
            finalizeWithBinding(stack, staged, { 17: wrongCidHash }),
            /Doc CID hash mismatch/
        );
    });

    it("DOC-BIND-03: AES ct hash mismatch reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const staged = await stageWithDocument(stack);
        const wrongCt = ethers.toBeHex(1n, 32) as `0x${string}`;

        await expectRevert(finalizeWithBinding(stack, staged, { 18: wrongCt }), /AES ct hash mismatch/);
    });

    it("DOC-BIND-04: Key handle 0 mismatch reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const staged = await stageWithDocument(stack);
        const wrongHandle = ethers.toBeHex(42n, 32) as `0x${string}`;

        await expectRevert(
            finalizeWithBinding(stack, staged, { 19: wrongHandle }),
            /Key handle 0 mismatch/
        );
    });

    it("DOC-BIND-05: Document missing on-chain reverts finalize", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
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

        const fakeBinding: DocumentBindingFields = {
            hasDocument: true,
            docCidHash: docCidHashField("QmGhost"),
            aesKeyCtHash: 123n,
            aesKeyFheHandleHashes: [1n, 2n, 3n, 4n],
        };

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            profileSalt,
            eligible: true,
            fheStageHandle: finalCt,
            documentBinding: fakeBinding,
        });

        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    id.commitment,
                    nullifier,
                    trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    publicInputs
            ),
            /Document missing or revoked/
        );
    });

    it("DOC-BIND-06: Document store not set reverts when has_document==1", async function () {
        const stack = await deployMedVaultStack({ wireDocumentStore: false });
        const id = new Identity();
        const { profileSalt } = await registerPatientOnRegistry(
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

        const fakeBinding: DocumentBindingFields = {
            hasDocument: true,
            docCidHash: docCidHashField("QmNoStore"),
            aesKeyCtHash: 99n,
            aesKeyFheHandleHashes: [5n, 6n, 7n, 8n],
        };

        const { proofBytes, publicInputs } = await generateTestEligibilityProof({
            identity: id,
            commitment: id.commitment,
            trialId,
            profile: ELIGIBLE_PROFILE,
            profileSalt,
            eligible: true,
            fheStageHandle: finalCt,
            documentBinding: fakeBinding,
        });

        await expectRevert(
            stack.eligibilityEngine
                .connect(registrySigner)
                .finalizeAnonymousEligibilityWithProof(
                    id.commitment,
                    nullifier,
                    trialId,
                    stack.patient.address,
                    stack.patient.address,
                    proofBytes,
                    publicInputs
            ),
            /Document store not set/
        );
    });

    it("DOC-BIND-07: atomic revoke+rotate invalidates stale binding on finalize", async function () {
        const stack = await deployMedVaultStack();
        const staged = await stageWithDocument(stack);
        const newKey = generateKey();
        const newCid = "QmDocBindRevokedNew";
        await revokeAccessAndRotate(
            stack.patientDocumentStore,
            stack.patient,
            staged.nullifier,
            staged.trialId,
            newCid,
            newKey
        );

        await expectRevert(
            finalizeWithBinding(stack, staged),
            /Doc CID hash mismatch/
        );
    });
});
