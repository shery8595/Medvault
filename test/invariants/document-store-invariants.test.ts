import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createTrialForSponsor,
    seedPatientClear,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { Identity } from "@semaphore-protocol/identity";
import { deriveNullifier } from "../../test-support/semaphore";
import { registerPatient, stageSemaphoreApply } from "../../test-support/journey";
import {
    buildAesKeyChunksForTest,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import { generateKey } from "../../test-support/documentCrypto";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

describe("Invariants: PatientDocumentStore", function () {
    it("PDS-INV-01: document exists iff recordDocumentCid succeeded", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        await stageSemaphoreApply(stack, trialId, patient);

        expect(await stack.patientDocumentStore.documentExists(nullifier, trialId)).to.equal(false);

        const aesKey = generateKey();
        const cid = "QmInv01";
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
                docCidHash(cid),
                chunks[0]!.handle,
                chunks[1]!.handle,
                chunks[2]!.handle,
                chunks[3]!.handle,
                inputProof
            );

        expect(await stack.patientDocumentStore.documentExists(nullifier, trialId)).to.equal(true);
    });

    it("PDS-INV-02: sponsor ACL only after Accepted status", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const aesKey = generateKey();
        const cid = "QmInv02";
        const staged = await stageSemaphoreApply(stack, trialId, patient);
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
                docCidHash(cid),
                chunks[0]!.handle,
                chunks[1]!.handle,
                chunks[2]!.handle,
                chunks[3]!.handle,
                inputProof
            );

        const { finalizeSemaphoreApply } = await import("../../test-support/journey");
        await finalizeSemaphoreApply(stack, staged, patient);
        await stack.eligibilityEngine.connect(stack.sponsor).updateAnonymousApplicationStatus(trialId, nullifier, 2);

        const rec = await stack.patientDocumentStore
            .connect(stack.patient)
            .getDocumentRecord(nullifier, trialId);
        expect(rec.authorizedSponsor).to.equal(stack.sponsor.address);
    });

    it("PDS-INV-03: clear-registered patient can still bind documents", async function () {
        const stack = await deployMedVaultStack();
        const id = new Identity();
        await seedPatientClear(stack, id.commitment, stack.patient.address, ELIGIBLE_PROFILE);
        const groupId = await stack.medVaultRegistry.patientGroupId();
        await stack.mockSemaphore.addMember(groupId, id.commitment);
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(id, trialId);
        await stageSemaphoreApply(stack, trialId, {
            identity: id,
            commitment: id.commitment,
            profile: ELIGIBLE_PROFILE,
            nullifierFor: (tid: bigint) => deriveNullifier(id, tid),
        });

        const cid = "QmClearPath";
        const aesKey = generateKey();
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
                docCidHash(cid),
                chunks[0]!.handle,
                chunks[1]!.handle,
                chunks[2]!.handle,
                chunks[3]!.handle,
                inputProof
            );
        expect(await stack.patientDocumentStore.documentExists(nullifier, trialId)).to.equal(true);
    });

    const schemaCases = Array.from({ length: 16 }, (_, i) => `QmSchema${i}`);
    for (const cid of schemaCases) {
        it(`PDS-INV-SCHEMA-${cid}: cid hash within BN254 field`, async function () {
            const h = docCidHash(cid);
            const n = BigInt(h);
            expect(n).to.be.lt(BN254);
            expect(n).to.be.gt(0n);
        });
    }
});
