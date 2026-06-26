/**

 * MedVault Noir integration — browser UltraHonk proofs for HonkVerifier.sol (EVM / Keccak).

 * Noir is the public attestation seal; Zama FHE remains the compute authority.

 */



import { ethers } from "ethers";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";

import { Noir } from "@noir-lang/noir_js";

import { Identity } from "@semaphore-protocol/identity";

import { poseidon3 } from "poseidon-lite";

import { fieldFromBytes32, parseFieldElement } from "./field";

import { ensureNoirWasmInitialized } from "./noirInit";

import { computeProfileCommitment, type PatientProfilePlain } from "./profileCommitment";

import { getAnonymousNullifier, semaphoreScopeField } from "./semaphore";

import { criteriaSchemaHashField, fheStageHandleToField, normalizeFheHandle, BN254_FIELD_ORDER } from "./criteriaSchema";



export const ELIGIBILITY_PUBLIC_INPUT_COUNT = 17;



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



export interface EligibilityProofInputs {

    secret: bigint;

    commitment: bigint;

    eligibilityResult: boolean;

    scope: bigint;

    nullifier: bigint;

    scopeInternal: bigint;

    profileCommitment: bigint;

    resultHash: bigint;

    fheStageHandleHash: bigint;

    criteriaSchemaHash: bigint;

    criteria: TrialCriteriaPlain;

    criteriaMode: 0 | 1;

    encryptedCriteriaBindingHash?: bigint;

}



export interface EligibilityProofData {

    proofBytes: `0x${string}`;

    publicInputs: `0x${string}`[];

    inputs: EligibilityProofInputs;

}



type CompiledCircuit = { bytecode: string };



let _compiledCircuit: CompiledCircuit | null = null;



export async function loadCircuit(): Promise<CompiledCircuit> {

    if (_compiledCircuit) return _compiledCircuit;

    const circuit = await import("./circuits/eligibility_proof.json");

    _compiledCircuit = (circuit.default ?? circuit) as CompiledCircuit;

    if (!_compiledCircuit.bytecode) {

        throw new Error("Circuit artifact missing bytecode. Run `npm run build:circuit`.");

    }

    return _compiledCircuit;

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

    }

): EligibilityProofInputs {

    const secret = identity.secretScalar;

    const scope = trialId;

    const scopeInternal = semaphoreScopeField(trialId);

    const nullifier = getAnonymousNullifier(trialId) ?? 0n;

    const profileCommitment = computeProfileCommitment(commitment, profile);

    const eligibleField = eligible ? 1n : 0n;

    const resultHash = poseidon3([eligibleField, scope, secret]);

    return {

        secret,

        commitment,

        eligibilityResult: eligible,

        scope,

        nullifier,

        scopeInternal,

        profileCommitment,

        resultHash,

        fheStageHandleHash: fheStageHandleToField(fheStageHandle),

        criteriaSchemaHash: criteriaSchemaHashField(),

        criteria,

        criteriaMode: options?.criteriaMode ?? 0,

        encryptedCriteriaBindingHash: options?.encryptedCriteriaBindingHash,

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

    }

): Promise<EligibilityProofData> {

    await ensureNoirWasmInitialized();



    const storedNullifier = getAnonymousNullifier(trialId);

    if (storedNullifier === null) {

        throw new Error(

            `No stored Semaphore nullifier for trial ${trialId}. Apply to the trial before sealing.`

        );

    }



    const compiledCircuit = await loadCircuit();

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



    const criteriaMode = inputs.criteriaMode;
    const bindingHash =
        criteriaMode === 1
            ? (inputs.encryptedCriteriaBindingHash ?? 0n) % BN254_FIELD_ORDER
            : 0n;

    const noirInputs: Record<string, string | boolean | number> = {

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

        staged_fhe_handle: inputs.fheStageHandleHash.toString(),

        decrypted_eligible: eligibleResult ? "1" : "0",

        criteria_binding_hash: bindingHash.toString(),

        scope: inputs.scope.toString(),

        nullifier: inputs.nullifier.toString(),

        profile_commitment: inputs.profileCommitment.toString(),

        result_hash: inputs.resultHash.toString(),

        eligible: eligibleResult ? "1" : "0",

        fhe_stage_handle_hash: inputs.fheStageHandleHash.toString(),

        criteria_schema_hash: inputs.criteriaSchemaHash.toString(),

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



    const api = await Barretenberg.new({ threads: 4 });

    const backend = new UltraHonkBackend(compiledCircuit.bytecode, api);

    const noir = new Noir(compiledCircuit as object);



    const { witness } = await noir.execute(noirInputs);

    const { proof, publicInputs: rawPublicInputs } = await backend.generateProof(

        witness,

        EVM_HONK_PROVE_OPTIONS

    );



    const solidityPublicInputs = buildContractPublicInputs(inputs);

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

    const expected = buildContractPublicInputs(inputs).map((pi) => parseFieldElement(pi));

    const actual = rawPublicInputs.map((pi) => parseFieldElement(pi));

    if (actual.length !== ELIGIBILITY_PUBLIC_INPUT_COUNT) {

        throw new Error(

            `Expected ${ELIGIBILITY_PUBLIC_INPUT_COUNT} public inputs, got ${actual.length}.`

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


