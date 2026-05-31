import React from "react";
import { BookOpen } from "lucide-react";
import { DOCS_CONTRACT_COUNT, DOCS_PAGE_COUNT, PRODUCTION_APP_URL } from "../../lib/docsNav";

export function DocsFooter() {
    return (
        <div className="mt-12 pt-8 border-t border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 not-prose text-left">
            <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Documentation</div>
                <div className="text-slate-800 font-medium text-sm">
                    {DOCS_PAGE_COUNT} pages · {DOCS_CONTRACT_COUNT} production contracts
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <a
                    href={PRODUCTION_APP_URL}
                    className="px-3 py-1.5 bg-white text-[#00685f] rounded-full text-xs font-semibold border border-[#00685f]/25 hover:bg-[#00685f]/5 transition-colors"
                >
                    med-vault.xyz
                </a>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#00685f]/8 text-[#00685f] rounded-full text-xs font-semibold border border-[#00685f]/15">
                    <BookOpen className="w-4 h-4" />
                    Arbitrum Sepolia · MedVault
                </div>
            </div>
        </div>
    );
}
