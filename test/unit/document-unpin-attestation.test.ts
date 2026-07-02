import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployMedVaultStack, createTrialForSponsor } from "../../test-support/deployments";
import { registerPatient, stageSemaphoreApply, finalizeSemaphoreApply } from "../../test-support/journey";
import { buildAesKeyChunksForTest } from "../../test-support/fhe";
import { generateKey } from "../../test-support/documentCrypto";
import { expectRevert } from "../../test-support/assertions";
import { revokeAccessAndRotate } from "../../test-support/documentRevoke";

const BN254 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function rawCidHash(cid: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(cid));
}

function docCidHash(cid: string): `0x${string}` {
    return ethers.toBeHex(BigInt(ethers.keccak256(ethers.toUtf8Bytes(cid))) % BN254, 32);
}

describe("Unit: document unpin attestation (P7)", function () {
    async function rotateFixture() {
        const stack = await deployMedVaultStack();
        const trialId = await createTrialForSponsor(stack);
        const patient = await registerPatient(stack);
        const staged = await stageSemaphoreApply(stack, trialId, patient);
        await finalizeSemaphoreApply(stack, staged, patient);
        const nullifier = staged.nullifier;
        const oldCid = "QmP7OldCid";
        const newCid = "QmP7NewCid";
        const oldKey = generateKey();
        const newKey = generateKey();
        const docStoreAddr = await stack.patientDocumentStore.getAddress();
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
        return { stack, trialId, nullifier, oldCid };
    }

    it("P7-01: trusted indexer heartbeat + attest legacy CID unpin", async function () {
        const { stack, trialId, nullifier, oldCid } = await rotateFixture();
        const indexer = ethers.Wallet.createRandom().connect(ethers.provider);
        await stack.owner.sendTransaction({
            to: indexer.address,
            value: ethers.parseEther("1"),
        });
        await stack.patientDocumentStore.connect(stack.owner).setUnpinIndexer(indexer.address, true);
        await stack.patientDocumentStore.connect(indexer).postIndexerHeartbeat();
        const oldCidHash = rawCidHash(oldCid);
        await expect(
            stack.patientDocumentStore
                .connect(indexer)
                .attestLegacyCidUnpinned(nullifier, trialId, oldCidHash, oldCid)
        )
            .to.emit(stack.patientDocumentStore, "LegacyCidUnpinAttested")
            .withArgs(nullifier, trialId, oldCidHash, indexer.address, oldCid);

        const att = await stack.patientDocumentStore.unpinAttestations(nullifier, trialId, oldCidHash);
        expect(att.completed).to.equal(true);
        expect(att.indexer).to.equal(indexer.address);
        expect(await stack.patientDocumentStore.isUnpinIndexerActive(indexer.address)).to.equal(true);
    });

    it("P7-02: non-trusted indexer cannot heartbeat or attest", async function () {
        const { stack, trialId, nullifier, oldCid } = await rotateFixture();
        const stranger = ethers.Wallet.createRandom().connect(ethers.provider);
        await stack.owner.sendTransaction({
            to: stranger.address,
            value: ethers.parseEther("1"),
        });
        await expectRevert(
            stack.patientDocumentStore.connect(stranger).postIndexerHeartbeat(),
            /Not trusted indexer/
        );
        await expectRevert(
            stack.patientDocumentStore
                .connect(stranger)
                .attestLegacyCidUnpinned(nullifier, trialId, rawCidHash(oldCid), oldCid),
            /Not trusted indexer/
        );
    });

    it("P7-03: stale heartbeat blocks attestation", async function () {
        const { stack, trialId, nullifier, oldCid } = await rotateFixture();
        const indexer = ethers.Wallet.createRandom().connect(ethers.provider);
        await stack.owner.sendTransaction({
            to: indexer.address,
            value: ethers.parseEther("1"),
        });
        await stack.patientDocumentStore.connect(stack.owner).setUnpinIndexer(indexer.address, true);
        await stack.patientDocumentStore.connect(indexer).postIndexerHeartbeat();
        const maxAge = await stack.patientDocumentStore.INDEXER_HEARTBEAT_MAX_AGE();
        await time.increase(Number(maxAge) + 1);
        await expectRevert(
            stack.patientDocumentStore
                .connect(indexer)
                .attestLegacyCidUnpinned(nullifier, trialId, rawCidHash(oldCid), oldCid),
            /Indexer heartbeat stale/
        );
    });

    it("P7-04: atomic revokeAccess emits oldCid on DocumentLegacyHandleRevoked", async function () {
        const { stack, trialId, nullifier, oldCid } = await rotateFixture();
        const filter = stack.patientDocumentStore.filters.DocumentLegacyHandleRevoked(
            nullifier,
            trialId
        );
        const events = await stack.patientDocumentStore.queryFilter(filter);
        expect(events.length).to.be.gte(1);
        const last = events[events.length - 1]!;
        expect(last.args.oldCid).to.equal(oldCid);
    });
});
