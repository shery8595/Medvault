/**
 * Decode and preflight EligibilityEngine attestation / registry finalize failures
 * so the UI shows actionable messages instead of "require(false)".
 */

import { ethers } from "ethers";
import type { EligibilityProofData } from "./noir";
import {
    ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT,
    ELIGIBILITY_PUBLIC_INPUT_COUNT,
    readSolidityProofMetadata,
} from "./noir";
import { fheStageHandleToField } from "./criteriaSchema";
import { fieldFromBytes32, parseTrialId } from "./field";
import EligibilityEngineAbi from "./contracts/abis/EligibilityEngine.json";
import HonkVerifierAbi from "./contracts/abis/HonkVerifier.json";
import addresses from "./contracts/addresses.json";
import vkFingerprint from "./circuits/vk_fingerprint.json";

function resolveInterfaceAbi(
    imported: ethers.InterfaceAbi | { abi: ethers.InterfaceAbi }
): ethers.InterfaceAbi {
    return (Array.isArray(imported) ? imported : imported.abi) as ethers.InterfaceAbi;
}

const ENGINE_IFACE = new ethers.Interface(resolveInterfaceAbi(EligibilityEngineAbi));
const HONK_IFACE = new ethers.Interface(resolveInterfaceAbi(HonkVerifierAbi));

const ERROR_STRING_SELECTOR = "0x08c379a0";

const APPLICATION_STATUS_LABEL: Record<number, string> = {
    0: "None (never applied on-chain)",
    1: "Pending",
    2: "Accepted",
    3: "Rejected",
};

const REDEPLOY_HINT =
    "Run `npm run build:circuit`, redeploy verifiers (`npm run deploy:sepolia` or " +
    "`npm run deploy:encrypted-verifier:sepolia`), then `npm run deploy:wiring:sepolia` after the timelock.";

export type CertifyPreflightInput = {
    engine: ethers.Contract;
    honkVerifierAddress: string;
    proofData: EligibilityProofData;
    trialId: bigint;
    nullifier: bigint;
    eligible: boolean;
    /** When true, use eligibilityVerifierEncrypted + 15 public inputs (encrypted-criteria trials). */
    encryptedCriteria?: boolean;
    expectedHonkVerifier?: string;
    chainId?: bigint | number;
    fheStageHandle?: bigint | string;
};

const MIN_SOLIDITY_PROOF_BYTES = 6_000;

function networkKeyFromChainId(chainId?: bigint | number): string | null {
    if (chainId === undefined) return null;
    const id = typeof chainId === "bigint" ? Number(chainId) : chainId;
    if (id === 11155111) return "sepolia";
    if (id === 42161) return "arbitrum";
    return null;
}

/** Metadata from Solidity-layout proof bytes (after stripping the 4-byte bb buffer prefix). */
export function proofHonkMetadata(proofBytes: `0x${string}`) {
    return readSolidityProofMetadata(proofBytes);
}

