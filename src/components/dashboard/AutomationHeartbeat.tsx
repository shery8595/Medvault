import { Card, CardContent } from "../ui/Card";
import { Activity, ShieldCheck, Cpu, Zap, CheckCircle2, Clock } from "lucide-react";

interface AutomationHeartbeatProps {
    trialId: string;
    isFinalized?: boolean;
    endTime?: string;
    isActive?: boolean;
}

export function AutomationHeartbeat({ trialId, isFinalized, endTime, isActive }: AutomationHeartbeatProps) {
    const isExpired = endTime && parseInt(endTime) <= Math.floor(Date.now() / 1000);
    const requiresAction = isExpired && !isFinalized && isActive;

    return (
        <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white shadow-sm dark:bg-slate-900/40 overflow-hidden relative group">
            <div className="absolute -right-12 -top-12 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                <Cpu className="h-40 w-40 text-blue-500" />
            </div>
            <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 flex items-center justify-center">
                            <Activity className="h-5 w-5" />
                        </div>
                        {(!isFinalized && isActive) && (
                            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Chainlink CRE
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Trial finalization — CRE or scheduled upkeep</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> FHE Coprocessor
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Active Polling</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1">
                            {isFinalized ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Clock className="h-3 w-3" />} Finalize Task
                        </p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {isFinalized ? "Completed" : requiresAction ? "Pending CRE run" : "Waiting for Expiry"}
                        </p>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] text-slate-500">
                        MedVault finalizes expired trials via <code>MedVaultAutomation</code> — Chainlink CRE or a
                        scheduled owner upkeep job. Polls <code>checkUpkeep</code> and runs screening distribution +
                        deactivation when due.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
