import { useCallback, useState } from "react";

import type { Signer } from "ethers";

import { revokeAndRotateDocumentKey } from "../lib/documentBindingHelpers";



export type PatientDocumentRevokeState = {

  loading: boolean;

  error: string | null;

  lastTxHash: string | null;

};



export function usePatientDocumentRevoke(

  signer: Signer | undefined,

  nullifier: string | undefined,

  trialId: string | undefined

) {

  const [state, setState] = useState<PatientDocumentRevokeState>({

    loading: false,

    error: null,

    lastTxHash: null,

  });



  const revokeAndRotate = useCallback(async () => {

    if (!signer || !nullifier || !trialId) return;

    setState((s) => ({ ...s, loading: true, error: null }));

    try {

      const { txHash } = await revokeAndRotateDocumentKey(

        signer,

        BigInt(nullifier),

        BigInt(trialId)

      );

      setState({ loading: false, error: null, lastTxHash: txHash });

    } catch (err: unknown) {

      const message = err instanceof Error ? err.message : "Revoke & rotate failed";

      setState({ loading: false, error: message, lastTxHash: null });

    }

  }, [signer, nullifier, trialId]);



  return { ...state, revokeAndRotate };

}


