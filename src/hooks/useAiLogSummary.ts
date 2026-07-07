import { useCallback, useEffect, useState } from "react";
import { fetchAiAuditSummary, isAiServiceConfigured, type AuditLogsSummary } from "../lib/aiServiceClient";
import type { AuditLogEntry } from "./useAuditLogs";

export function useAiLogSummary(
  trialIds: string[],
  logs: AuditLogEntry[],
  auditLogsLoading = false,
) {
  const [summary, setSummary] = useState<AuditLogsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isAiServiceConfigured();

  const refresh = useCallback(async () => {
    if (!configured || auditLogsLoading || (trialIds.length === 0 && logs.length === 0)) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAiAuditSummary(
        trialIds,
        logs.map((l) => ({
          id: l.id,
          actionType: l.actionType,
          trialId: l.trialId,
          patientHash: l.patientHash,
          timestamp: l.timestamp,
          performer: l.performer,
        }))
      );
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summary failed");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [configured, auditLogsLoading, trialIds, logs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, configured, refresh };
}
