import { useMemo } from "react";
import { FileText, Loader2, Download, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { useSponsorDocumentDecrypt } from "../hooks/useSponsorDocumentDecrypt";
import { useMatchHasDocument } from "../hooks/useMatchHasDocument";
import { useWeb3 } from "../lib/Web3Context";

type Props = {
  nullifier: string;
  trialId: string;
  status: string;
  isAnonymous: boolean;
};

function detectMime(bytes: Uint8Array): string {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  return "application/octet-stream";
}

export function SponsorDocumentPanel({ nullifier, trialId, status, isAnonymous }: Props) {
  const { signer, provider } = useWeb3();
  const accepted = status === "Accepted";
  const { hasDocument, loading: checkingDoc } = useMatchHasDocument(
    provider ?? undefined,
    nullifier,
    trialId,
    isAnonymous
  );
  const enabled = Boolean(isAnonymous && accepted && hasDocument && signer);
  const { decrypt, loading, error, revoked, plaintext, filename } = useSponsorDocumentDecrypt(
    signer ?? undefined,
    nullifier,
    trialId,
    enabled
  );

  const accessRevoked =
    revoked || Boolean(error?.toLowerCase().includes("access revoked"));

  const previewUrl = useMemo(() => {
    if (!plaintext) return null;
    const mime = detectMime(plaintext);
    const blob = new Blob([plaintext], { type: mime });
    return URL.createObjectURL(blob);
  }, [plaintext]);

  if (!isAnonymous) return null;
  if (checkingDoc) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking for hybrid document…
      </p>
    );
  }
  if (!hasDocument) {
    return (
      <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 px-3 py-2">
        No encrypted medical document on file for this application.
      </p>
    );
  }
  if (!accepted) {
    return (
      <p className="text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
        Hybrid document attached — decrypt unlocks after you accept this application.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-teal-900">
        <FileText className="h-4 w-4" />
        Patient medical document (hybrid IPFS + FHE)
      </div>
      {!plaintext ? (
        <Button
          type="button"
          size="sm"
          className="gap-2 bg-teal-700 hover:bg-teal-800"
          disabled={!signer || loading || accessRevoked}
          onClick={() => void decrypt()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {accessRevoked ? "Access revoked" : "View patient document"}
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-teal-800">Decrypted locally via EIP-712 FHE unwrap + AES-256-GCM.</p>
          {previewUrl && detectMime(plaintext) === "application/pdf" ? (
            <iframe title="Patient document" src={previewUrl} className="w-full h-48 rounded-lg border bg-white" />
          ) : previewUrl && detectMime(plaintext).startsWith("image/") ? (
            <img src={previewUrl} alt="Patient document" className="max-h-48 rounded-lg border bg-white" />
          ) : (
            <p className="text-xs text-slate-600">Binary document ({plaintext.length} bytes)</p>
          )}
          <a
            href={previewUrl ?? undefined}
            download={filename}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Download decrypted file
          </a>
        </div>
      )}
      {error ? (
        <p className={cn(
          "text-xs flex items-center gap-1",
          accessRevoked ? "text-amber-800" : "text-rose-600"
        )}>
          <AlertTriangle className="h-3.5 w-3.5" />
          {accessRevoked
            ? "Access revoked — patient blocked future contract-gated reads. Previously decrypted copies may still exist off-chain."
            : error}
        </p>
      ) : null}
    </div>
  );
}
