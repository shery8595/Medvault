/**
 * useEligibilityProof — React hook for Noir attestation seal generation and on-chain submission.
 *
 * Flow:
 *   1. Zama FHE computes and stores encrypted eligibility (authoritative compute).
 *   2. Patient decrypts locally.
 *   3. Patient generates a Noir compliance seal bound to the Zama FHE stage handle.
 *   4. Submits to EligibilityEngine.verifyEligibilityProof() on-chain.
 *   5. Sponsors read attestationReceipt / subgraph metadata (no PHI).
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../lib/Web3Context";
import { getStoredIdentity, getAnonymousNullifier } from "../lib/semaphore";
import { formatCertifyFailure, runCertifyPreflight } from "../lib/certifyDiagnostics";
import {
    generateEligibilityProof,
    fetchFheStageHandleForAttestation,
    ELIGIBILITY_PUBLIC_INPUT_COUNT,
} from "../lib/noir";
import { getStoredPatientProfilePlain } from "../lib/profileStorage";
import { fetchTrialCriteria } from "../lib/trialCriteria";
import { parseFieldElement, parseTrialId } from "../lib/field";
import { getContractAddressForChain } from "../lib/contracts";
import addresses from "../lib/contracts/addresses.json";
import EligibilityEngineAbi from "../lib/contracts/abis/EligibilityEngine.json";

type SealStatus = "idle" | "generating" | "submitting" | "certified" | "error";

interface UseEligibilityProofResult {
    status: SealStatus;
    error: string | null;
    /** Generate and submit a Zama-bound compliance seal for a trial result. */
    sealResult: (trialId: string, eligible: boolean) => Promise<boolean>;
    /** @deprecated Use sealResult */
    certifyResult: (trialId: string, eligible: boolean) => Promise<boolean>;
    isNullifierSealed: (nullifier: string, trialId: string) => Promise<boolean>;
    /** @deprecated Use isNullifierSealed */
    isNullifierCertified: (nullifier: string, trialId: string) => Promise<boolean>;
    reset: () => void;
}

export function useEligibilityProof(): UseEligibilityProofResult {
    const { signer, chainId } = useWeb3();
    const [status, setStatus] = useState<SealStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setStatus("idle");
        setError(null);
    }, []);

    const sealResult = useCallback(
        async (trialId: string, eligible: boolean): Promise<boolean> => {
            if (!signer) {
                setError("Wallet not connected");
                setStatus("error");
                return false;
            }

            const identity = getStoredIdentity();
            if (!identity) {
                setError("No Semaphore identity found. Please register first.");
                setStatus("error");
                return false;
            }

            const engineAddress = getContractAddressForChain("EligibilityEngine", chainId ?? undefined);
            if (!engineAddress) {
                setError("EligibilityEngine address not found for this network.");
                setStatus("error");
                return false;
            }

            try {
                setStatus("generating");
                setError(null);

                const trialIdBigInt = parseTrialId(trialId);
                const profile = getStoredPatientProfilePlain();
                if (!profile) {
                    throw new Error(
                        "No local health profile found. Re-register your vault before sealing."
                    );
                }

                const abi = Array.isArray(EligibilityEngineAbi)
                    ? EligibilityEngineAbi
                    : (EligibilityEngineAbi as { abi: ethers.InterfaceAbi }).abi;
                const engine = new ethers.Contract(engineAddress, abi, signer);

                const criteria = await fetchTrialCriteria(
                    signer.provider!,
                    trialIdBigInt,
                    chainId ?? undefined
                );

                const storedNullifier = getAnonymousNullifier(trialIdBigInt);
                if (storedNullifier === null) {
                    throw new Error("Apply to this trial before sealing your Zama match.");
                }

                const fheStageHandle = await fetchFheStageHandleForAttestation(
                    engine,
                    storedNullifier,
                    trialIdBigInt
                );

                const proofData = await generateEligibilityProof(
                    identity,
                    identity.commitment,
                    trialIdBigInt,
                    profile,
                    criteria,
                    eligible,
                    fheStageHandle
                );

                setStatus("submitting");

                const { nullifier: proofNullifier } = proofData.inputs;

                const networkKey =
                    chainId === 11155111n
                        ? "sepolia"
                        : chainId === 42161n
                          ? "arbitrum"
                          : null;
                const expectedVerifier =
                    networkKey && (addresses as Record<string, Record<string, string>>)[networkKey]
                        ? (addresses as Record<string, Record<string, string>>)[networkKey]
                              .HonkVerifier
                        : getContractAddressForChain("HonkVerifier", chainId ?? undefined);

                const onChainVerifier = (await engine.eligibilityVerifier()) as string;

                const preflightError = await runCertifyPreflight({
                    engine,
                    honkVerifierAddress: onChainVerifier,
                    proofData,
                    trialId: trialIdBigInt,
                    nullifier: proofNullifier,
                    eligible,
                    expectedHonkVerifier: expectedVerifier,
                    chainId: chainId ?? undefined,
                    fheStageHandle,
                });
                if (preflightError) {
                    throw new Error(preflightError);
                }

                const txArgs = [
                    proofData.proofBytes,
                    proofData.publicInputs,
                    trialIdBigInt,
                    proofNullifier,
                    identity.commitment,
                    eligible,
                ] as const;

                try {
                    await engine.verifyEligibilityProof.staticCall(...txArgs);
                } catch (simErr) {
                    const simMsg = formatCertifyFailure(simErr, preflightError);
                    throw new Error(simMsg);
                }

                const tx = await engine.verifyEligibilityProof(...txArgs);
                await tx.wait();

                setStatus("certified");
                return true;
            } catch (err: unknown) {
                const msg = formatCertifyFailure(err);

                if (
                    msg.includes("already sealed") ||
                    msg.includes("Already sealed") ||
                    msg.includes("already certified") ||
                    msg.includes("Already certified")
                ) {
                    setStatus("certified");
                    return true;
                }

                console.error("[Attestation seal] failed:", err);
                setError(msg);
                setStatus("error");
                return false;
            }
        },
        [signer, chainId]
    );

    const isNullifierSealed = useCallback(
        async (nullifier: string, trialId: string): Promise<boolean> => {
            if (!signer) return false;

            const engineAddress = getContractAddressForChain("EligibilityEngine", chainId ?? undefined);
            if (!engineAddress) return false;

            try {
                const abi = Array.isArray(EligibilityEngineAbi)
                    ? EligibilityEngineAbi
                    : (EligibilityEngineAbi as { abi: ethers.InterfaceAbi }).abi;

                const engine = new ethers.Contract(engineAddress, abi, signer);
                return await engine.noirVerifiedResults(
                    parseFieldElement(nullifier),
                    parseTrialId(trialId)
                );
            } catch {
                return false;
            }
        },
        [signer, chainId]
    );

    return {
        status,
        error,
        sealResult,
        certifyResult: sealResult,
        isNullifierSealed,
        isNullifierCertified: isNullifierSealed,
        reset,
    };
}

export { useAnonymousCertification, useIsNullifierCertified } from "./useAnonymousCertification";