/** On-chain reads + isolated Honk verify before sending the certify tx. */
export async function runCertifyPreflight(input: CertifyPreflightInput): Promise<string | null> {
    const {
        engine,
        honkVerifierAddress,
        proofData,
        trialId,
        nullifier,
        eligible,
        encryptedCriteria = false,
        expectedHonkVerifier,
        chainId,
    } = input;

    const expectedInputCount = encryptedCriteria
        ? ELIGIBILITY_ENCRYPTED_PUBLIC_INPUT_COUNT
        : ELIGIBILITY_PUBLIC_INPUT_COUNT;

    const proofByteLen = (proofData.proofBytes.length - 2) / 2;
    if (proofByteLen < MIN_SOLIDITY_PROOF_BYTES) {
        return (
            `Proof is ${proofByteLen} bytes (expected UltraHonk ~14k+). ` +
            "Restart the dev server after pulling the latest certify fix."
        );
    }
    if (proofData.publicInputs.length !== expectedInputCount) {
        return `Expected ${expectedInputCount} public inputs in proof bundle (${encryptedCriteria ? "encrypted" : "plaintext"} mode).`;
    }

    const networkKey = networkKeyFromChainId(chainId);
    const netAddrs =
        networkKey && (addresses as Record<string, Record<string, string>>)[networkKey]
            ? (addresses as Record<string, Record<string, string>>)[networkKey]
            : undefined;

    const fp = vkFingerprint as {
        sha256?: string;
        plaintext?: { sha256: string };
        encrypted?: { sha256: string };
    };
    const localVkFingerprint = encryptedCriteria
        ? fp.encrypted?.sha256
        : fp.plaintext?.sha256 ?? fp.sha256;
    const deployedVkFingerprint = encryptedCriteria
        ? netAddrs?.HonkVerifierEncryptedVkFingerprint
        : netAddrs?.HonkVerifierVkFingerprint;

    if (deployedVkFingerprint && localVkFingerprint && deployedVkFingerprint !== localVkFingerprint) {
        return (
            `This app was built against a newer ${encryptedCriteria ? "encrypted" : "plaintext"} eligibility circuit than the HonkVerifier on-chain. ` +
            REDEPLOY_HINT
        );
    }

    const engineVerifierSlot = encryptedCriteria ? "eligibilityVerifierEncrypted" : "eligibilityVerifier";
    const onChainVerifier = (await engine[engineVerifierSlot]()) as string;
    if (onChainVerifier === ethers.ZeroAddress) {
        return (
            `${encryptedCriteria ? "HonkVerifierEncrypted" : "HonkVerifier"} not set on EligibilityEngine. ` +
            REDEPLOY_HINT
        );
    }

    if (expectedHonkVerifier && onChainVerifier.toLowerCase() !== expectedHonkVerifier.toLowerCase()) {
        return (
            `EligibilityEngine.${engineVerifierSlot} is ${onChainVerifier}, but this app expects ${expectedHonkVerifier}. ` +
            REDEPLOY_HINT
        );
    }
    if (honkVerifierAddress.toLowerCase() !== onChainVerifier.toLowerCase()) {
        return (
            `Preflight verifier ${honkVerifierAddress} does not match engine.${engineVerifierSlot} (${onChainVerifier}).`
        );
    }

    const alreadySealed = (await engine.noirVerifiedResults(nullifier, trialId)) as boolean;
    if (alreadySealed) {
        return "This Zama match is already sealed on-chain.";
    }

    const appStatus = Number(await engine.getAnonymousApplicationStatus(nullifier, trialId));
    if (appStatus === 0) {
        return (
            "No on-chain anonymous FHE application for this nullifier and trial. " +
            "Complete anonymous apply + Zama FHE match before generating a compliance seal."
        );
    }

    const scope = fieldFromBytes32(proofData.publicInputs[0]);
    const piNullifier = fieldFromBytes32(proofData.publicInputs[1]);

    if (scope !== trialId) {
        return `Proof scope (${scope}) does not match trial id (${trialId}).`;
    }
    if (piNullifier !== nullifier) {
        return "Proof nullifier does not match your stored Semaphore application. Re-apply to this trial.";
    }

    if (encryptedCriteria) {
        const piFheStage = fieldFromBytes32(proofData.publicInputs[3]);
        const expectedFheStage =
            input.fheStageHandle != null ? fheStageHandleToField(input.fheStageHandle) : piFheStage;
        if (piFheStage !== expectedFheStage) {
            return "Attestation FHE stage handle does not match the staged Zama result.";
        }
        const piSchema = proofData.publicInputs[4];
        const engineSchema = (await engine.CRITERIA_SCHEMA_HASH()) as string;
        if (piSchema.toLowerCase() !== engineSchema.toLowerCase()) {
            return "Criteria schema hash does not match the deployed EligibilityEngine.";
        }
        if (fieldFromBytes32(proofData.publicInputs[6]) !== 1n) {
            return "Encrypted mode flag must be 1 for encrypted-criteria trials.";
        }
    } else {
        const piEligible = fieldFromBytes32(proofData.publicInputs[4]);
        const eligibleField = eligible ? 1n : 0n;
        if (piEligible !== eligibleField) {
            return "Proof eligible bit does not match the result you are sealing.";
        }
        const piFheStage = fieldFromBytes32(proofData.publicInputs[5]);
        const expectedFheStage =
            input.fheStageHandle != null ? fheStageHandleToField(input.fheStageHandle) : piFheStage;
        if (piFheStage !== expectedFheStage) {
            return "Attestation FHE stage handle does not match the persisted Zama result.";
        }
        const piSchema = proofData.publicInputs[6];
        const engineSchema = (await engine.CRITERIA_SCHEMA_HASH()) as string;
        if (piSchema.toLowerCase() !== engineSchema.toLowerCase()) {
            return "Criteria schema hash does not match the deployed EligibilityEngine.";
        }
    }

    const honk = new ethers.Contract(honkVerifierAddress, HONK_IFACE, engine.runner ?? engine.provider);
    try {
        const ok = (await honk.verify.staticCall(proofData.proofBytes, proofData.publicInputs)) as boolean;
        if (!ok) {
            return "HonkVerifier.verify returned false (proof does not match the deployed verification key).";
        }
    } catch (honkErr) {
        const honkMsg = decodeContractRevert(honkErr);
        if (honkMsg) return honkMsg;
        return (
            "HonkVerifier rejected the proof (SumcheckFailed — the deployed verification key does not match this circuit). " +
            REDEPLOY_HINT
        );
    }

    return null;
}

