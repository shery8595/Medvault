import { poseidon3 } from "poseidon-lite";
import type { PatientProfileValues } from "./fhe";

/** Chained Poseidon3 profile commitment — must match circuits/eligibility_proof/src/main.nr */
export function computeProfileCommitment(
    commitment: bigint,
    profile: PatientProfileValues
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
    return poseidon3([left, mid, right]);
}
