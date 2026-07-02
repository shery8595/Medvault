import { cn } from "../../lib/utils";
import {
    ACCENT_STYLES,
    type ProtocolContractEntry,
} from "../../lib/protocolContracts";

export function ProtocolContractSection({ contract }: { contract: ProtocolContractEntry }) {
    const styles = ACCENT_STYLES[contract.accent];

    return (
        <section className={cn("not-prose rounded-xl border bg-white p-4 md:p-5", styles.border)}>
            <div className="flex items-start gap-3 mb-3">
                <div
                    className={cn(
                        "p-2 rounded-lg border font-mono font-bold text-sm leading-none shrink-0",
                        styles.number
                    )}
                >
                    {contract.id}
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 m-0">{contract.name}</h2>
                    <span
                        className={cn(
                            "inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                            styles.badge
                        )}
                    >
                        {contract.role}
                    </span>
                </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed m-0 mb-3">{contract.summary}</p>
            <div className="text-xs">
                <span className="font-bold text-slate-700">Key functions: </span>
                <code className="text-slate-600">{contract.keyFunctions.join(", ")}</code>
            </div>
            {contract.related && contract.related.length > 0 && (
                <p className="text-xs text-slate-500 mt-2 m-0">
                    <span className="font-semibold text-slate-600">Integrates with: </span>
                    {contract.related.join(" · ")}
                </p>
            )}
            {contract.quirks && contract.quirks.length > 0 && (
                <ul className="text-xs text-amber-800 mt-3 mb-0 pl-4 list-disc space-y-1">
                    {contract.quirks.map((q) => (
                        <li key={q}>{q}</li>
                    ))}
                </ul>
            )}
        </section>
    );
}
