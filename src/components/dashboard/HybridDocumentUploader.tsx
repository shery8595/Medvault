import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { prepareHybridDocumentUpload } from "../../lib/patientDocumentUpload";
import { getPendingHybridDocument } from "../../lib/pendingHybridDocument";
import { tryGetPatientDocumentStoreAddress } from "../../lib/contracts";
import { useWeb3 } from "../../lib/Web3Context";

type Props = {
  trialId: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function HybridDocumentUploader({ trialId, className, compact, disabled }: Props) {
  const { chainId } = useWeb3();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(() => getPendingHybridDocument(trialId));

  const storeConfigured = Boolean(tryGetPatientDocumentStoreAddress(chainId ?? undefined));

  const refreshPending = useCallback(() => {
    setPending(getPendingHybridDocument(trialId));
  }, [trialId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!storeConfigured) {
      setError("Hybrid document store is not configured on this network.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await prepareHybridDocumentUpload(file, trialId, file.name);
      refreshPending();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Document upload failed";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  if (!storeConfigured) {
    return (
      <p className={cn("text-xs text-slate-500", className)}>
        Hybrid IPFS documents are unavailable until PatientDocumentStore is deployed (
        <code className="text-[10px]">VITE_PATIENT_DOCUMENT_STORE</code>).
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/*,.json,text/plain"
        onChange={(ev) => void onFile(ev)}
        disabled={disabled || uploading}
      />
      {pending ? (
        <div className="flex items-start gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold">Document ready for next application</p>
            <p className="truncate font-mono text-[10px] opacity-80">{pending.cid}</p>
            <p className="text-[10px] opacity-70">{pending.filename}</p>
            {pending.recordedTxHash ? (
              <p className="text-[10px] text-emerald-700 mt-1">Bound on-chain</p>
            ) : (
              <p className="text-[10px] mt-1">Will be recorded on-chain when you apply (after stage).</p>
            )}
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        className={cn("gap-2", compact && "h-9 text-xs")}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileUp className="h-4 w-4" />
        )}
        {pending ? "Replace encrypted document" : "Attach medical document (IPFS + FHE)"}
      </Button>
      {error ? (
        <p className="flex items-center gap-1 text-xs text-rose-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
