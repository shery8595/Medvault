import { useCallback, useState } from "react";
import type { Signer } from "ethers";
import { getConsentManager } from "../lib/contracts";

export type RevokeTrialConsentState = {
  busyTrialId: string | null;
  error: string | null;
  lastTxHash: string | null;
};

export function useRevokeTrialConsent(signer: Signer | undefined) {
  const [state, setState] = useState<RevokeTrialConsentState>({
    busyTrialId: null,
    error: null,
    lastTxHash: null,
  });

  const revokeTrialConsent = useCallback(
    async (trialId: string) => {
      if (!signer || !trialId) return;
      setState((s) => ({ ...s, busyTrialId: trialId, error: null }));
      try {
        const cm = getConsentManager(signer);
        const tx = await cm.revokeConsent(BigInt(trialId));
        await tx.wait();
        setState({ busyTrialId: null, error: null, lastTxHash: tx.hash });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Revoke consent failed";
        setState({ busyTrialId: null, error: message, lastTxHash: null });
        throw err;
      }
    },
    [signer]
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, revokeTrialConsent, clearError };
}
