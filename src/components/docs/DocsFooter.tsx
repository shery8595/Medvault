import React from "react";
import { BookOpen } from "lucide-react";

export function DocsFooter() {
    return (
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between not-prose">
            <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Documentation Version</div>
                <div className="text-slate-900 dark:text-white font-medium">v1.0.0 — Last updated March 15, 2026</div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-full text-xs font-bold border border-blue-500/20">
                <BookOpen className="w-4 h-4" />
                16 Pages • 11 Contracts
            </div>
        </div>
    );
}
