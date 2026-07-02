import { useCallback, useEffect, useState } from "react";
import type { Signer } from "ethers";
import { fetchAndDecryptSponsorDocument } from "../lib/sponsorDocumentDecrypt";
import { tryGetPatientDocumentStoreAddress } from "../lib/contracts";

export type SponsorDocumentDecryptState = {
  loading: boolean;
  error: string | null;
  revoked: boolean;
  plaintext: Uint8Array | null;
  filename: string;
};

export function useSponsorDocumentDecrypt(
  signer: Signer | undefined,
  nullifier: string | undefined,
  trialId: string | undefined,
  enabled: boolean
) {
  const [state, setState] = useState<SponsorDocumentDecryptState>({
    loading: false,
    error: null,
    revoked: false,
    plaintext: null,
    filename: "patient-document",
  });

  const decrypt = useCallback(async () => {
    if (!signer || !nullifier || !trialId || !enabled) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const chainId = signer.provider
        ? (await signer.provider.getNetwork()).chainId
        : undefined;
      const docStore = tryGetPatientDocumentStoreAddress(chainId);
      if (!docStore) {
        throw new Error("PatientDocumentStore is not configured on this network.");
      }
      const bytes = await fetchAndDecryptSponsorDocument(
        signer,
        docStore,
        BigInt(nullifier),
        BigInt(trialId)
      );
      setState({
        loading: false,
        error: null,
        revoked: false,
        plaintext: bytes,
        filename: `medvault-doc-trial-${trialId}.bin`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Document decrypt failed";
      setState({
        loading: false,
        error: message,
        revoked: message.toLowerCase().includes("revoked") || message.toLowerCase().includes("access revoked"),
        plaintext: null,
        filename: "patient-document",
      });
    }
  }, [signer, nullifier, trialId, enabled]);

  useEffect(() => {
    setState({
      loading: false,
      error: null,
      revoked: false,
      plaintext: null,
      filename: "patient-document",
    });
  }, [nullifier, trialId, enabled]);

  return { ...state, decrypt };
}
