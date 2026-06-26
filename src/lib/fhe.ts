import type { Signer, Provider } from "ethers";
import { ethers } from "ethers";
import {
    indexedDBStorage,
    memoryStorage,
    SigningRejectedError,
    ZamaSDK,
    type Address,
    type ClearValue,
    type EncryptedValue,
    type ZamaConfig,
} from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/ethers";
import { web } from "@zama-fhe/sdk/web";
import { buildZamaFheChain } from "./zamaChain";

/** Back-compat alias for patient profile / eligibility decrypt helpers. */
export const FheTypes = {
    Bool: "ebool",
    Uint8: "euint8",
    Uint16: "euint16",
    Uint32: "euint32",
    Uint64: "euint64",
} as const;

export type FheTypeName = (typeof FheTypes)[keyof typeof FheTypes];

export type ZamaEncryptField = {
    handle: `0x${string}`;
    inputProof: `0x${string}`;
};

let mainSdk: ZamaSDK | null = null;

export function setMainZamaSDK(sdk: ZamaSDK | null): void {
    mainSdk = sdk;
}

export function getZamaSDK(): ZamaSDK {
    if (!mainSdk) {
        throw new Error("Zama SDK not ready — connect wallet and wait for FHE initialization.");
    }
    return mainSdk;
}

/** @deprecated Use getZamaSDK() */
export function getFHEClient(): ZamaSDK {
    return getZamaSDK();
}

/** @deprecated Use getZamaSDK() */
export function getFHEInstance(): ZamaSDK {
    return getZamaSDK();
}

export function resetZamaSDK(): void {
    mainSdk = null;
}

/** @deprecated Use resetZamaSDK() */
export function resetFheClient(): void {
    resetZamaSDK();
}

function createConfigForSigner(signer: Signer, storage = indexedDBStorage): ZamaConfig {
    const chain = buildZamaFheChain();
    return createConfig({
        chains: [chain],
        signer,
        relayers: { [chain.id]: web() },
        storage,
    });
}

function createEphemeralZamaSDK(signer: Signer): ZamaSDK {
    return new ZamaSDK(createConfigForSigner(signer, memoryStorage));
}

/** Isolated SDK bound to a Semaphore-derived ephemeral signer (memory storage, disposed after use). */
export function createStandaloneZamaSDK(signer: Signer): ZamaSDK {
    return createEphemeralZamaSDK(signer);
}

/** Run a callback with a short-lived ephemeral SDK; always disposes on exit. */
export async function withEphemeralZamaSDK<T>(
    ephemeralSigner: Signer,
    fn: (sdk: ZamaSDK) => Promise<T>
): Promise<T> {
    const sdk = createEphemeralZamaSDK(ephemeralSigner);
    try {
        return await fn(sdk);
    } finally {
        sdk.dispose();
    }
}

/** Ensure the React-managed main SDK is available (no-op when ZamaSDKProvider is active). */
export async function ensureZamaConnected(_provider: Provider, _signer: Signer): Promise<void> {
    getZamaSDK();
}

/** @deprecated Use ensureZamaConnected */
export async function ensureFHEConnected(provider: Provider, signer: Signer): Promise<void> {
    await ensureZamaConnected(provider, signer);
}

function mainSdkOrThrow(): ZamaSDK {
    return getZamaSDK();
}

function toHandleHex(value: bigint | string | unknown): `0x${string}` {
    if (typeof value === "string") {
        if (value.startsWith("0x")) return value as `0x${string}`;
        return ethers.toBeHex(BigInt(value), 32) as `0x${string}`;
    }
    if (typeof value === "bigint") {
        return ethers.toBeHex(value, 32) as `0x${string}`;
    }
    throw new Error(`Cannot coerce FHE handle: ${String(value)}`);
}

function fieldFromEncrypt(
    encryptedValues: EncryptedValue[],
    inputProof: `0x${string}`,
    index: number
): ZamaEncryptField {
    return {
        handle: encryptedValues[index]!,
        inputProof,
    };
}

export function yieldToMain(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        } else {
            setTimeout(resolve, 0);
        }
    });
}

