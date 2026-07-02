import { ExternalLink, Lock } from "lucide-react";
import { getContractAddressForChain } from "../../lib/contracts";
import { ETH_SEPOLIA_EXPLORER } from "../../lib/network";
import { cn } from "../../lib/utils";

type Props = {
  chainId?: bigint | null;
  className?: string;
};

const SEPOLIA_EXPLORER = ETH_SEPOLIA_EXPLORER;

export function ZkCertifyExplainer({ chainId, className }: Props) {
  const engine = getContractAddressForChain("EligibilityEngine", chainId ?? undefined);
  const verifier = getContractAddressForChain("HonkVerifier", chainId ?? undefined);

  return (
    <div
      className={cn(
        "rounded-2xl border border-teal-100/90 bg-gradient-to-br from-teal-50/90 via-white to-slate-50/40 p-5 sm:p-6",
        className
      )}
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-200/50">
          <Lock className="h-6 w-6" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Zama computes · Noir attests
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong className="text-teal-800">Zama FHE</strong> is the authoritative layer: encrypted profile
            storage, eligibility, propensity scoring, and sponsor ranking all run on ciphertext. After you decrypt
            locally, you can generate an optional <strong className="text-slate-800">identity and policy attestation</strong> (Noir
            compliance seal) that binds your Semaphore identity and profile commitment to the exact Zama FHE stage being
            finalized — not a proof that fhEVM executed correctly.
          </p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>
              <strong className="text-teal-800">Zama FHE</strong> — private compute and encrypted match/score handles.
            </li>
            <li>
              <strong className="text-slate-700">Decrypt</strong> — your key reveals the match only on your device.
            </li>
            <li>
              <strong className="text-slate-700">Compliance seal</strong> — optional Noir identity/policy receipt for sponsor audit
              (may take 1–2 minutes in your browser).
            </li>
            <li>
              On-chain{" "}
              <code className="text-[10px] bg-white/80 px-1 rounded">attestationReceipt</code> stores result hash,
              schema version, and FHE stage binding — not medical fields.
            </li>
          </ol>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            The seal is an audit artifact, not a second eligibility engine. Full cryptographic equality between FHE
            ciphertext plaintext and Noir witness depends on future Zama input-proof primitives.
          </p>
          {(engine || verifier) && (
            <div className="flex flex-wrap gap-3 pt-1">
              {engine && (
                <a
                  href={`${SEPOLIA_EXPLORER}/address/${engine}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900"
                >
                  EligibilityEngine
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {verifier && (
                <a
                  href={`${SEPOLIA_EXPLORER}/address/${verifier}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800"
                >
                  HonkVerifier
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
