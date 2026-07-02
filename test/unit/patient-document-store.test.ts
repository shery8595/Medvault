import { expect } from "chai";
import { ethers } from "hardhat";
import hre from "hardhat";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import { expectRevert } from "../../test-support/assertions";
import {
    buildAesKeyChunksForTest,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import { generateKey, splitAesKeyToUint64Chunks } from "../../test-support/documentCrypto";
import { registerPatient, stageSemaphoreApply } from "../../test-support/journey";
import { pullSponsorKeyAccess, revokeAccessAndRotate, docCidHash } from "../../test-support/documentRevoke";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

async function recordTestDocument(
    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,
    trialId: bigint,
    patient: Awaited<ReturnType<typeof registerPatient>>,
    nullifier: bigint,
    cid: string,
    aesKey: Uint8Array,
    aesKeyCtHash: `0x${string}`
) {
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
}

describe("Unit: PatientDocumentStore", function () {
    it("PDS-01: patient records CID with FHE-wrapped AES key", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        await stageSemaphoreApply(stack, trialId, patient);
        const aesKey = generateKey();
        const cid = "QmTestHybridDoc";
        await recordTestDocument(
            stack,
            trialId,
            patient,
            nullifier,
            cid,
            aesKey,
            docCidHash(cid)
        );

        expect(await stack.patientDocumentStore.documentExists(nullifier, trialId)).to.equal(true);
        expect(
            await stack.patientDocumentStore.connect(stack.patient).getDocumentCid(nullifier, trialId)
        ).to.equal(cid);
    });

    it("PDS-02: authorizeSponsorOnAccept only via EligibilityEngine Accepted", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const aesKey = generateKey();
        const cid = "QmAuthorizeTest";
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await recordTestDocument(
            stack,
            trialId,
            patient,
            nullifier,
            cid,
            aesKey,
            docCidHash(cid)
        );

        await expectRevert(
            stack.patientDocumentStore
                .connect(stack.sponsor)
                .authorizeSponsorOnAccept(trialId, nullifier),
            "Only eligibility engine"
        );

        const { finalizeSemaphoreApply } = await import("../../test-support/journey");
        await finalizeSemaphoreApply(stack, staged, patient);

        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2);

        const rec = await stack.patientDocumentStore
            .connect(stack.patient)
            .getDocumentRecord(nullifier, trialId);
        expect(rec.authorizedSponsor).to.equal(stack.sponsor.address);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);

        await hre.network.provider.send("evm_mine");

        const expected = splitAesKeyToUint64Chunks(aesKey);
        const docStoreAddr = await stack.patientDocumentStore.getAddress();
        const c0 = await mockUserDecryptUint64(rec.keyChunk0, docStoreAddr, stack.sponsor.address);
        const c1 = await mockUserDecryptUint64(rec.keyChunk1, docStoreAddr, stack.sponsor.address);
        const c2 = await mockUserDecryptUint64(rec.keyChunk2, docStoreAddr, stack.sponsor.address);
        const c3 = await mockUserDecryptUint64(rec.keyChunk3, docStoreAddr, stack.sponsor.address);
        expect([c0, c1, c2, c3].map((v) => v.toString())).to.deep.equal(
            expected.map((v) => v.toString())
        );
    });

    it("PDS-03: patient atomic revoke requires new CID and key", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const aesKey = generateKey();
        const newKey = generateKey();
        const cid = "QmRevokeTest";
        const newCid = "QmRevokeTestNew";
        await stageSemaphoreApply(stack, trialId, patient);
        await recordTestDocument(
            stack,
            trialId,
            patient,
            nullifier,
            cid,
            aesKey,
            docCidHash(cid)
        );

        await revokeAccessAndRotate(
            stack.patientDocumentStore,
            stack.patient,
            nullifier,
            trialId,
            newCid,
            newKey
        );
        const rec = await stack.patientDocumentStore
            .connect(stack.patient)
            .getDocumentRecord(nullifier, trialId);
        expect(rec.revoked).to.equal(false);
        expect(rec.cid).to.equal(newCid);
        expect(rec.authorizedSponsor).to.equal(ethers.ZeroAddress);

        const engineAddr = await stack.eligibilityEngine.getAddress();
        await ethers.provider.send("hardhat_setBalance", [engineAddr, "0x1000000000000000000"]);
        const engineSigner = await ethers.getImpersonatedSigner(engineAddr);
        await stack.patientDocumentStore
            .connect(engineSigner)
            .authorizeSponsorOnAccept(trialId, nullifier);
        await expectRevert(
            stack.patientDocumentStore.connect(stack.sponsor).getKeyForSponsor(nullifier, trialId),
            "Pull key access first"
        );
    });

    it("PDS-04: duplicate record rejected", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const aesKey = generateKey();
        const cid = "QmDup";
        await stageSemaphoreApply(stack, trialId, patient);
        await recordTestDocument(
            stack,
            trialId,
            patient,
            nullifier,
            cid,
            aesKey,
            docCidHash(cid)
        );
        await expectRevert(
            recordTestDocument(stack, trialId, patient, nullifier, cid, aesKey, docCidHash(cid)),
            "Document already recorded"
        );
    });

    it("PDS-05: recording after accept grants sponsor decrypt ACL", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const aesKey = generateKey();
        const cid = "QmRecordAfterAccept";
        const docStoreAddr = await stack.patientDocumentStore.getAddress();

        const staged = await stageSemaphoreApply(stack, trialId, patient);
        const { finalizeSemaphoreApply } = await import("../../test-support/journey");
        await finalizeSemaphoreApply(stack, staged, patient);

        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2);

        await recordTestDocument(
            stack,
            trialId,
            patient,
            nullifier,
            cid,
            aesKey,
            docCidHash(cid)
        );

        const rec = await stack.patientDocumentStore
            .connect(stack.patient)
            .getDocumentRecord(nullifier, trialId);
        expect(rec.authorizedSponsor).to.equal(stack.sponsor.address);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);

        await hre.network.provider.send("evm_mine");

        const c0 = await mockUserDecryptUint64(rec.keyChunk0, docStoreAddr, stack.sponsor.address);
        const expected = splitAesKeyToUint64Chunks(aesKey);
        expect(c0.toString()).to.equal(expected[0]!.toString());
    });
});
