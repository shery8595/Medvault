/**
 * Generate Noir attestation proofs for Hardhat tests (eligibility_plaintext / eligibility_encrypted).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";
import { poseidon2, poseidon3 } from "poseidon-lite";
import type { Identity } from "@semaphore-protocol/identity";
import type { PatientProfileValues } from "./fhe";
import { computeProfileCommitment, defaultProfileSalt } from "./profileCommitment";
import { deriveNullifier, semaphoreScopeField } from "./semaphore";
import { DEFAULT_TRIAL_PARAMS } from "./constants";
import type { TrialCriteriaFields } from "../src/lib/trialCriteriaNormalize";
import { normalizeTrialCriteria } from "../src/lib/trialCriteriaNormalize";

export const ELIGIBILITY_PUBLIC_INPUT_COUNT = 25;
export const ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT = 15;

export const BN254_FIELD_ORDER =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export const DOC_SCHEMA_HASH = ethers.toBeHex(
    BigInt(ethers.keccak256(ethers.toUtf8Bytes("medvault.document.v1"))) % BN254_FIELD_ORDER,
    32
) as `0x${string}`;

const RAW_SCHEMA_HASH = BigInt(
    ethers.keccak256(ethers.toUtf8Bytes("medvault.eligibility.criteria.v1"))
);

export const CRITERIA_SCHEMA_HASH = ethers.toBeHex(
    RAW_SCHEMA_HASH % BN254_FIELD_ORDER,
    32
) as `0x${string}`;

export type { TrialCriteriaFields };

export function trialCriteriaFromDefaults(
    overrides: Partial<TrialCriteriaFields> = {}
): TrialCriteriaFields {
    return normalizeTrialCriteria({
        minAge: DEFAULT_TRIAL_PARAMS.minAge,
        maxAge: DEFAULT_TRIAL_PARAMS.maxAge,
        requiresDiabetes: DEFAULT_TRIAL_PARAMS.requiresDiabetes,
        minHb: DEFAULT_TRIAL_PARAMS.minHb,
        genderRequirement: DEFAULT_TRIAL_PARAMS.genderReq,
        minHeight: DEFAULT_TRIAL_PARAMS.minHeight,
        maxWeight: DEFAULT_TRIAL_PARAMS.maxWeight,
        requiresNonSmoker: DEFAULT_TRIAL_PARAMS.requiresNonSmoker,
        requiresNormalBP: DEFAULT_TRIAL_PARAMS.requiresNormalBP,
        ...overrides,
    });
}

function fieldToBytes32(value: bigint): `0x${string}` {
    return (`0x${value.toString(16).padStart(64, "0")}`) as `0x${string}`;
}

export function fheStageHandleToField(handle: bigint | string): bigint {
    const hex =
        typeof handle === "string"
            ? handle.startsWith("0x")
                ? handle
                : `0x${handle}`
            : ethers.toBeHex(handle, 32);
    return BigInt(hex) % BN254_FIELD_ORDER;
}

export type DocumentBindingFields = {
    hasDocument: boolean;
    docCidHash?: bigint;
    aesKeyCtHash?: bigint;
    aesKeyFheHandleHashes?: [bigint, bigint, bigint, bigint];
};

export function buildDocumentPublicInputs(binding?: DocumentBindingFields): `0x${string}`[] {
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
        DOC_SCHEMA_HASH,
        fieldToBytes32(1n),
    ];
}

export function buildEligibilityPublicInputs(
    trialId: bigint,
    nullifier: bigint,
    profileCommitment: bigint,
    resultHash: bigint,
    eligible: boolean,
    fheStageHandle: bigint | string,
    criteria: TrialCriteriaFields,
    options?: {
        documentBinding?: DocumentBindingFields;
    }
): `0x${string}`[] {
    return [
        fieldToBytes32(trialId),
        fieldToBytes32(nullifier),
        fieldToBytes32(profileCommitment),
        fieldToBytes32(resultHash),
        fieldToBytes32(eligible ? 1n : 0n),
        fieldToBytes32(fheStageHandleToField(fheStageHandle)),
        fieldToBytes32(RAW_SCHEMA_HASH % BN254_FIELD_ORDER),
        fieldToBytes32(BigInt(criteria.minAge)),
        fieldToBytes32(BigInt(criteria.maxAge)),
        fieldToBytes32(criteria.requiresDiabetes ? 1n : 0n),
        fieldToBytes32(BigInt(criteria.minHb)),
        fieldToBytes32(BigInt(criteria.genderRequirement)),
        fieldToBytes32(BigInt(criteria.minHeight)),
        fieldToBytes32(BigInt(criteria.maxWeight)),
        fieldToBytes32(criteria.requiresNonSmoker ? 1n : 0n),
        fieldToBytes32(criteria.requiresNormalBP ? 1n : 0n),
        fieldToBytes32(0n),
        ...buildDocumentPublicInputs(options?.documentBinding),
    ];
}

export function buildEncryptedEligibilityPublicInputs(
    trialId: bigint,
    nullifier: bigint,
    resultHash: bigint,
    fheStageHandle: bigint | string,
    encryptedCriteriaBindingHash: bigint,
    options?: {
        documentBinding?: DocumentBindingFields;
    }
): `0x${string}`[] {
    const bindingHash = encryptedCriteriaBindingHash % BN254_FIELD_ORDER;
    return [
        fieldToBytes32(trialId),
        fieldToBytes32(nullifier),
        fieldToBytes32(resultHash),
        fieldToBytes32(fheStageHandleToField(fheStageHandle)),
        fieldToBytes32(RAW_SCHEMA_HASH % BN254_FIELD_ORDER),
        fieldToBytes32(bindingHash),
        fieldToBytes32(1n),
        ...buildDocumentPublicInputs(options?.documentBinding),
    ];
}

export type GeneratedEligibilityProof = {
    proofBytes: `0x${string}`;
    publicInputs: `0x${string}`[];
    eligible: boolean;
};

async function proveCircuit(
    circuitPath: string,
    noirInputs: Record<string, string | boolean | number>
): Promise<`0x${string}`> {
    const circuit = JSON.parse(readFileSync(circuitPath, "utf8"));
    const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
    const { Noir } = await import("@noir-lang/noir_js");
    const proveOpts = { verifierTarget: "evm-no-zk" as const };
    const api = await Barretenberg.new({ threads: 1 });
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const noir = new Noir(circuit);
    const { witness } = await noir.execute(noirInputs);
    const { proof } = await backend.generateProof(witness, proveOpts);
    await api.destroy();
    return (`0x${Buffer.from(proof).toString("hex")}`) as `0x${string}`;
}

export async function generateTestEligibilityProof(params: {
    identity: Identity;
    commitment: bigint;
    trialId: bigint;
    profile: PatientProfileValues;
    criteria?: TrialCriteriaFields;
    profileSalt?: bigint;
    eligible?: boolean;
    fheStageHandle: bigint | string;
    tamperStagedWitness?: boolean;
    documentBinding?: DocumentBindingFields;
}): Promise<GeneratedEligibilityProof> {
    const criteria = params.criteria ?? trialCriteriaFromDefaults();
    const docBinding = params.documentBinding;
    const docChunkFields: [bigint, bigint, bigint, bigint] = docBinding?.hasDocument
        ? (docBinding.aesKeyFheHandleHashes ?? [0n, 0n, 0n, 0n]).map(
              (h) => h % BN254_FIELD_ORDER
          ) as [bigint, bigint, bigint, bigint]
        : [0n, 0n, 0n, 0n];
    const docCidField = docBinding?.hasDocument
        ? (docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER
        : 0n;
    const aesCtField = docBinding?.hasDocument
        ? (docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER
        : 0n;
    const scope = params.trialId;
    const scopeInternal = semaphoreScopeField(scope);
    const secret = params.identity.secretScalar;
    const nullifier = deriveNullifier(params.identity, scope);
    const profileSalt =
        params.profileSalt ?? (await defaultProfileSalt(params.commitment));
    const profileCommitment = computeProfileCommitment(params.commitment, params.profile, profileSalt);

    const eligible = params.eligible ?? computeEligibleLocally(params.profile, criteria);
    const eligibleField = eligible ? 1n : 0n;
    const resultHash = poseidon3([eligibleField, scope, secret]);
    const fheStageField = fheStageHandleToField(params.fheStageHandle);
    const schemaField = RAW_SCHEMA_HASH % BN254_FIELD_ORDER;

    const circuitPath = join(process.cwd(), "src/lib/circuits/eligibility_plaintext.json");
    const proofBytes = await proveCircuit(circuitPath, {
        secret: secret.toString(),
        scope_internal: scopeInternal.toString(),
        commitment: params.commitment.toString(),
        age: params.profile.age,
        gender: params.profile.gender,
        weight: params.profile.weight,
        height: params.profile.height,
        has_diabetes: params.profile.hasDiabetes,
        hb_level: params.profile.hbLevel,
        is_smoker: params.profile.isSmoker,
        has_hypertension: params.profile.hasHypertension,
        profile_salt: (profileSalt % BN254_FIELD_ORDER).toString(),
        staged_fhe_handle: (params.tamperStagedWitness
            ? ((fheStageField + 1n) % BN254_FIELD_ORDER)
            : fheStageField
        ).toString(),
        staged_aes_key_chunk_0: docChunkFields[0].toString(),
        staged_aes_key_chunk_1: docChunkFields[1].toString(),
        staged_aes_key_chunk_2: docChunkFields[2].toString(),
        staged_aes_key_chunk_3: docChunkFields[3].toString(),
        doc_cid_hash_witness: docCidField.toString(),
        aes_key_ct_hash_witness: aesCtField.toString(),
        scope: scope.toString(),
        nullifier: nullifier.toString(),
        profile_commitment: profileCommitment.toString(),
        result_hash: resultHash.toString(),
        eligible: eligibleField.toString(),
        fhe_stage_handle_hash: fheStageField.toString(),
        criteria_schema_hash: schemaField.toString(),
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
        doc_cid_hash: docCidField.toString(),
        aes_key_ct_hash: aesCtField.toString(),
        aes_key_fhe_handle_hash_0: docChunkFields[0].toString(),
        aes_key_fhe_handle_hash_1: docChunkFields[1].toString(),
        aes_key_fhe_handle_hash_2: docChunkFields[2].toString(),
        aes_key_fhe_handle_hash_3: docChunkFields[3].toString(),
        doc_schema_hash: docBinding?.hasDocument
            ? (BigInt(DOC_SCHEMA_HASH) % BN254_FIELD_ORDER).toString()
            : "0",
        has_document: docBinding?.hasDocument ? "1" : "0",
    });

    const publicInputs = buildEligibilityPublicInputs(
        scope,
        nullifier,
        profileCommitment,
        resultHash,
        eligible,
        params.fheStageHandle,
        criteria,
        { documentBinding: docBinding }
    );

    return { proofBytes, publicInputs, eligible };
}

export async function generateTestEncryptedEligibilityProof(params: {
    identity: Identity;
    trialId: bigint;
    fheStageHandle: bigint | string;
    encryptedCriteriaBindingHash?: bigint;
    tamperStagedWitness?: boolean;
    documentBinding?: DocumentBindingFields;
}): Promise<Omit<GeneratedEligibilityProof, "eligible">> {
    const docBinding = params.documentBinding;
    const docChunkFields: [bigint, bigint, bigint, bigint] = docBinding?.hasDocument
        ? (docBinding.aesKeyFheHandleHashes ?? [0n, 0n, 0n, 0n]).map(
              (h) => h % BN254_FIELD_ORDER
          ) as [bigint, bigint, bigint, bigint]
        : [0n, 0n, 0n, 0n];
    const docCidField = docBinding?.hasDocument
        ? (docBinding.docCidHash ?? 0n) % BN254_FIELD_ORDER
        : 0n;
    const aesCtField = docBinding?.hasDocument
        ? (docBinding.aesKeyCtHash ?? 0n) % BN254_FIELD_ORDER
        : 0n;

    const scope = params.trialId;
    const scopeInternal = semaphoreScopeField(scope);
    const secret = params.identity.secretScalar;
    const nullifier = deriveNullifier(params.identity, scope);
    const resultHash = poseidon2([scope, secret]);
    const fheStageField = fheStageHandleToField(params.fheStageHandle);
    const schemaField = RAW_SCHEMA_HASH % BN254_FIELD_ORDER;
    const bindingHash = (params.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER;

    const circuitPath = join(process.cwd(), "src/lib/circuits/eligibility_encrypted.json");
    const proofBytes = await proveCircuit(circuitPath, {
        secret: secret.toString(),
        scope_internal: scopeInternal.toString(),
        staged_fhe_handle: (params.tamperStagedWitness
            ? ((fheStageField + 1n) % BN254_FIELD_ORDER)
            : fheStageField
        ).toString(),
        staged_aes_key_chunk_0: docChunkFields[0].toString(),
        staged_aes_key_chunk_1: docChunkFields[1].toString(),
        staged_aes_key_chunk_2: docChunkFields[2].toString(),
        staged_aes_key_chunk_3: docChunkFields[3].toString(),
        doc_cid_hash_witness: docCidField.toString(),
        aes_key_ct_hash_witness: aesCtField.toString(),
        scope: scope.toString(),
        nullifier: nullifier.toString(),
        result_hash: resultHash.toString(),
        fhe_stage_handle_hash: fheStageField.toString(),
        criteria_schema_hash: schemaField.toString(),
        criteria_binding_hash: bindingHash.toString(),
        criteria_mode: 1,
        doc_cid_hash: docCidField.toString(),
        aes_key_ct_hash: aesCtField.toString(),
        aes_key_fhe_handle_hash_0: docChunkFields[0].toString(),
        aes_key_fhe_handle_hash_1: docChunkFields[1].toString(),
        aes_key_fhe_handle_hash_2: docChunkFields[2].toString(),
        aes_key_fhe_handle_hash_3: docChunkFields[3].toString(),
        doc_schema_hash: docBinding?.hasDocument
            ? (BigInt(DOC_SCHEMA_HASH) % BN254_FIELD_ORDER).toString()
            : "0",
        has_document: docBinding?.hasDocument ? "1" : "0",
    });

    const publicInputs = buildEncryptedEligibilityPublicInputs(
        scope,
        nullifier,
        resultHash,
        params.fheStageHandle,
        bindingHash,
        { documentBinding: docBinding }
    );

    return { proofBytes, publicInputs };
}

export function computeEligibleLocally(profile: PatientProfileValues, c: TrialCriteriaFields): boolean {
    const ageOk = profile.age >= c.minAge && profile.age <= c.maxAge;
    const diabetesOk = c.requiresDiabetes ? profile.hasDiabetes : true;
    const hbOk = profile.hbLevel >= c.minHb;
    const genderOk =
        c.genderRequirement === 1
            ? profile.gender
            : c.genderRequirement === 2
              ? !profile.gender
              : true;
    const heightOk = c.minHeight > 0 ? profile.height >= c.minHeight : true;
    const weightOk = c.maxWeight > 0 ? profile.weight <= c.maxWeight : true;
    const smokingOk = c.requiresNonSmoker ? !profile.isSmoker : true;
    const bpOk = c.requiresNormalBP ? !profile.hasHypertension : true;
    return ageOk && diabetesOk && hbOk && genderOk && heightOk && weightOk && smokingOk && bpOk;
}
