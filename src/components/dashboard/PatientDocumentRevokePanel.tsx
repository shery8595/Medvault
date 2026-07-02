import { Loader2, ShieldOff, AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { usePatientDocumentRevoke } from "../../hooks/usePatientDocumentRevoke";
import { useMatchHasDocument } from "../../hooks/useMatchHasDocument";
import { useWeb3 } from "../../lib/Web3Context";

type Props = {
  nullifier: string;
  trialId: string;
  className?: string;
};

export function PatientDocumentRevokePanel({ nullifier, trialId, className }: Props) {
  const { signer, provider } = useWeb3();
  const { hasDocument, loading: checking } = useMatchHasDocument(
    provider ?? undefined,
    nullifier,
    trialId,
    true
  );
  const { loading, error, lastTxHash, revokeAndRotate } = usePatientDocumentRevoke(
    signer ?? undefined,
    nullifier,
    trialId
  );

  if (checking || !hasDocument) return null;

  return (
    <div className={cn("space-y-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2", className)}>
      <p className="text-xs text-amber-900 font-medium flex items-center gap-1.5">
        <ShieldOff className="h-3.5 w-3.5" />
        Hybrid document access
      </p>
      <p className="text-[10px] text-amber-800 leading-relaxed">
        Revoke &amp; rotate is atomic: you must supply a new re-encrypted IPFS CID and FHE key in one
        transaction. This blocks future sponsor decrypt via the contract. Sponsors who already decrypted
        may still have the file — the old IPFS CID must be unpinned off-chain (best-effort via trusted
        indexer); on-chain contracts cannot delete already-decrypted copies.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 h-8 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
        disabled={!signer || loading}
        onClick={() => void revokeAndRotate()}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
        Revoke &amp; rotate key
      </Button>
      {lastTxHash ? (
        <p className="text-[10px] text-emerald-700 font-mono truncate">Tx: {lastTxHash}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-rose-600 flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
