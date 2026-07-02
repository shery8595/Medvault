import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldOff, Download, BookOpen, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { DOCS_NAV_ITEMS } from "../../lib/docsNav";

type Props = {
  account?: string | null;
  onGrantAll?: () => Promise<void>;
  onRevokeAll?: () => Promise<void>;
  onExportLog?: () => void;
  className?: string;
};

const CONTRACT_DECRYPT_GUIDE = [
  { name: "AnonymousPatientRegistry", scope: "Encrypted profile fields for eligibility" },
  { name: "EligibilityEngine", scope: "FHE scores and anonymous application status" },
  { name: "ConfidentialETH", scope: "Reward balances (ephemeral permit holder)" },
  { name: "ConsentManager", scope: "Consent epoch and per-trial grants" },
  { name: "PatientDocumentStore", scope: "Hybrid IPFS + FHE AES key (per-access sponsor pull)" },
];

export function ConsentRightsCenter({
  account,
  onGrantAll,
  onRevokeAll,
  onExportLog,
  className,
}: Props) {
  const [busy, setBusy] = useState<"revoke" | null>(null);
  const complianceDoc = DOCS_NAV_ITEMS.find((d) => d.href === "/docs/compliance");
  const identityDoc = DOCS_NAV_ITEMS.find((d) => d.href === "/docs/identity-privacy");

  const handleRevokeAll = async () => {
    if (!onRevokeAll) return;
    setBusy("revoke");
    try {
      await onRevokeAll();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-sm", className)}>
      <div>
        <h3 className="text-sm font-bold text-slate-900">Consent rights center</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          Grant or revoke trial access, export your consent log, and see which contracts may decrypt which handles.
          Hybrid documents use atomic revoke+rotate; old IPFS CIDs must be unpinned off-chain — contracts cannot
          revoke already-decrypted files.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {onExportLog && (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onExportLog}>
            <Download className="h-3.5 w-3.5" />
            Export consent log
          </Button>
        )}
        {onRevokeAll && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-rose-700 border-rose-200 hover:bg-rose-50"
            onClick={() => void handleRevokeAll()}
            disabled={!account || busy === "revoke"}
          >
            {busy === "revoke" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5" />}
            Revoke all (epoch bump)
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Decrypt scope by contract</p>
        <ul className="space-y-1.5">
          {CONTRACT_DECRYPT_GUIDE.map((row) => (
            <li key={row.name} className="text-[11px] text-slate-600">
              <code className="text-[10px] bg-white px-1 rounded border border-slate-200">{row.name}</code>
              <span className="text-slate-400"> — </span>
              {row.scope}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        {identityDoc && (
          <Link to={identityDoc.href} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900">
            <BookOpen className="h-3.5 w-3.5" />
            Identity & privacy docs
          </Link>
        )}
        {complianceDoc && (
          <Link to={complianceDoc.href} className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-800">
            <BookOpen className="h-3.5 w-3.5" />
            Compliance reference
          </Link>
        )}
        <Link to="/docs/faq" className="text-slate-500 hover:text-slate-700">
          FAQ
        </Link>
      </div>
    </div>
  );
}
