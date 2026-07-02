import { expect } from "chai";
import { ethers } from "hardhat";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { registerPatient, stageSemaphoreApply, finalizeSemaphoreApply } from "../../test-support/journey";
import { buildAesKeyChunksForTest } from "../../test-support/fhe";
import { generateKey } from "../../test-support/documentCrypto";
import { revokeAccessAndRotate } from "../../test-support/documentRevoke";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function rawCidHash(cid: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(cid));
}

function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

describe("Integration: indexer unpin worker (P7)", function () {
    it("P7-INT-01: indexer flow unpins (mock) then attests on-chain", async function () {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        const nullifier = staged.nullifier;
        const oldCid = "QmIndexerUnpinOld";
        const newCid = "QmIndexerUnpinNew";
        const docStoreAddr = await stack.patientDocumentStore.getAddress();
        const oldKey = generateKey();
        const newKey = generateKey();
        const { chunks: oldChunks, inputProof: oldProof } = await buildAesKeyChunksForTest(
            docStoreAddr,
            stack.patient.address,
            oldKey
        );
        await stack.patientDocumentStore
            .connect(stack.patient)
            .recordDocumentCid(
                nullifier,
                trialId,
                oldCid,
                docCidHash(oldCid),
                oldChunks[0]!.handle,
                oldChunks[1]!.handle,
                oldChunks[2]!.handle,
                oldChunks[3]!.handle,
                oldProof
            );
        await revokeAccessAndRotate(
            stack.patientDocumentStore,
            stack.patient,
            nullifier,
            trialId,
            newCid,
            newKey
        );

        const indexerWallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await stack.owner.sendTransaction({
            to: indexerWallet.address,
            value: ethers.parseEther("1"),
        });
        await stack.patientDocumentStore.connect(stack.owner).setUnpinIndexer(indexerWallet.address, true);

        const originalFetch = globalThis.fetch;
        let unpinCalled = false;
        globalThis.fetch = async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("pinata.cloud/pinning/unpin")) {
                unpinCalled = true;
                expect(url).to.include(encodeURIComponent(oldCid));
            }
            return new Response(null, { status: 200 });
        };

        try {
            await fetch(`https://api.pinata.cloud/pinning/unpin/${encodeURIComponent(oldCid)}`, {
                method: "DELETE",
            });
            expect(unpinCalled).to.equal(true);

            const store = stack.patientDocumentStore.connect(indexerWallet);
            await (await store.postIndexerHeartbeat()).wait();
            const oldCidHash = rawCidHash(oldCid);
            await (
                await store.attestLegacyCidUnpinned(nullifier, trialId, oldCidHash, oldCid)
            ).wait();
        } finally {
            globalThis.fetch = originalFetch;
        }

        const att = await stack.patientDocumentStore.unpinAttestations(
            nullifier,
            trialId,
            rawCidHash(oldCid)
        );
        expect(att.completed).to.equal(true);
        expect(att.indexer).to.equal(indexerWallet.address);
    });
});
