import { FhevmType } from "@fhevm/mock-utils";
import hre from "hardhat";
import { ethers } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";
import type { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/node";

/** Zama fhEVM encrypted field: external handle + shared inputProof from one `encrypt()` batch. */
export type ZamaEncryptedField = {
    handle: `0x${string}`;
    inputProof: `0x${string}`;
    /** Back-compat: bigint handle for `coerceFheHandle`. */
    ctHash: bigint;
    /** Back-compat alias for `inputProof`. */
    signature: string;
    proof: string;
};

/** @deprecated Renamed to `ZamaEncryptedField` — kept for existing tests. */
export type InEInput = ZamaEncryptedField;

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

export function assertFhevmMock(): void {
    if (!hre.fhevm?.isMock) {
        throw new Error("Expected hre.fhevm.isMock === true — run tests on the Hardhat FHE mock network");
    }
}

function bytes32Hex(value: Uint8Array): `0x${string}` {
    return ethers.hexlify(value) as `0x${string}`;
}

function fieldFromBatch(handle: Uint8Array, inputProof: Uint8Array): ZamaEncryptedField {
    const handleHex = bytes32Hex(handle);
    const proofHex = ethers.hexlify(inputProof) as `0x${string}`;
    return {
        handle: handleHex,
        inputProof: proofHex,
        ctHash: BigInt(handleHex),
        signature: proofHex,
        proof: proofHex,
    };
}

async function encryptBatch(
    contractAddress: string,
    userAddress: string,
    build: (input: RelayerEncryptedInput) => void
): Promise<{ fields: ZamaEncryptedField[]; inputProof: `0x${string}` }> {
    assertFhevmMock();
    const input = hre.fhevm.createEncryptedInput(contractAddress, userAddress);
    build(input);
    const { handles, inputProof } = await input.encrypt();
    const proofHex = ethers.hexlify(inputProof) as `0x${string}`;
    const fields = handles.map((h) => fieldFromBatch(h, inputProof));
    for (const f of fields) {
        f.inputProof = proofHex;
        f.signature = proofHex;
        f.proof = proofHex;
    }
    return { fields, inputProof: proofHex };
}

export async function createEncryptedUint8(
    proofAccount: string,
    signerAddress: string,
    value: number
): Promise<ZamaEncryptedField> {
    const { fields } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.add8(value);
    });
    return fields[0]!;
}

export async function createEncryptedUint16(
    proofAccount: string,
    signerAddress: string,
    value: number
): Promise<ZamaEncryptedField> {
    const { fields } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.add16(value);
    });
    return fields[0]!;
}

export async function createEncryptedUint64(
    proofAccount: string,
    signerAddress: string,
    value: number | bigint
): Promise<ZamaEncryptedField> {
    const { fields } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.add64(value);
    });
    return fields[0]!;
}

export async function createEncryptedBool(
    proofAccount: string,
    signerAddress: string,
    value: boolean
): Promise<ZamaEncryptedField> {
    const { fields } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.addBool(value);
    });
    return fields[0]!;
}

export async function buildPatientProfileInputs(
    proofAccount: string,
    signerAddress: string,
    values: PatientProfileValues
) {
    const { fields, inputProof } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.add8(values.age);
        i.addBool(values.gender);
        i.add16(values.weight);
        i.add8(values.height);
        i.addBool(values.hasDiabetes);
        i.add16(values.hbLevel);
        i.addBool(values.isSmoker);
        i.addBool(values.hasHypertension);
    });
    const [age, gender, weight, height, hasDiabetes, hbLevel, isSmoker, hasHypertension] = fields;
    return { age, gender, weight, height, hasDiabetes, hbLevel, isSmoker, hasHypertension, inputProof };
}

export async function buildSponsorCriteriaInputs(
    proofAccount: string,
    signerAddress: string,
    criteria: {
        minAge: number;
        maxAge: number;
        requiresDiabetes: boolean;
        minHb: number;
        genderReq: number;
        minHeight: number;
        maxWeight: number;
        requiresNonSmoker: boolean;
        requiresNormalBP: boolean;
    }
) {
    const { fields, inputProof } = await encryptBatch(proofAccount, signerAddress, (i) => {
        i.add8(criteria.minAge);
        i.add8(criteria.maxAge);
        i.addBool(criteria.requiresDiabetes);
        i.add16(criteria.minHb);
        i.add8(criteria.genderReq);
        i.add8(criteria.minHeight);
        i.add16(criteria.maxWeight);
        i.addBool(criteria.requiresNonSmoker);
        i.addBool(criteria.requiresNormalBP);
    });
    const [minAge, maxAge, requiresDiabetes, minHb, genderRequirement, minHeight, maxWeight, requiresNonSmoker, requiresNormalBP] =
        fields;
    return {
        minAge,
        maxAge,
        requiresDiabetes,
        minHb,
        genderRequirement,
        minHeight,
        maxWeight,
        requiresNonSmoker,
        requiresNormalBP,
        inputProof,
    };
}

