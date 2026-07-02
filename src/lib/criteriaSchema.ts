import { ethers } from "ethers";

/** Versioned criteria schema — must match EligibilityEngine.CRITERIA_SCHEMA_HASH. */
export const CRITERIA_SCHEMA_ID = "medvault.eligibility.criteria.v1";

export const BN254_FIELD_ORDER =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const RAW_SCHEMA_HASH = BigInt(ethers.keccak256(ethers.toUtf8Bytes(CRITERIA_SCHEMA_ID)));

export const CRITERIA_SCHEMA_HASH = ethers.toBeHex(
    RAW_SCHEMA_HASH % BN254_FIELD_ORDER,
    32
) as `0x${string}`;

export function criteriaSchemaHashField(): bigint {
    return RAW_SCHEMA_HASH % BN254_FIELD_ORDER;
}

/** Versioned document schema — must match EligibilityEngine.DOC_SCHEMA_HASH. */
export const DOC_SCHEMA_ID = "medvault.document.v1";

const RAW_DOC_SCHEMA_HASH = BigInt(ethers.keccak256(ethers.toUtf8Bytes(DOC_SCHEMA_ID)));

export const DOC_SCHEMA_HASH = ethers.toBeHex(
    RAW_DOC_SCHEMA_HASH % BN254_FIELD_ORDER,
    32
) as `0x${string}`;

export function docSchemaHashField(): bigint {
    return RAW_DOC_SCHEMA_HASH % BN254_FIELD_ORDER;
}

/** Map a staged Zama FHE ebool handle (bytes32) to the BN254 public input field. */
export function fheStageHandleToField(handle: bigint | string): bigint {
    const hex =
        typeof handle === "string"
            ? handle.startsWith("0x")
                ? handle
                : `0x${handle}`
            : ethers.toBeHex(handle, 32);
    return BigInt(hex) % BN254_FIELD_ORDER;
}

/** Normalize ethers / FHE SDK return values to a bytes32 handle. */
export function normalizeFheHandle(value: unknown): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    if (typeof value === "string") return BigInt(value);
    if (Array.isArray(value) && value.length > 0) {
        return normalizeFheHandle(value[0]);
    }
    if (value && typeof value === "object") {
        const o = value as Record<string, unknown>;
        if (o.data != null) return normalizeFheHandle(o.data);
        if (o.hash != null) return normalizeFheHandle(o.hash);
        if (o.handle != null) return normalizeFheHandle(o.handle);
    }
    return 0n;
}
