import { ConsentLog } from "../../types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Trash2, MessageSquare } from "lucide-react";
import { ethers } from "ethers";
import { useMemo } from "react";

interface ConsentTableProps {
  logs: ConsentLog[];
  searchQuery?: string;
}

export function ConsentTable({ logs, searchQuery = "" }: ConsentTableProps) {
  const filteredLogs = logs.filter(log =>
    log.sponsorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.trialName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const decodeMessage = (hexMessage?: string) => {
    if (!hexMessage) return null;
    try {
      // Subgraph returns bytes as hex strings
      if (hexMessage.startsWith("0x")) {
        // Remove padding if necessary or handles as is if it's a valid hex string for UTF8
        return ethers.toUtf8String(hexMessage);
      }
      return hexMessage;
    } catch (e) {
      console.warn("Failed to decode message", e);
      return "Message encrypted or undecodable";
    }
  };

  return (
    <div className="w-full">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
          <tr>
            <th className="px-6 py-4 font-semibold">Sponsor & Trial</th>
            <th className="px-6 py-4 font-semibold">Data Shared</th>
            <th className="px-6 py-4 font-semibold">Message</th>
            <th className="px-6 py-4 font-semibold">Date</th>
            <th className="px-6 py-4 font-semibold">Status</th>
            <th className="px-6 py-4 font-semibold text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLogs.map((log) => {
            const decoded = decodeMessage(log.message);
            return (
              <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-5">
                  <div className="font-bold text-slate-900 dark:text-white mb-0.5">{log.sponsorName}</div>
                  <div className="text-xs text-slate-400 font-medium">{log.trialName}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex gap-1.5 flex-wrap">
                    {(log.dataShared || ["Vital Signs", "Lab Data"]).map((data, i) => (
                      <span key={i} className="inline-flex items-center rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                        {data}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-5 min-w-[200px]">
                  {decoded ? (
                    <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 italic">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span>"{decoded}"</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No message</span>
                  )}
                </td>
                <td className="px-6 py-5 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">{log.timestamp}</td>
                <td className="px-6 py-5">
                  <Badge variant={
                    log.status === "Active" || log.status === "Accepted" || (log.status as string) === "granted"
                      ? "success"
                      : log.status === "Pending"
                        ? "warning"
                        : "secondary"
                  }>
                    {log.status}
                  </Badge>
                </td>
                <td className="px-6 py-5 text-right">
                  {(log.status === "Active" || (log.status as string) === "granted") && (
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-bold text-xs h-8 rounded-lg">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {filteredLogs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-20 text-center">
                <p className="text-slate-400 font-medium">No matching logs found</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