export function coerceFheHandle(value: unknown): bigint {
    if (value == null) {
        throw new Error("Cannot coerce null FHE handle");
    }
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(value);
    if (typeof value === "string") {
        const s = value.startsWith("0x") ? value : `0x${value}`;
        return BigInt(s);
    }
    if (Array.isArray(value) && value.length > 0) {
        return coerceFheHandle(value[0]);
    }
    if (typeof value === "object") {
        const o = value as Record<string, unknown>;
        if (o.handle != null) return coerceFheHandle(o.handle);
        if (o.ctHash != null) return BigInt(o.ctHash as bigint | string);
        if (o._hex != null) return BigInt(o._hex as string);
        if (o.hash != null) return coerceFheHandle(o.hash);
        const vals = Object.values(o).filter((v) => v !== undefined && v !== null);
        if (vals.length === 1) return coerceFheHandle(vals[0]);
    }
    throw new Error(`Cannot coerce FHE handle: ${String(value)}`);
}

export function coerceHandleHex(value: unknown): `0x${string}` {
    if (typeof value === "string" && value.startsWith("0x")) {
        return value as `0x${string}`;
    }
    const n = coerceFheHandle(value);
    return ethers.toBeHex(n, 32) as `0x${string}`;
}

/** Mock-network KMS public decrypt (v0.9 proof-of-computation helper). */
export async function mockPublicDecrypt(handle: unknown) {
    assertFhevmMock();
    return hre.fhevm.publicDecrypt([coerceHandleHex(handle)]);
}

export async function mockPublicDecryptProof(handle: unknown) {
    const { abiEncodedClearValues, decryptionProof } = await mockPublicDecrypt(handle);
    return {
        cleartexts: abiEncodedClearValues,
        proof: decryptionProof,
    };
}

/** Mock-network plaintext read for encrypted integers. */
export async function mockGetPlaintext(ctHash: bigint | string | unknown): Promise<bigint> {
    const result = await mockPublicDecrypt(ctHash);
    const first = Object.values(result.clearValues)[0];
    return BigInt(first as bigint | number | string);
}

export async function mockUserDecryptUint32(
    ctHash: bigint | string | unknown,
    contractAddress: string,
    userAddress: string
): Promise<bigint> {
    assertFhevmMock();
    const user = await ethers.getSigner(userAddress);
    return hre.fhevm.userDecryptEuint(
        FhevmType.euint32,
        coerceHandleHex(ctHash),
        contractAddress,
        user
    );
}

export async function mockUserDecryptUint64(
    ctHash: bigint | string | unknown,
    contractAddress: string,
    user: string | { provider?: unknown; getAddress?: () => Promise<string> }
): Promise<bigint> {
    assertFhevmMock();
    const userSigner = typeof user === "string" ? await ethers.getSigner(user) : user;
    return hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        coerceHandleHex(ctHash),
        contractAddress,
        userSigner as never
    );
}

export async function mockUserDecryptBool(
    ctHash: bigint | string | unknown,
    contractAddress: string,
    user: { provider?: unknown; getAddress?: () => Promise<string> }
): Promise<boolean> {
    assertFhevmMock();
    return hre.fhevm.userDecryptEbool(coerceHandleHex(ctHash), contractAddress, user as never);
}

export async function mockDecryptBool(
    ctHash: bigint | string | unknown,
    contractAddress?: string,
    userAddress?: string
): Promise<boolean> {
    assertFhevmMock();
    if (contractAddress && userAddress) {
        const user = await ethers.getSigner(userAddress);
        return mockUserDecryptBool(ctHash, contractAddress, user);
    }
    return hre.fhevm.publicDecryptEbool(coerceHandleHex(ctHash));
}

/** Parse `WithdrawRequested` / `UnstakeRequested` / `AnonymousEligibilityStaged` sufficient/final handle from a receipt. */
export function parseEventArg(
    receipt: { logs: Array<{ topics: readonly string[]; data: string }> },
    contractInterface: { parseLog: (log: { topics: readonly string[]; data: string }) => { name: string; args: Record<string, unknown> } | null },
    eventName: string,
    argName: string
): string {
    for (const log of receipt.logs) {
        try {
            const parsed = contractInterface.parseLog(log);
            if (parsed?.name === eventName) {
                const val = parsed.args[argName];
                if (typeof val === "string") return val;
                if (typeof val === "bigint") return ethers.toBeHex(val, 32);
            }
        } catch {
            // not this contract's log
        }
    }
    throw new Error(`Event ${eventName}.${argName} not found in receipt`);
}
