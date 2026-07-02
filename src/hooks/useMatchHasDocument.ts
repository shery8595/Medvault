import { useEffect, useState } from "react";
import type { Provider } from "ethers";
import { ethers } from "ethers";
import { tryGetPatientDocumentStoreAddress } from "../lib/contracts";

export function useMatchHasDocument(
  provider: Provider | undefined,
  nullifier: string | undefined,
  trialId: string | undefined,
  isAnonymous?: boolean
): { hasDocument: boolean; loading: boolean; revoked: boolean } {
  const [hasDocument, setHasDocument] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!provider || !nullifier || !trialId || !isAnonymous) {
      setHasDocument(false);
      setRevoked(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const chainId = (await provider.getNetwork()).chainId;
        const addr = tryGetPatientDocumentStoreAddress(chainId);
        if (!addr) {
          if (!cancelled) setHasDocument(false);
          return;
        }
        const store = new ethers.Contract(
          addr,
          ["function documentExists(uint256,uint256) view returns (bool)"],
          provider
        );
        const exists = await store.documentExists(BigInt(nullifier), BigInt(trialId));
        if (!cancelled) {
          setHasDocument(Boolean(exists));
          setRevoked(false);
        }
      } catch {
        if (!cancelled) {
          setHasDocument(false);
          setRevoked(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [provider, nullifier, trialId, isAnonymous]);

  return { hasDocument, loading, revoked };
}
