/**

 * MedVault Noir integration — browser UltraHonk proofs for HonkVerifier.sol / HonkVerifierEncrypted.sol (EVM / Keccak).

 * Noir is the public attestation seal; Zama FHE remains the compute authority.

 */



import { ethers } from "ethers";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

import { Noir } from "@noir-lang/noir_js";

import { Identity } from "@semaphore-protocol/identity";

import { poseidon2, poseidon3 } from "poseidon-lite";

import { fieldFromBytes32, parseFieldElement } from "./field";

import { ensureNoirWasmInitialized } from "./noirInit";

import { computeProfileCommitment, type PatientProfilePlain } from "./profileCommitment";

import { getStoredProfileSalt } from "./profileStorage";

import { getAnonymousNullifier, semaphoreScopeField } from "./semaphore";

import { criteriaSchemaHashField, docSchemaHashField, fheStageHandleToField, normalizeFheHandle, BN254_FIELD_ORDER } from "./criteriaSchema";



export const ELIGIBILITY_PUBLIC_INPUT_COUNT = 25;
export const ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT = 15;



/** Keccak transcript + non-ZK — matches Solidity HonkVerifier from `npm run build:circuit`. */

export const EVM_HONK_PROVE_OPTIONS = { verifierTarget: "evm-no-zk" as const };



export type TrialCriteriaPlain = {

    minAge: number;

    maxAge: number;

    requiresDiabetes: boolean;

    minHb: number;

    genderRequirement: number;

    minHeight: number;

    maxWeight: number;

    requiresNonSmoker: boolean;

    requiresNormalBP: boolean;

};



export type DocumentBindingInputs = {
    hasDocument: boolean;
    docCidHash?: bigint;
    aesKeyCtHash?: bigint;
    aesKeyFheHandleHashes?: [bigint, bigint, bigint, bigint];
};

export interface EligibilityProofInputs {

    secret: bigint;

    commitment: bigint;

    eligibilityResult: boolean;

    scope: bigint;

    nullifier: bigint;

    scopeInternal: bigint;

    profileCommitment: bigint;

    profileSalt: bigint;

    resultHash: bigint;

    fheStageHandleHash: bigint;

    criteriaSchemaHash: bigint;

    criteria: TrialCriteriaPlain;

    criteriaMode: 0 | 1;

    encryptedCriteriaBindingHash?: bigint;

    documentBinding?: DocumentBindingInputs;

}



export interface EligibilityProofData {

    proofBytes: `0x${string}`;

    publicInputs: `0x${string}`[];

    inputs: EligibilityProofInputs;

}



type CompiledCircuit = { bytecode: string };



let _compiledPlaintextCircuit: CompiledCircuit | null = null;
let _compiledEncryptedCircuit: CompiledCircuit | null = null;

export async function loadCircuit(criteriaMode: 0 | 1 = 0): Promise<CompiledCircuit> {
    if (criteriaMode === 1) {
        if (_compiledEncryptedCircuit) return _compiledEncryptedCircuit;
        const circuit = await import("./circuits/eligibility_encrypted.json");
        _compiledEncryptedCircuit = (circuit.default ?? circuit) as CompiledCircuit;
        if (!_compiledEncryptedCircuit.bytecode) {
            throw new Error("Encrypted circuit artifact missing bytecode. Run `npm run build:circuit`.");
        }
        return _compiledEncryptedCircuit;
    }

    if (_compiledPlaintextCircuit) return _compiledPlaintextCircuit;
    const circuit = await import("./circuits/eligibility_plaintext.json");
    _compiledPlaintextCircuit = (circuit.default ?? circuit) as CompiledCircuit;
    if (!_compiledPlaintextCircuit.bytecode) {
        throw new Error("Plaintext circuit artifact missing bytecode. Run `npm run build:circuit`.");
    }
    return _compiledPlaintextCircuit;
}