export async function buildSponsorCriteriaInputs(
    contractAddress: string,
    userAddress: string,
    criteria: {
        minAge: number;
        maxAge: number;
        requiresDiabetes: boolean;
        minHb: number;
        genderRequirement: number;
        minHeight: number;
        maxWeight: number;
        requiresNonSmoker: boolean;
        requiresNormalBP: boolean;
    }
) {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [
            { value: BigInt(criteria.minAge), type: "euint8" },
            { value: BigInt(criteria.maxAge), type: "euint8" },
            { value: criteria.requiresDiabetes, type: "ebool" },
            { value: BigInt(criteria.minHb), type: "euint16" },
            { value: BigInt(criteria.genderRequirement), type: "euint8" },
            { value: BigInt(criteria.minHeight), type: "euint8" },
            { value: BigInt(criteria.maxWeight), type: "euint16" },
            { value: criteria.requiresNonSmoker, type: "ebool" },
            { value: criteria.requiresNormalBP, type: "ebool" },
        ],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    const field = (i: number) => fieldFromEncrypt(encryptedValues, inputProof, i);
    return {
        minAge: field(0),
        maxAge: field(1),
        requiresDiabetes: field(2),
        minHb: field(3),
        genderRequirement: field(4),
        minHeight: field(5),
        maxWeight: field(6),
        requiresNonSmoker: field(7),
        requiresNormalBP: field(8),
        inputProof,
    };
}

export async function encryptUint8(
    contractAddress: string,
    userAddress: string,
    value: number
): Promise<ZamaEncryptField> {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [{ value: BigInt(value), type: "euint8" }],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    return fieldFromEncrypt(encryptedValues, inputProof, 0);
}

export async function encryptUint16(
    contractAddress: string,
    userAddress: string,
    value: number
): Promise<ZamaEncryptField> {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [{ value: BigInt(value), type: "euint16" }],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    return fieldFromEncrypt(encryptedValues, inputProof, 0);
}

export async function encryptUint64(
    contractAddress: string,
    userAddress: string,
    value: number | bigint
): Promise<ZamaEncryptField> {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [{ value: BigInt(value), type: "euint64" }],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    return fieldFromEncrypt(encryptedValues, inputProof, 0);
}

export async function encryptBool(
    contractAddress: string,
    userAddress: string,
    value: boolean
): Promise<ZamaEncryptField> {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [{ value, type: "ebool" }],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    return fieldFromEncrypt(encryptedValues, inputProof, 0);
}

export type PatientProfileValues = {
    age: number;
    gender: boolean;
    weight: number;
    height: number;
    hasDiabetes: boolean;
    hbLevel: number;
    isSmoker: boolean;
    hasHypertension: boolean;
};

/** Batch-encrypt a patient profile (APR contract, MVR as FHE user for delegated register). */
export async function buildPatientProfileInputs(
    contractAddress: string,
    userAddress: string,
    values: PatientProfileValues
) {
    const sdk = mainSdkOrThrow();
    const { encryptedValues, inputProof } = await sdk.encrypt({
        values: [
            { value: BigInt(values.age), type: "euint8" },
            { value: values.gender, type: "ebool" },
            { value: BigInt(values.weight), type: "euint16" },
            { value: BigInt(values.height), type: "euint8" },
            { value: values.hasDiabetes, type: "ebool" },
            { value: BigInt(values.hbLevel), type: "euint16" },
            { value: values.isSmoker, type: "ebool" },
            { value: values.hasHypertension, type: "ebool" },
        ],
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
    });
    const [age, gender, weight, height, hasDiabetes, hbLevel, isSmoker, hasHypertension] =
        encryptedValues.map((_, i) => fieldFromEncrypt(encryptedValues, inputProof, i));
    return {
        age,
        gender,
        weight,
        height,
        hasDiabetes,
        hbLevel,
        isSmoker,
        hasHypertension,
        inputProof,
    };
}

async function userDecryptOneWithSdk(
    sdk: ZamaSDK,
    contractAddress: string,
    handle: `0x${string}`
): Promise<ClearValue> {
    await sdk.permits.grantPermit([contractAddress as Address]);
    const values = await sdk.decryption.decryptValues([
        { encryptedValue: handle, contractAddress: contractAddress as Address },
    ]);
    return values[handle]!;
}

async function userDecryptOne(
    contractAddress: string,
    handle: `0x${string}`
): Promise<ClearValue> {
    return userDecryptOneWithSdk(mainSdkOrThrow(), contractAddress, handle);
}

export async function decryptForView(
    ctHash: bigint | string,
    _utype: FheTypeName,
    contractAddress: string
): Promise<ClearValue> {
    return userDecryptOne(contractAddress, toHandleHex(ctHash));
}

/** User-decrypt with a Semaphore-derived ephemeral signer (isolated SDK, no main-session swap). */
export async function decryptForViewWithEphemeral(
    ephemeralSigner: Signer,
    ctHash: bigint | string,
    utype: FheTypeName,
    contractAddress: string
): Promise<ClearValue> {
    return withEphemeralZamaSDK(ephemeralSigner, (sdk) =>
        userDecryptOneWithSdk(sdk, contractAddress, toHandleHex(ctHash))
    );
}

