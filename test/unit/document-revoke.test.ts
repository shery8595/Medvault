import { expect } from "chai";

import { ethers } from "hardhat";

import hre from "hardhat";

import { Identity } from "@semaphore-protocol/identity";

import {

    deployMedVaultStack,

    createTrialForSponsor,

    registerPatientOnRegistry,

} from "../../test-support/deployments";

import { ELIGIBLE_PROFILE } from "../../test-support/fixtures/profiles";

import { deriveNullifier } from "../../test-support/semaphore";

import { expectRevert } from "../../test-support/assertions";

import {

    assertFhevmMock,

    buildAesKeyChunksForTest,

    mockUserDecryptUint64,

    parseEventArg,

} from "../../test-support/fhe";

import { generateKey, splitAesKeyToUint64Chunks } from "../../test-support/documentCrypto";

import { registerPatient, stageSemaphoreApply } from "../../test-support/journey";

import {

    generateTestEligibilityProof,

    type DocumentBindingFields,

} from "../../test-support/noirProof";

import { readDocumentBindingFields } from "../../test-support/documentBinding";

import { impersonateAccount } from "../../test-support/signers";

import {

    docCidHash,

    pullSponsorKeyAccess,

    revokeAccessAndRotate,

} from "../../test-support/documentRevoke";



