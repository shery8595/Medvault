import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { fetchAuditLogsFromChain, type AuditLogEntry } from "../lib/auditLogFetch";
import { getDataAccessLog } from "../lib/contracts";
import { useSubgraph } from "./useSubgraph";

export type { AuditLogEntry };

const GET_SPONSOR_TRIAL_IDS = `
  query GetSponsorTrialIds($sponsor: Bytes!) {
    trials(where: { sponsor: $sponsor }) {
      id
    }
  }
`;

const GET_SUBGRAPH_AUDIT_LOGS = `
  query GetSubgraphAuditLogs($trialIds: [BigInt!]!, $first: Int!) {
    auditLogs(
      where: { trialId_in: $trialIds }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      action
      actionType
      trialId
      patientHash
      timestamp
      performer
      transactionHash
    }
  }
`;

const AUDIT_LOG_LIMIT = 500;
const CHAIN_CACHE_MS = 45_000;

function toHex(value: unknown): string {
    if (value == null || value === "") return "0x";
    const s = String(value);
    return s.startsWith("0x") ? s : `0x${s}`;
}

function normalizeBytes(value: unknown): string {
    return toHex(value).toLowerCase();
}

function mapSubgraphRow(row: Record<string, unknown>): AuditLogEntry {
    return {
        id: String(row.id),
        actionType: String(row.actionType || row.action || "UNKNOWN"),
        trialId: String(row.trialId ?? "0"),
        patientHash: normalizeBytes(row.patientHash),
        timestamp: new Date(Number(row.timestamp) * 1000),
        performer: normalizeBytes(row.performer),
        transactionHash: row.transactionHash ? String(row.transactionHash) : undefined,
        source: "subgraph",
    };
}

function mergeAuditLogs(chain: AuditLogEntry[], subgraph: AuditLogEntry[]): AuditLogEntry[] {
    const seen = new Set<string>();
    const merged: AuditLogEntry[] = [];

    for (const row of [...chain, ...subgraph]) {
        const key = row.transactionHash
            ? `${row.transactionHash}:${row.actionType}:${row.trialId}`
            : `${row.timestamp.getTime()}:${row.actionType}:${row.trialId}:${row.patientHash}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
    }

    merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return merged.slice(0, AUDIT_LOG_LIMIT);
}

const chainCache = new Map<string, { at: number; logs: AuditLogEntry[] }>();

export function useAuditLogs() {
    const { account, readOnlyProvider } = useWeb3();
    const sponsor = account?.toLowerCase() ?? "";

    const { data: trialData, loading: trialsLoading, error: trialsError } = useSubgraph<{
        trials?: { id: string }[];
    }>(GET_SPONSOR_TRIAL_IDS, { sponsor }, { enabled: !!account });

    const trialIdSet = useMemo(() => {
        return new Set((trialData?.trials ?? []).map((t) => t.id));
    }, [trialData?.trials]);

    const trialIds = useMemo(() => [...trialIdSet], [trialIdSet]);

    const { data: subgraphLogData } = useSubgraph<{ auditLogs?: Record<string, unknown>[] }>(
        GET_SUBGRAPH_AUDIT_LOGS,
        { trialIds, first: AUDIT_LOG_LIMIT },
        { enabled: !!account && trialIds.length > 0 },
    );

    const [rawChainLogs, setRawChainLogs] = useState<AuditLogEntry[]>([]);
    const [totalLogCount, setTotalLogCount] = useState<number | null>(null);
    const [chainLoading, setChainLoading] = useState(true);
    const [chainError, setChainError] = useState<string | null>(null);
    const fetchGen = useRef(0);

    const fetchChainLogs = useCallback(async () => {
        if (!readOnlyProvider || !account) {
            setRawChainLogs([]);
            setTotalLogCount(null);
            setChainLoading(false);
            return;
        }

        const cacheKey = account;
        const cached = chainCache.get(cacheKey);
        if (cached && Date.now() - cached.at < CHAIN_CACHE_MS) {
            setRawChainLogs(cached.logs);
            setChainLoading(false);
            setChainError(null);
            return;
        }

        const gen = ++fetchGen.current;
        try {
            setChainLoading(true);
            // One eth_getLogs scan; trial filter applied in useMemo when subgraph returns.
            const logs = await fetchAuditLogsFromChain(readOnlyProvider, new Set());
            let total: number | null = null;
            try {
                const dal = getDataAccessLog(readOnlyProvider);
                total = Number(await dal.getTotalLogCount());
            } catch {
                total = null;
            }
            if (gen !== fetchGen.current) return;
            chainCache.set(cacheKey, { at: Date.now(), logs });
            setRawChainLogs(logs);
            setTotalLogCount(total);
            setChainError(null);
        } catch (err: unknown) {
            if (gen !== fetchGen.current) return;
            console.error("Failed to fetch on-chain audit logs:", err);
            const message = err instanceof Error ? err.message : "Failed to fetch on-chain logs";
            setChainError(message);
        } finally {
            if (gen === fetchGen.current) setChainLoading(false);
        }
    }, [readOnlyProvider, account]);

    useEffect(() => {
        if (!account) {
            setRawChainLogs([]);
            setChainLoading(false);
            setChainError(null);
            return;
        }
        void fetchChainLogs();
    }, [account, fetchChainLogs]);

    const subgraphLogs = useMemo(() => {
        return (subgraphLogData?.auditLogs ?? []).map((row) =>
            mapSubgraphRow(row as Record<string, unknown>),
        );
    }, [subgraphLogData?.auditLogs]);

    const chainLogs = useMemo(() => {
        if (trialsLoading) return [];
        if (trialIdSet.size === 0) return rawChainLogs;
        return rawChainLogs.filter((row) => trialIdSet.has(row.trialId));
    }, [rawChainLogs, trialIdSet, trialsLoading]);

    const logs = useMemo(
        () => mergeAuditLogs(chainLogs, subgraphLogs),
        [chainLogs, subgraphLogs],
    );

    const loading = !!account && (chainLoading || trialsLoading);
    const error = trialsError?.message ?? chainError;

    const refetch = useCallback(() => {
        if (account) chainCache.delete(account);
        void fetchChainLogs();
    }, [account, fetchChainLogs]);

    return {
        logs,
        loading,
        error,
        refetch,
        trialCount: trialIds.length,
        totalLogCount,
        bufferedLogCount: logs.length,
    };
}