export async function reencryptUint8(contractAddress: string, _userAddress: string, handle: string) {
    return decryptForView(handle, FheTypes.Uint8, contractAddress);
}

export async function reencryptUint8WithEphemeral(
    ephemeralSigner: Signer,
    contractAddress: string,
    handle: string
) {
    return decryptForViewWithEphemeral(ephemeralSigner, handle, FheTypes.Uint8, contractAddress);
}

export async function reencryptUint32(contractAddress: string, _userAddress: string, handle: string) {
    return decryptForView(handle, FheTypes.Uint32, contractAddress);
}

export async function reencryptUint64(contractAddress: string, _userAddress: string, handle: string) {
    return decryptForView(handle, FheTypes.Uint64, contractAddress);
}

export async function reencryptUint64WithEphemeral(
    ephemeralSigner: Signer,
    contractAddress: string,
    handle: string
) {
    return decryptForViewWithEphemeral(ephemeralSigner, handle, FheTypes.Uint64, contractAddress);
}

/** KMS public decrypt for handles marked `makePubliclyDecryptable` on-chain. */
export async function publicDecrypt(ctHash: bigint | string) {
    const sdk = mainSdkOrThrow();
    const handle = toHandleHex(ctHash);
    const result = await sdk.decryption.decryptPublicValues([handle]);
    const first = Object.values(result.clearValues)[0];
    return {
        value: typeof first === "boolean" ? (first ? 1n : 0n) : BigInt(first as bigint | number | string),
        cleartexts: result.abiEncodedClearValues,
        proof: result.decryptionProof,
    };
}

export function isZamaUserRejection(err: unknown): boolean {
    return err instanceof SigningRejectedError;
}

export interface EncryptedPatientData {
    age: string;
    gender: string;
    weight: string;
    height: string;
    hasDiabetes: string;
    hbLevel: string;
    isSmoker: string;
    hasHypertension: string;
}

export interface DecryptedPatientData {
    age: number;
    gender: boolean;
    weight: number;
    height: number;
    hasDiabetes: boolean;
    hbLevel: number;
    isSmoker: boolean;
    hasHypertension: boolean;
}

async function decryptPatientProfileWithSdk(
    sdk: ZamaSDK,
    encryptedData: EncryptedPatientData,
    contractAddress: string
): Promise<DecryptedPatientData> {
    await sdk.permits.grantPermit([contractAddress as Address]);
    const inputs = [
        { encryptedValue: toHandleHex(encryptedData.age), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.gender), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.weight), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.height), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.hasDiabetes), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.hbLevel), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.isSmoker), contractAddress: contractAddress as Address },
        { encryptedValue: toHandleHex(encryptedData.hasHypertension), contractAddress: contractAddress as Address },
    ];
    const values = await sdk.decryption.decryptValues(inputs);
    const pick = (h: string) => values[toHandleHex(h)]!;

    return {
        age: Number(pick(encryptedData.age)),
        gender: Boolean(pick(encryptedData.gender)),
        weight: Number(pick(encryptedData.weight)),
        height: Number(pick(encryptedData.height)),
        hasDiabetes: Boolean(pick(encryptedData.hasDiabetes)),
        hbLevel: Number(pick(encryptedData.hbLevel)),
        isSmoker: Boolean(pick(encryptedData.isSmoker)),
        hasHypertension: Boolean(pick(encryptedData.hasHypertension)),
    };
}

export async function decryptPatientProfile(
    encryptedData: EncryptedPatientData,
    contractAddress: string
): Promise<DecryptedPatientData> {
    return decryptPatientProfileWithSdk(mainSdkOrThrow(), encryptedData, contractAddress);
}

/** Decrypt a patient profile using the Semaphore-derived ephemeral permit holder. */
export async function decryptPatientProfileWithEphemeral(
    ephemeralSigner: Signer,
    encryptedData: EncryptedPatientData,
    contractAddress: string
): Promise<DecryptedPatientData> {
    return withEphemeralZamaSDK(ephemeralSigner, (sdk) =>
        decryptPatientProfileWithSdk(sdk, encryptedData, contractAddress)
    );
}

export function toHex(bytes: Uint8Array | string) {
    if (typeof bytes === "string") {
        return bytes.startsWith("0x") ? bytes : "0x" + bytes;
    }
    return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
