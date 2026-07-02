import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployMedVaultStack,
    createTrialForSponsor,
} from "../../test-support/deployments";
import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";
import { deriveNullifier } from "../../test-support/semaphore";
import {
    buildAesKeyChunksForTest,
    mockUserDecryptUint64,
} from "../../test-support/fhe";
import { generateTestDocumentKey, encryptTestDocument, reassembleAesKeyFromUint64Chunks } from "../../test-support/documentCrypto";
import { registerPatient, stageSemaphoreApply } from "../../test-support/journey";
import { pullSponsorKeyAccess } from "../../test-support/documentRevoke";
import hre from "hardhat";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

describe("Integration: hybrid storage (IPFS CID + FHE AES key + sponsor decrypt)", function () {
    it("HYB-01: record document → accept → sponsor decrypts AES key chunks", async function () {
        const stack = await deployMedVaultStack();
        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);
        const trialId = await createTrialForSponsor(stack);
        const nullifier = deriveNullifier(patient.identity, trialId);
        const docStoreAddr = await stack.patientDocumentStore.getAddress();

        const plaintext = new TextEncoder().encode("hybrid-storage-lab-report");
        const aesKey = generateTestDocumentKey();
        const encryptedPayload = await encryptTestDocument(plaintext, aesKey);
        const payloadCid = "QmHybridPayloadCid";
        const aesKeyCtHash = ethers.toBeHex(
            BigInt(ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(encryptedPayload)))) % BN254,
            32
        ) as `0x${string}`;

        const staged = await stageSemaphoreApply(stack, trialId, patient);

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
                payloadCid,
                aesKeyCtHash,
                chunks[0]!.handle,
                chunks[1]!.handle,
                chunks[2]!.handle,
                chunks[3]!.handle,
                inputProof
            );

        const { finalizeSemaphoreApply } = await import("../../test-support/journey");
        await finalizeSemaphoreApply(stack, staged, patient);

        await stack.eligibilityEngine
            .connect(stack.sponsor)
            .updateAnonymousApplicationStatus(trialId, nullifier, 2);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);

        await hre.network.provider.send("evm_mine");

        const rec = await stack.patientDocumentStore
            .connect(stack.sponsor)
            .getDocumentRecord(nullifier, trialId);
        expect(rec.authorizedSponsor).to.equal(stack.sponsor.address);
        expect(rec.cid).to.equal(payloadCid);

        const decryptedChunks: bigint[] = [];
        for (const handle of [rec.keyChunk0, rec.keyChunk1, rec.keyChunk2, rec.keyChunk3]) {
            decryptedChunks.push(
                await mockUserDecryptUint64(handle, docStoreAddr, stack.sponsor.address)
            );
        }
        const recoveredKey = reassembleAesKeyFromUint64Chunks(decryptedChunks);
        expect(Buffer.from(recoveredKey)).to.deep.equal(Buffer.from(aesKey));
    });
});