export function deriveProofInputs(

    identity: Identity,

    commitment: bigint,

    trialId: bigint,

    profile: PatientProfilePlain,

    criteria: TrialCriteriaPlain,

    eligible: boolean,

    fheStageHandle: bigint | string,

    options?: {

        criteriaMode?: 0 | 1;

        encryptedCriteriaBindingHash?: bigint;

        documentBinding?: DocumentBindingInputs;

    }

): EligibilityProofInputs {

    const secret = identity.secretScalar;

    const scope = trialId;

    const scopeInternal = semaphoreScopeField(trialId);

    const nullifier = getAnonymousNullifier(trialId) ?? 0n;

    const profileSalt = getStoredProfileSalt();
    if (profileSalt === null) {
        throw new Error(
            "No stored profile salt. Re-register your health vault (production registration requires random profileSalt)."
        );
    }

    const profileCommitment = computeProfileCommitment(commitment, profile, profileSalt);

    const criteriaMode = options?.criteriaMode ?? 0;
    const eligibleField = eligible ? 1n : 0n;
    const resultHash =
        criteriaMode === 1
            ? poseidon2([scope, secret])
            : poseidon3([eligibleField, scope, secret]);

    return {

        secret,

        commitment,

        eligibilityResult: eligible,

        scope,

        nullifier,

        scopeInternal,

        profileCommitment,

        profileSalt,

        resultHash,

        fheStageHandleHash: fheStageHandleToField(fheStageHandle),

        criteriaSchemaHash: criteriaSchemaHashField(),

        criteria,

        criteriaMode,

        encryptedCriteriaBindingHash: options?.encryptedCriteriaBindingHash,

        documentBinding: options?.documentBinding,

    };

}



