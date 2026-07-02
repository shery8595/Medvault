import { ethers } from "ethers";
import { poseidon3 } from "poseidon-lite";
import type { PatientProfileValues } from "./fhe";

export type PatientProfilePlain = PatientProfileValues;

export const BN254_FIELD_ORDER =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/** High-entropy salt for production registration (not the deterministic test salt). */
export function randomProfileSalt(): bigint {
    const bytes = ethers.randomBytes(32);
    const raw = BigInt(ethers.hexlify(bytes)) % BN254_FIELD_ORDER;
    return raw === 0n ? 1n : raw;
}

export function profileSaltCommitment(profileSalt: bigint): `0x${string}` {
    return ethers.keccak256(ethers.solidityPacked(["uint256"], [profileSalt]));
}

/** Chained salted Poseidon3 profile commitment — must match circuits/eligibility_plaintext + on-chain library. */
export function computeProfileCommitment(
    commitment: bigint,
    profile: PatientProfileValues,
    profileSalt: bigint
): bigint {
    const a = BigInt(profile.age);
    const g = profile.gender ? 1n : 0n;
    const w = BigInt(profile.weight);
    const h = BigInt(profile.height);
    const d = profile.hasDiabetes ? 1n : 0n;
    const hb = BigInt(profile.hbLevel);
    const s = profile.isSmoker ? 1n : 0n;
    const bp = profile.hasHypertension ? 1n : 0n;
    const left = poseidon3([commitment, a, g]);
    const mid = poseidon3([w, h, d]);
    const right = poseidon3([hb, s, bp]);
    const saltedRight = poseidon3([right, profileSalt, 0n]);
    return poseidon3([left, mid, saltedRight]);
}
