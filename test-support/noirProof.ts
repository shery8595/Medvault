/**
 * Generate Noir attestation proofs for Hardhat tests (matches circuits/eligibility_proof).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { ethers } from "ethers";
import { poseidon3 } from "poseidon-lite";
import type { Identity } from "@semaphore-protocol/identity";
import type { PatientProfileValues } from "./fhe";
import { computeProfileCommitment } from "./profileCommitment";
import { deriveNullifier, semaphoreScopeField } from "./semaphore";
import { DEFAULT_TRIAL_PARAMS } from "./constants";
import type { TrialCriteriaFields } from "../src/lib/trialCriteriaNormalize";
import { normalizeTrialCriteria } from "../src/lib/trialCriteriaNormalize";

export const ELIGIBILITY_PUBLIC_INPUT_COUNT = 17;

export const BN254_FIELD_ORDER =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

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

export function buildEligibilityPublicInputs(
    trialId: bigint,
    nullifier: bigint,
    profileCommitment: bigint,
    resultHash: bigint,
    eligible: boolean,
    fheStageHandle: bigint | string,
    criteria: TrialCriteriaFields,
    options?: {
        criteriaMode?: 0 | 1;
        encryptedCriteriaBindingHash?: bigint;
    }
): `0x${string}`[] {
    const criteriaMode = options?.criteriaMode ?? 0;
    const bindingHash =
        criteriaMode === 1
            ? (options?.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER
            : 0n;

    return [
        fieldToBytes32(trialId),
        fieldToBytes32(nullifier),
        fieldToBytes32(profileCommitment),
        fieldToBytes32(resultHash),
        fieldToBytes32(eligible ? 1n : 0n),
        fieldToBytes32(fheStageHandleToField(fheStageHandle)),
        fieldToBytes32(RAW_SCHEMA_HASH % BN254_FIELD_ORDER),
        fieldToBytes32(criteriaMode === 1 ? bindingHash : BigInt(criteria.minAge)),
        fieldToBytes32(criteriaMode === 1 ? 0n : BigInt(criteria.maxAge)),
        fieldToBytes32(criteriaMode === 1 ? 0n : criteria.requiresDiabetes ? 1n : 0n),
        fieldToBytes32(criteriaMode === 1 ? 0n : BigInt(criteria.minHb)),
        fieldToBytes32(criteriaMode === 1 ? 0n : BigInt(criteria.genderRequirement)),
        fieldToBytes32(criteriaMode === 1 ? 0n : BigInt(criteria.minHeight)),
        fieldToBytes32(criteriaMode === 1 ? 0n : BigInt(criteria.maxWeight)),
        fieldToBytes32(criteriaMode === 1 ? 0n : criteria.requiresNonSmoker ? 1n : 0n),
        fieldToBytes32(criteriaMode === 1 ? 0n : criteria.requiresNormalBP ? 1n : 0n),
        fieldToBytes32(BigInt(criteriaMode)),
    ];
}

export type GeneratedEligibilityProof = {
    proofBytes: `0x${string}`;
    publicInputs: `0x${string}`[];
    eligible: boolean;
};

export async function generateTestEligibilityProof(params: {
    identity: Identity;
    commitment: bigint;
    trialId: bigint;
    profile: PatientProfileValues;
    criteria?: TrialCriteriaFields;
    eligible?: boolean;
    fheStageHandle: bigint | string;
    tamperStagedWitness?: boolean;
    criteriaMode?: 0 | 1;
    encryptedCriteriaBindingHash?: bigint;
}): Promise<GeneratedEligibilityProof> {
    const criteria = params.criteria ?? trialCriteriaFromDefaults();
    const criteriaMode = params.criteriaMode ?? 0;
    const bindingHash =
        criteriaMode === 1
            ? (params.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER
            : 0n;
    const scope = params.trialId;
    const scopeInternal = semaphoreScopeField(scope);
    const secret = params.identity.secretScalar;
    const nullifier = deriveNullifier(params.identity, scope);
    const profileCommitment = computeProfileCommitment(params.commitment, params.profile);

    const eligible = params.eligible ?? computeEligibleLocally(params.profile, criteria);
    const eligibleField = eligible ? 1n : 0n;
    const resultHash = poseidon3([eligibleField, scope, secret]);
    const fheStageField = fheStageHandleToField(params.fheStageHandle);
    const schemaField = RAW_SCHEMA_HASH % BN254_FIELD_ORDER;

    const circuit = JSON.parse(
        readFileSync(join(process.cwd(), "src/lib/circuits/eligibility_proof.json"), "utf8")
    );

    const { Barretenberg, UltraHonkBackend } = await import("@aztec/bb.js");
    const { Noir } = await import("@noir-lang/noir_js");

    const noirInputs: Record<string, string | boolean | number> = {
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
        staged_fhe_handle: (params.tamperStagedWitness
            ? ((fheStageField + 1n) % BN254_FIELD_ORDER)
            : fheStageField
        ).toString(),
        decrypted_eligible: eligibleField.toString(),
        criteria_binding_hash: bindingHash.toString(),
        scope: scope.toString(),
        nullifier: nullifier.toString(),
        profile_commitment: profileCommitment.toString(),
        result_hash: resultHash.toString(),
        eligible: eligibleField.toString(),
        fhe_stage_handle_hash: fheStageField.toString(),
        criteria_schema_hash: schemaField.toString(),
        min_age: criteriaMode === 1 ? bindingHash.toString() : criteria.minAge,
        max_age: criteriaMode === 1 ? 0 : criteria.maxAge,
        requires_diabetes: criteriaMode === 1 ? "0" : criteria.requiresDiabetes ? "1" : "0",
        min_hb: criteriaMode === 1 ? 0 : criteria.minHb,
        gender_requirement: criteriaMode === 1 ? 0 : criteria.genderRequirement,
        min_height: criteriaMode === 1 ? 0 : criteria.minHeight,
        max_weight: criteriaMode === 1 ? 0 : criteria.maxWeight,
        requires_non_smoker: criteriaMode === 1 ? "0" : criteria.requiresNonSmoker ? "1" : "0",
        requires_normal_bp: criteriaMode === 1 ? "0" : criteria.requiresNormalBP ? "1" : "0",
        criteria_mode: criteriaMode,
    };

    const proveOpts = { verifierTarget: "evm-no-zk" as const };
    const api = await Barretenberg.new({ threads: 1 });
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const noir = new Noir(circuit);
    const { witness } = await noir.execute(noirInputs);
    const { proof } = await backend.generateProof(witness, proveOpts);
    await api.destroy();

    const proofBytes = (`0x${Buffer.from(proof).toString("hex")}`) as `0x${string}`;
    const publicInputs = buildEligibilityPublicInputs(
        scope,
        nullifier,
        profileCommitment,
        resultHash,
        eligible,
        params.fheStageHandle,
        criteria,
        { criteriaMode, encryptedCriteriaBindingHash: bindingHash }
    );

    return { proofBytes, publicInputs, eligible };
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