/** Turn ethers / RPC errors into a user-facing certification message. */
export function formatCertifyFailure(err: unknown, preflightHint?: string | null): string {
    const decoded = decodeContractRevert(err);
    if (decoded) return decoded;

    const msg = extractErrorMessage(err);

    if (msg.includes("Circuit artifact not found")) {
        return "Circuit not compiled. Run `npm run build:circuit` first.";
    }
    if (msg.includes("Verifier not set") || msg.includes("Encrypted verifier not set")) {
        return `Honk verifier not set on EligibilityEngine. ${REDEPLOY_HINT}`;
    }
    if (msg.includes("No stored Semaphore nullifier")) {
        return "You must apply to this trial before certifying your result.";
    }
    if (msg.includes("failed local verification")) {
        return msg;
    }
    if (msg.includes("verifier is") || msg.includes("verifier mismatch")) {
        return msg;
    }

    if (
        msg.includes("require(false)") ||
        (msg.includes("execution reverted") && !msg.includes("reverted with reason"))
    ) {
        const base =
            "On-chain certification reverted without a reason string (usually HonkVerifier SumcheckFailed: " +
            "proof/VK mismatch).";
        if (preflightHint) return `${base} Preflight: ${preflightHint}`;
        return `${base} ${REDEPLOY_HINT} Ensure you completed anonymous apply for this trial.`;
    }

    if (msg.includes("CALL_EXCEPTION") || msg.includes("missing revert data")) {
        if (preflightHint) return `Transaction would revert: ${preflightHint}`;
        return (
            "Transaction would revert on-chain. Run certify preflight in the console or check: " +
            "verifier address, FHE application status, and HonkVerifier/circuit version match."
        );
    }

    return msg || "Proof generation or on-chain certification failed.";
}

function extractErrorMessage(err: unknown): string {
    if (!err || typeof err !== "object") return String(err ?? "");
    const e = err as Record<string, unknown>;
    if (typeof e.reason === "string" && e.reason) return e.reason;
    if (typeof e.shortMessage === "string") return e.shortMessage;
    if (typeof e.message === "string") return e.message;
    if (e.error && typeof e.error === "object") {
        const inner = e.error as Record<string, unknown>;
        if (typeof inner.message === "string") return inner.message;
    }
    return "";
}