export async function generateEligibilityProof(

    identity: Identity,

    commitment: bigint,

    trialId: bigint,

    profile: PatientProfilePlain,

    criteria: TrialCriteriaPlain,

    eligibleResult: boolean,

    fheStageHandle: bigint | string,

    options?: {

        criteriaMode?: 0 | 1;

        encryptedCriteriaBindingHash?: bigint;

        documentBinding?: DocumentBindingInputs;

    }

): Promise<EligibilityProofData> {

    await ensureNoirWasmInitialized();



    const storedNullifier = getAnonymousNullifier(trialId);

    if (storedNullifier === null) {

        throw new Error(

            `No stored Semaphore nullifier for trial ${trialId}. Apply to the trial before sealing.`

        );

    }



    const criteriaMode = options?.criteriaMode ?? 0;
    const compiledCircuit = await loadCircuit(criteriaMode);
    const inputs = deriveProofInputs(
        identity,
        commitment,
        trialId,
        profile,
        criteria,
        eligibleResult,
        fheStageHandle,
        options
    );

    if (inputs.nullifier !== storedNullifier) {
        throw new Error(
            "Stored Semaphore nullifier does not match witness inputs. Re-apply anonymously first."
        );
    }

    const bindingHash =
        criteriaMode === 1
            ? (inputs.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER
            : 0n;

    const docBinding = inputs.documentBinding;
    const docChunkFields: [bigint, bigint, bigint, bigint] = docBinding?.hasDocument
        ? (docBinding.aesKeyFheHandleHashes ?? [0n, 0n, 0n, 0n]).map((h) => h % BN254_FIELD_ORDER) as [
              bigint,
              bigint,
              bigint,
              bigint,
          ]
        : [0n, 0n, 0n, 0n];

    const noirInputs: Record<string, string | boolean | number> =
        criteriaMode === 1
            ? {
                  secret: inputs.secret.toString(),
                  scope_internal: inputs.scopeInternal.toString(),
                  staged_fhe_handle: inputs.fheStageHandleHash.toString(),
                  staged_aes_key_chunk_0: docChunkFields[0].toString(),
                  staged_aes_key_chunk_1: docChunkFields[1].toString(),
                  staged_aes_key_chunk_2: docChunkFields[2].toString(),
                  staged_aes_key_chunk_3: docChunkFields[3].toString(),
                  doc_cid_hash_witness: docBinding?.hasDocument
                      ? ((docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_ct_hash_witness: docBinding?.hasDocument
                      ? ((docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  scope: inputs.scope.toString(),
                  nullifier: inputs.nullifier.toString(),
                  result_hash: inputs.resultHash.toString(),
                  fhe_stage_handle_hash: inputs.fheStageHandleHash.toString(),
                  criteria_schema_hash: inputs.criteriaSchemaHash.toString(),
                  criteria_binding_hash: bindingHash.toString(),
                  criteria_mode: 1,
                  doc_cid_hash: docBinding?.hasDocument
                      ? ((docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_ct_hash: docBinding?.hasDocument
                      ? ((docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_fhe_handle_hash_0: docChunkFields[0].toString(),
                  aes_key_fhe_handle_hash_1: docChunkFields[1].toString(),
                  aes_key_fhe_handle_hash_2: docChunkFields[2].toString(),
                  aes_key_fhe_handle_hash_3: docChunkFields[3].toString(),
                  doc_schema_hash: docBinding?.hasDocument ? docSchemaHashField().toString() : "0",
                  has_document: docBinding?.hasDocument ? "1" : "0",
              }
            : {
                  secret: inputs.secret.toString(),
                  scope_internal: inputs.scopeInternal.toString(),
                  commitment: inputs.commitment.toString(),
                  age: profile.age,
                  gender: profile.gender,
                  weight: profile.weight,
                  height: profile.height,
                  has_diabetes: profile.hasDiabetes,
                  hb_level: profile.hbLevel,
                  is_smoker: profile.isSmoker,
                  has_hypertension: profile.hasHypertension,
                  profile_salt: inputs.profileSalt.toString(),
                  staged_fhe_handle: inputs.fheStageHandleHash.toString(),
                  staged_aes_key_chunk_0: docChunkFields[0].toString(),
                  staged_aes_key_chunk_1: docChunkFields[1].toString(),
                  staged_aes_key_chunk_2: docChunkFields[2].toString(),
                  staged_aes_key_chunk_3: docChunkFields[3].toString(),
                  doc_cid_hash_witness: docBinding?.hasDocument
                      ? ((docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_ct_hash_witness: docBinding?.hasDocument
                      ? ((docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  scope: inputs.scope.toString(),
                  nullifier: inputs.nullifier.toString(),
                  profile_commitment: inputs.profileCommitment.toString(),
                  result_hash: inputs.resultHash.toString(),
                  eligible: eligibleResult ? "1" : "0",
                  fhe_stage_handle_hash: inputs.fheStageHandleHash.toString(),
                  criteria_schema_hash: inputs.criteriaSchemaHash.toString(),
                  min_age: criteria.minAge,
                  max_age: criteria.maxAge,
                  requires_diabetes: criteria.requiresDiabetes ? "1" : "0",
                  min_hb: criteria.minHb,
                  gender_requirement: criteria.genderRequirement,
                  min_height: criteria.minHeight,
                  max_weight: criteria.maxWeight,
                  requires_non_smoker: criteria.requiresNonSmoker ? "1" : "0",
                  requires_normal_bp: criteria.requiresNormalBP ? "1" : "0",
                  criteria_mode: 0,
                  doc_cid_hash: docBinding?.hasDocument
                      ? ((docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_ct_hash: docBinding?.hasDocument
                      ? ((docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER).toString()
                      : "0",
                  aes_key_fhe_handle_hash_0: docChunkFields[0].toString(),
                  aes_key_fhe_handle_hash_1: docChunkFields[1].toString(),
                  aes_key_fhe_handle_hash_2: docChunkFields[2].toString(),
                  aes_key_fhe_handle_hash_3: docChunkFields[3].toString(),
                  doc_schema_hash: docBinding?.hasDocument ? docSchemaHashField().toString() : "0",
                  has_document: docBinding?.hasDocument ? "1" : "0",
              };



    const api = await Barretenberg.new({ threads: 4 });

    const backend = new UltraHonkBackend(compiledCircuit.bytecode, api);

    const noir = new Noir(compiledCircuit as object);



    const { witness } = await noir.execute(noirInputs);

    const { proof, publicInputs: rawPublicInputs } = await backend.generateProof(

        witness,

        EVM_HONK_PROVE_OPTIONS

    );



    const solidityPublicInputs =
        criteriaMode === 1
            ? buildEncryptedContractPublicInputs(inputs)
            : buildContractPublicInputs(inputs);

    assertProofPublicInputsMatchRaw(rawPublicInputs, inputs);



    const localValid = await backend.verifyProof(

        { proof, publicInputs: rawPublicInputs },

        EVM_HONK_PROVE_OPTIONS

    );

    await api.destroy();



    if (!localValid) {

        throw new Error(

            "Proof failed local verification. Run `npm run build:circuit` and redeploy HonkVerifier."

        );

    }



    const proofBytes = formatProofBytesForSolidity(proof);

    assertSolidityProofMetadata(proofBytes);



    return { proofBytes, publicInputs: solidityPublicInputs, inputs };

}



/** Read persisted Zama FHE result handle for attestation binding (post-apply seal). */

export async function fetchFheStageHandleForAttestation(
    engine: ethers.Contract,
    nullifier: bigint,
    trialId: bigint
): Promise<bigint> {
    const resultHandle = await engine.getAnonymousResult(nullifier, trialId);
    const normalized = normalizeFheHandle(resultHandle);
    if (normalized === 0n) {
        throw new Error("No Zama FHE result handle found for this nullifier/trial.");
    }
    return normalized;
}



export function formatProofBytesForSolidity(proof: Uint8Array): `0x${string}` {

    return ("0x" + Buffer.from(proof).toString("hex")) as `0x${string}`;

}



const MIN_SOLIDITY_PROOF_BYTES = 6_000;

const EXPECTED_SOLIDITY_PROOF_FIELDS = 188;



export function readSolidityProofMetadata(proofBytes: `0x${string}`): {

    circuitSize: bigint;

    publicInputsSize: bigint;

    publicInputsOffset: bigint;

} {

    const hex = proofBytes.startsWith("0x") ? proofBytes.slice(2) : proofBytes;

    const readWord = (index: number) => BigInt(`0x${hex.slice(index * 64, index * 64 + 64)}`);

    return {

        circuitSize: readWord(0),

        publicInputsSize: readWord(1),

        publicInputsOffset: readWord(2),

    };

}



export function assertSolidityProofMetadata(proofBytes: `0x${string}`): void {

    const byteLen = (proofBytes.length - 2) / 2;

    if (byteLen < MIN_SOLIDITY_PROOF_BYTES) {

        throw new Error(

            `Proof too short (${byteLen} bytes). Expected ~${EXPECTED_SOLIDITY_PROOF_FIELDS * 32} for bb 5.x HonkVerifier.`

        );

    }

    if (byteLen % 32 !== 0) {

        throw new Error("Proof length must be a multiple of 32 bytes (BN254 field elements).");

    }

}



export function buildDocumentBindingPublicInputs(
    binding?: DocumentBindingInputs
): `0x${string}`[] {
    if (!binding?.hasDocument) {
        return Array.from({ length: 8 }, () => fieldToBytes32(0n));
    }
    const handles = binding.aesKeyFheHandleHashes ?? [0n, 0n, 0n, 0n];
    return [
        fieldToBytes32((binding.docCidHash ?? 0n) % BN254_FIELD_ORDER),
        fieldToBytes32((binding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER),
        fieldToBytes32(handles[0] % BN254_FIELD_ORDER),
        fieldToBytes32(handles[1] % BN254_FIELD_ORDER),
        fieldToBytes32(handles[2] % BN254_FIELD_ORDER),
        fieldToBytes32(handles[3] % BN254_FIELD_ORDER),
        fieldToBytes32(docSchemaHashField()),
        fieldToBytes32(1n),
    ];
}

export function buildEncryptedContractPublicInputs(inputs: EligibilityProofInputs): `0x${string}`[] {
    const bindingHash = (inputs.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER;
    return [
        fieldToBytes32(inputs.scope),
        fieldToBytes32(inputs.nullifier),
        fieldToBytes32(inputs.resultHash),
        fieldToBytes32(inputs.fheStageHandleHash),
        fieldToBytes32(inputs.criteriaSchemaHash),
        fieldToBytes32(bindingHash),
        fieldToBytes32(1n),
        ...buildDocumentBindingPublicInputs(inputs.documentBinding),
    ];
}

export function buildContractPublicInputs(inputs: EligibilityProofInputs): `0x${string}`[] {

    const c = inputs.criteria;

    const eligibleField = inputs.eligibilityResult ? 1n : 0n;

    const bindingHash =
        inputs.criteriaMode === 1
            ? (inputs.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER
            : 0n;

    return [

        fieldToBytes32(inputs.scope),

        fieldToBytes32(inputs.nullifier),

        fieldToBytes32(inputs.profileCommitment),

        fieldToBytes32(inputs.resultHash),

        fieldToBytes32(eligibleField),

        fieldToBytes32(inputs.fheStageHandleHash),

        fieldToBytes32(inputs.criteriaSchemaHash),

        fieldToBytes32(inputs.criteriaMode === 1 ? bindingHash : BigInt(c.minAge)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : BigInt(c.maxAge)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : c.requiresDiabetes ? 1n : 0n),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : BigInt(c.minHb)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : BigInt(c.genderRequirement)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : BigInt(c.minHeight)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : BigInt(c.maxWeight)),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : c.requiresNonSmoker ? 1n : 0n),

        fieldToBytes32(inputs.criteriaMode === 1 ? 0n : c.requiresNormalBP ? 1n : 0n),

        fieldToBytes32(BigInt(inputs.criteriaMode)),

        ...buildDocumentBindingPublicInputs(inputs.documentBinding),

    ];

}



export function buildContractPublicInputsFromRaw(rawPublicInputs: string[]): `0x${string}`[] {

    return rawPublicInputs.map((pi) => fieldToBytes32(parseFieldElement(pi)));

}



function fieldToBytes32(value: bigint): `0x${string}` {

    return ("0x" + value.toString(16).padStart(64, "0")) as `0x${string}`;

}



export { fieldFromBytes32, parseFieldElement } from "./field";

export { normalizeFheHandle } from "./criteriaSchema";



function assertProofPublicInputsMatchRaw(

    rawPublicInputs: string[],

    inputs: EligibilityProofInputs

): void {

    const expected =
        inputs.criteriaMode === 1
            ? buildEncryptedContractPublicInputs(inputs).map((pi) => parseFieldElement(pi))
            : buildContractPublicInputs(inputs).map((pi) => parseFieldElement(pi));

    const actual = rawPublicInputs.map((pi) => parseFieldElement(pi));

    const expectedCount =
        inputs.criteriaMode === 1
            ? ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT
            : ELIGIBILITY_PUBLIC_INPUT_COUNT;

    if (actual.length !== expectedCount) {
        throw new Error(
            `Expected ${expectedCount} public inputs, got ${actual.length}.`
        );
    }

    for (let i = 0; i < expected.length; i++) {

        if (actual[i] !== expected[i]) {

            throw new Error(`Proof public input mismatch at index ${i}.`);

        }

    }

}



export async function verifyProofLocally(

    proof: Uint8Array,

    rawPublicInputs: string[]

): Promise<boolean> {

    const compiledCircuit = await loadCircuit();

    const api = await Barretenberg.new({ threads: 1 });

    const backend = new UltraHonkBackend(compiledCircuit.bytecode, api);

    const valid = await backend.verifyProof(

        { proof, publicInputs: rawPublicInputs },

        EVM_HONK_PROVE_OPTIONS

    );

    await api.destroy();

    return valid;

}


