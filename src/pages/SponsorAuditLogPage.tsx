import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
    ShieldCheck,
    Search,
    Download,
    Clock,
    UserCircle2,
    Activity,
    FileText,
    Loader2
} from "lucide-react";
import { useAuditLogs } from "../hooks/useAuditLogs";
import { useWeb3 } from "../lib/Web3Context";

export function SponsorAuditLogPage() {
    const { logs, loading, error } = useAuditLogs();
    const { account } = useWeb3();
    const [searchTerm, setSearchTerm] = useState("");
    const [trialFilter, setTrialFilter] = useState("");

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                log.actionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.patientHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.performer.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesTrial = trialFilter ? log.trialId === trialFilter : true;

            return matchesSearch && matchesTrial;
        });
    }, [logs, searchTerm, trialFilter]);

    // Format for display
    const formatHash = (hash: string) => `${hash.slice(0, 10)}...${hash.slice(-8)}`;

    const getActionColor = (action: string) => {
        if (action.includes("CONSENT")) return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        if (action.includes("ELIGIBILITY")) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
        if (action.includes("APPLICATION")) return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
        if (action.includes("REWARD")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
        return "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400";
    };

    const handleExport = () => {
        // Mock export functionality
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Timestamp,Trial ID,Action,Patient Hash,Performer\n"
            + filteredLogs.map(e => `${e.timestamp.toISOString()},${e.trialId},${e.actionType},${e.patientHash},${e.performer}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "medvault_audit_logs.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 pb-12">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700">
                        <ShieldCheck className="h-6 w-6 text-blue-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                        Regulatory Audit Trail
                    </h2>
                </div>
                <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
                    Immutable records of all sensitive system events. Data access, consents, and eligibility queries are
                    cryptographically hashed and sealed on-chain for HIPAA/GDPR compliance reporting.
                </p>
            </div>

            <Card className="border-slate-200/60 dark:border-slate-800/60 shadow-sm bg-white/50 dark:bg-slate-900/40 backdrop-blur-xl">
                <CardHeader className="pb-4 border-b border-slate-100/50 dark:border-slate-800/50">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-slate-400" /> System Event Log
                        </CardTitle>
                        <div className="flex flex-wrap gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search hashes or actions..."
                                    className="pl-9 h-10 w-[240px] bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Input
                                    placeholder="Trial ID..."
                                    className="h-10 w-[120px] bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                    value={trialFilter}
                                    onChange={(e) => setTrialFilter(e.target.value)}
                                />
                            </div>
                            <Button variant="outline" className="gap-2 h-10" onClick={handleExport}>
                                <Download className="h-4 w-4" /> Export CSV
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200/60 dark:border-slate-800/60 tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Timestamp / Block Time</th>
                                    <th className="px-6 py-4">Protocol Event</th>
                                    <th className="px-6 py-4">Trial Ref</th>
                                    <th className="px-6 py-4">Anonymized Subject Hash</th>
                                    <th className="px-6 py-4">Executing Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {loading && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <p className="font-medium">Syncing cryptographic audit logs...</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!loading && error && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-red-500">
                                            <p className="font-bold">Error loading logs: {error}</p>
                                        </td>
                                    </tr>
                                )}

                                {!loading && !error && filteredLogs.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            <p className="font-medium">No audit logs matching your criteria.</p>
                                        </td>
                                    </tr>
                                )}

                                {!loading && !error && filteredLogs.map((log, i) => (
                                    <tr key={`${log.patientHash}-${i}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                    {log.timestamp.toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className={`text-[9px] font-black tracking-widest px-2.5 py-0.5 ${getActionColor(log.actionType)}`}>
                                                {log.actionType.replace(/_/g, " ")}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-200">
                                            {log.trialId === "0" ? "-" : `#${log.trialId.padStart(4, '0')}`}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <UserCircle2 className="h-4 w-4 text-slate-400" />
                                                <code className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {formatHash(log.patientHash)}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Activity className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="font-mono text-xs text-slate-500">
                                                    {log.performer === account ? "You (Current Wallet)" : formatHash(log.performer)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default SponsorAuditLogPage;