function revertDataFromError(err: unknown): string | null {
    if (!err || typeof err !== "object") return null;
    const e = err as Record<string, unknown>;

    const candidates = [
        e.data,
        (e.error as Record<string, unknown> | undefined)?.data,
        (e.info as Record<string, unknown> | undefined)?.error?.data,
        (e.transaction as Record<string, unknown> | undefined)?.data,
    ];

    for (const c of candidates) {
        if (typeof c === "string" && c.startsWith("0x") && c.length > 2) return c;
    }
    return null;
}

function decodeContractRevert(err: unknown): string | null {
    if (err && typeof err === "object") {
        const rev = (err as { revert?: { name?: string } }).revert;
        if (rev?.name) return mapCustomError(rev.name);
    }

    const data = revertDataFromError(err);
    if (data) {
        const fromData = decodeRevertData(data);
        if (fromData) return fromData;
    }

    const msg = extractErrorMessage(err);

    const known: [string, string][] = [
        ["Scope mismatch", "Trial ID does not match the proof scope field."],
        ["Nullifier mismatch", "Wallet nullifier argument does not match the proof."],
        ["Eligible mismatch", "Eligible flag does not match the proof public input."],
        ["No FHE application found", "No on-chain anonymous FHE application for this nullifier/trial."],
        ["Invalid Noir proof", "Honk attestation rejected by EligibilityEngine (verifier returned false)."],
        ["Already sealed", "This nullifier/trial is already sealed."],
        ["Already certified", "This nullifier/trial is already sealed."],
        ["Expected 25 public inputs", "Wrong number of public inputs for plaintext attestation."],
        ["Expected 15 public inputs", "Wrong number of public inputs for encrypted attestation."],
        ["FHE stage mismatch", "Attestation is not bound to the staged Zama FHE result handle."],
        ["Criteria schema mismatch", "Trial criteria schema version does not match the deployed engine."],
        ["Encrypted verifier not set", "EligibilityEngine has no HonkVerifierEncrypted configured."],
        ["Verifier not set", "EligibilityEngine has no HonkVerifier configured."],
        ["PublicInputsLengthWrong", "HonkVerifier: public input count does not match the verification key."],
        ["SumcheckFailed", "HonkVerifier: proof invalid for the deployed verification key (circuit/VK mismatch)."],
    ];

    for (const [needle, text] of known) {
        if (msg.includes(needle)) return text;
    }

    return null;
}

function decodeRevertData(data: string): string | null {
    try {
        const custom = ENGINE_IFACE.parseError(data) ?? HONK_IFACE.parseError(data);
        if (custom) return mapCustomError(custom.name);
    } catch {
        // not a custom error
    }

    if (data.startsWith(ERROR_STRING_SELECTOR)) {
        try {
            const [reason] = ethers.AbiCoder.defaultAbiCoder().decode(
                ["string"],
                ethers.dataSlice(data, 4)
            );
            if (typeof reason === "string") return reason;
        } catch {
            // fall through
        }
    }

    return null;
}

function mapCustomError(name: string): string {
    switch (name) {
        case "PublicInputsLengthWrong":
            return "HonkVerifier: public input count does not match the verification key.";
        case "SumcheckFailed":
            return (
                "HonkVerifier: proof verification failed (SumcheckFailed). " +
                `The on-chain VK does not match this proof — ${REDEPLOY_HINT}`
            );
        default:
            return `Contract error: ${name}`;
    }
}

/** Resolve trial id + optional preflight for Results page helpers. */
export function parseCertifyTrialId(trialId: string): bigint {
    return parseTrialId(trialId);
}

export function applicationStatusLabel(status: number): string {
    return APPLICATION_STATUS_LABEL[status] ?? `Unknown (${status})`;
}
