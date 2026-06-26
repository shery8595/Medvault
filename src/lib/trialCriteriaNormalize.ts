/** Shared trial criteria shape for Zama FHE, Noir attestation, and contract checks. */
export type TrialCriteriaFields = {
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

type ChainTrialLike = {
    minAge: bigint | number;
    maxAge: bigint | number;
    requiresDiabetes: boolean;
    minHb: bigint | number;
    genderRequirement: bigint | number;
    minHeight: bigint | number;
    maxWeight: bigint | number;
    requiresNonSmoker: boolean;
    requiresNormalBP: boolean;
};

/** Normalize on-chain TrialManager fields to the attestation/FHE criteria schema. */
export function normalizeTrialCriteria(trial: ChainTrialLike): TrialCriteriaFields {
    return {
        minAge: Number(trial.minAge),
        maxAge: Number(trial.maxAge),
        requiresDiabetes: Boolean(trial.requiresDiabetes),
        minHb: Number(trial.minHb),
        genderRequirement: Number(trial.genderRequirement),
        minHeight: Number(trial.minHeight),
        maxWeight: Number(trial.maxWeight),
        requiresNonSmoker: Boolean(trial.requiresNonSmoker),
        requiresNormalBP: Boolean(trial.requiresNormalBP),
    };
}