async function recordTestDocument(

    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,

    trialId: bigint,

    patientAddress: string,

    nullifier: bigint,

    cid: string,

    aesKey: Uint8Array

) {

    const docStoreAddr = await stack.patientDocumentStore.getAddress();

    const { chunks, inputProof } = await buildAesKeyChunksForTest(

        docStoreAddr,

        patientAddress,

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

    return { chunks, inputProof, docStoreAddr };

}



async function authorizeSponsorViaAccept(

    stack: Awaited<ReturnType<typeof deployMedVaultStack>>,

    trialId: bigint,

    nullifier: bigint,

    patient: Awaited<ReturnType<typeof registerPatient>>,

    cid: string,

    aesKey: Uint8Array

) {

    const staged = await stageSemaphoreApply(stack, trialId, patient);

    await recordTestDocument(stack, trialId, stack.patient.address, nullifier, cid, aesKey);

    const { finalizeSemaphoreApply } = await import("../../test-support/journey");

    await finalizeSemaphoreApply(stack, staged, patient);

    await stack.eligibilityEngine

        .connect(stack.sponsor)

        .updateAnonymousApplicationStatus(trialId, nullifier, 2);

}



describe("Unit: document forward-only revocation (ACL)", function () {

    before(function () {

        assertFhevmMock();

    });



    it("ACL-01: sponsor reads document before revoke after pull", async function () {

        const stack = await deployMedVaultStack();

        const trialId = await createTrialForSponsor(stack);

        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);

        const nullifier = deriveNullifier(patient.identity, trialId);

        const aesKey = generateKey();

        const cid = "QmAclBeforeRevoke";

        await authorizeSponsorViaAccept(stack, trialId, nullifier, patient, cid, aesKey);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);



        const rec = await stack.patientDocumentStore

            .connect(stack.sponsor)

            .getDocumentRecord(nullifier, trialId);

        expect(rec.cid).to.equal(cid);

        expect(rec.authorizedSponsor).to.equal(stack.sponsor.address);



        await hre.network.provider.send("evm_mine");

        const expected = splitAesKeyToUint64Chunks(aesKey);

        const docStoreAddr = await stack.patientDocumentStore.getAddress();

        const c0 = await mockUserDecryptUint64(rec.keyChunk0, docStoreAddr, stack.sponsor.address);

        expect(c0.toString()).to.equal(expected[0]!.toString());

    });



    it("ACL-02: atomic revokeAccess blocks sponsor reads via epoch gate", async function () {

        const stack = await deployMedVaultStack();

        const trialId = await createTrialForSponsor(stack);

        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);

        const nullifier = deriveNullifier(patient.identity, trialId);

        const aesKey = generateKey();

        const newKey = generateKey();

        const cid = "QmAclAfterRevoke";

        const newCid = "QmAclAfterRevokeNew";

        await authorizeSponsorViaAccept(stack, trialId, nullifier, patient, cid, aesKey);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);



        await revokeAccessAndRotate(

            stack.patientDocumentStore,

            stack.patient,

            nullifier,

            trialId,

            newCid,

            newKey

        );



        await expectRevert(

            stack.patientDocumentStore.connect(stack.sponsor).getDocumentRecord(nullifier, trialId),

            "Access revoked"

        );

        await expectRevert(

            stack.patientDocumentStore.connect(stack.sponsor).getKeyForSponsor(nullifier, trialId),

            "Access revoked"

        );



        const patientRec = await stack.patientDocumentStore

            .connect(stack.patient)

            .getDocumentRecord(nullifier, trialId);

        expect(patientRec.cid).to.equal(newCid);

        expect(patientRec.revoked).to.equal(false);



        const engineAddr = await stack.eligibilityEngine.getAddress();

        await ethers.provider.send("hardhat_setBalance", [engineAddr, "0x1000000000000000000"]);

        const engineSigner = await ethers.getImpersonatedSigner(engineAddr);

        const binding = await stack.patientDocumentStore

            .connect(engineSigner)

            .getDocumentBindingForEngine(nullifier, trialId);

        expect(binding.exists).to.equal(true);

        expect(binding.revoked).to.equal(false);

    });



    it("ACL-03: atomic revoke+rotate re-keys and rotates CID for patient only", async function () {

        const stack = await deployMedVaultStack();

        const trialId = await createTrialForSponsor(stack);

        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);

        const nullifier = deriveNullifier(patient.identity, trialId);

        const oldKey = generateKey();

        const newKey = generateKey();

        const cid = "QmAclRotate";

        const newCid = "QmAclRotateNew";

        await authorizeSponsorViaAccept(stack, trialId, nullifier, patient, cid, oldKey);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);



        const tx = await revokeAccessAndRotate(

            stack.patientDocumentStore,

            stack.patient,

            nullifier,

            trialId,

            newCid,

            newKey

        );

        const rotated = tx?.logs

            .map((l) => {

                try {

                    return stack.patientDocumentStore.interface.parseLog(l);

                } catch {

                    return null;

                }

            })

            .find((p) => p?.name === "DocumentRotated");

        expect(rotated).to.not.equal(undefined);



        const rec = await stack.patientDocumentStore

            .connect(stack.patient)

            .getDocumentRecord(nullifier, trialId);

        expect(rec.revoked).to.equal(false);

        expect(rec.cid).to.equal(newCid);

        expect(rec.authorizedSponsor).to.equal(ethers.ZeroAddress);



        await expectRevert(

            stack.patientDocumentStore.connect(stack.sponsor).getKeyForSponsor(nullifier, trialId),

            "Access revoked"

        );



        await hre.network.provider.send("evm_mine");

        const docStoreAddr = await stack.patientDocumentStore.getAddress();

        const expected = splitAesKeyToUint64Chunks(newKey);

        const c0 = await mockUserDecryptUint64(rec.keyChunk0, docStoreAddr, stack.patient.address);

        expect(c0.toString()).to.equal(expected[0]!.toString());

    });



    it("ACL-04: finalize with stale binding fails after atomic revoke+rotate", async function () {

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

            .stageAnonymousEligibility(id.commitment, trialId, nullifier, stack.patient.address);

        const stageRc = await stageTx.wait();

        const finalCt = parseEventArg(

            stageRc!,

            stack.eligibilityEngine.interface,

            "AnonymousEligibilityStaged",

            "finalCt"

        );



        const cid = "QmAclFinalize";

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



        const documentBinding = await readDocumentBindingFields(stack, nullifier, trialId);



        const rotatedKey = generateKey();

        const rotatedCid = "QmAclFinalizeRotated";

        await revokeAccessAndRotate(

            stack.patientDocumentStore,

            stack.patient,

            nullifier,

            trialId,

            rotatedCid,

            rotatedKey

        );



        const { proofBytes, publicInputs } = await generateTestEligibilityProof({

            identity: id,

            commitment: id.commitment,

            trialId,

            profile: ELIGIBLE_PROFILE,

            profileSalt,

            eligible: true,

            fheStageHandle: finalCt,

            documentBinding,

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

            /Doc CID hash mismatch/

        );



        const newBinding = await readDocumentBindingFields(stack, nullifier, trialId);

        const { proofBytes: proof2, publicInputs: inputs2 } = await generateTestEligibilityProof({

            identity: id,

            commitment: id.commitment,

            trialId,

            profile: ELIGIBLE_PROFILE,

            profileSalt,

            eligible: true,

            fheStageHandle: finalCt,

            documentBinding: newBinding as DocumentBindingFields,

        });



        await stack.eligibilityEngine

            .connect(registrySigner)

            .finalizeAnonymousEligibilityWithProof(

                id.commitment,

                nullifier,

                trialId,

                stack.patient.address,

                stack.patient.address,

                proof2,

                inputs2

                );

    });



    it("ACL-05: patient can revoke before sponsor first pull", async function () {

        const stack = await deployMedVaultStack();

        const trialId = await createTrialForSponsor(stack);

        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);

        const nullifier = deriveNullifier(patient.identity, trialId);

        const oldKey = generateKey();

        const newKey = generateKey();

        const cid = "QmAclPrePull";

        const newCid = "QmAclPrePullNew";

        await authorizeSponsorViaAccept(stack, trialId, nullifier, patient, cid, oldKey);



        await revokeAccessAndRotate(

            stack.patientDocumentStore,

            stack.patient,

            nullifier,

            trialId,

            newCid,

            newKey

        );



        await expectRevert(

            stack.patientDocumentStore.connect(stack.sponsor).pullSponsorKeyAccess(nullifier, trialId),

            "Sponsor not authorized"

        );

        await expectRevert(

            stack.patientDocumentStore.connect(stack.sponsor).getKeyForSponsor(nullifier, trialId),

            "Pull key access first"

        );

    });



    it("ACL-06: old key handles unreferenced after atomic revoke+rotate", async function () {

        const stack = await deployMedVaultStack();

        const trialId = await createTrialForSponsor(stack);

        const patient = await registerPatient(stack, stack.patient, ELIGIBLE_PROFILE);

        const nullifier = deriveNullifier(patient.identity, trialId);

        const oldKey = generateKey();

        const newKey = generateKey();

        const cid = "QmAclOldHandles";

        const newCid = "QmAclOldHandlesNew";

        await authorizeSponsorViaAccept(stack, trialId, nullifier, patient, cid, oldKey);

        await pullSponsorKeyAccess(stack.patientDocumentStore, stack.sponsor, nullifier, trialId);



        const before = await stack.patientDocumentStore

            .connect(stack.patient)

            .getDocumentRecord(nullifier, trialId);

        const oldHandle0 = before.keyChunk0;



        const tx = await revokeAccessAndRotate(

            stack.patientDocumentStore,

            stack.patient,

            nullifier,

            trialId,

            newCid,

            newKey

        );

        const legacy = tx?.logs

            .map((l) => {

                try {

                    return stack.patientDocumentStore.interface.parseLog(l);

                } catch {

                    return null;

                }

            })

            .find((p) => p?.name === "DocumentLegacyHandleRevoked");

        expect(legacy).to.not.equal(undefined);



        const after = await stack.patientDocumentStore

            .connect(stack.patient)

            .getDocumentRecord(nullifier, trialId);

        expect(after.keyChunk0).to.not.equal(oldHandle0);

        expect(after.cid).to.equal(newCid);

    });

});


