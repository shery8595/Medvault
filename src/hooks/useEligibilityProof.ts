/**
 * useEligibilityProof — read-only Noir attestation status from on-chain storage.
 *
 * Attestation is recorded inside MedVaultRegistry.finalizeAnonymousApplyWithProof
 * at apply finalize. This hook only reads EligibilityEngine.noirVerifiedResults.
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWeb3 } from "../lib/Web3Context";
import { getAnonymousNullifier } from "../lib/semaphore";
import { parseFieldElement, parseTrialId } from "../lib/field";
import { getContractAddressForChain } from "../lib/contracts";
import EligibilityEngineAbi from "../lib/contracts/abis/EligibilityEngine.json";

type SealStatus = "idle" | "generating" | "submitting" | "certified" | "error";

interface UseEligibilityProofResult {
    status: SealStatus;
    error: string | null;
    /** Read whether a trial nullifier has an on-chain Noir attestation seal. */
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

    const readSealed = useCallback(
        async (trialId: string): Promise<boolean> => {
            if (!signer) {
                setError("Wallet not connected");
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
                setError(null);

                const trialIdBigInt = parseTrialId(trialId);
                const storedNullifier = getAnonymousNullifier(trialIdBigInt);
                if (storedNullifier === null) {
                    setError("Apply to this trial before checking attestation status.");
                    setStatus("idle");
                    return false;
                }

                const abi = Array.isArray(EligibilityEngineAbi)
                    ? EligibilityEngineAbi
                    : (EligibilityEngineAbi as { abi: ethers.InterfaceAbi }).abi;
                const engine = new ethers.Contract(engineAddress, abi, signer);

                const sealed = Boolean(
                    await engine.noirVerifiedResults(storedNullifier, trialIdBigInt)
                );
                setStatus(sealed ? "certified" : "idle");
                return sealed;
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : "Failed to read attestation status";
                console.error("[Attestation status] read failed:", err);
                setError(msg);
                setStatus("error");
                return false;
            }
        },
        [signer, chainId]
    );

    const sealResult = useCallback(
        async (trialId: string, _eligible: boolean): Promise<boolean> => readSealed(trialId),
        [readSealed]
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
