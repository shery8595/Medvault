import type { EventLog, Provider } from "ethers";
import { getDataAccessLog } from "./contracts";

export interface AuditLogEntry {
    id: string;
    actionType: string;
    trialId: string;
    patientHash: string;
    timestamp: Date;
    performer: string;
    transactionHash?: string;
    source?: "chain" | "subgraph";
}

/** MedVault stack deploy window on Arbitrum Sepolia (matches subgraph start). */
const DATA_ACCESS_LOG_FROM_BLOCK = 272205848;

const MAX_DISPLAY_LOGS = 500;
const GET_LOG_BATCH_SIZE = 48;
const PARALLEL_TRIAL_EVENT_QUERIES = 12;

/** Must match `DataAccessLog.ActionType` enum order (Solidity). */
export const AUDIT_ACTION_TYPES = [
    "PROFILE_SUBMISSION",
    "CONSENT_GRANTED",
    "ELIGIBILITY_CHECKED",
    "APPLICATION_STATUS_CHANGED",
    "MILESTONE_COMPLETED",
    "REWARDS_DISTRIBUTED",
    "PARTICIPANT_JOINED_POOL",
] as const;

export function actionTypeFromIndex(action: unknown): string {
    const actionIdx = Number(action);
    if (Number.isFinite(actionIdx) && actionIdx >= 0 && actionIdx < AUDIT_ACTION_TYPES.length) {
        return AUDIT_ACTION_TYPES[actionIdx];
    }
    if (typeof action === "string" && action.length > 0) return action;
    return `UNKNOWN_ACTION_${String(action)}`;
}

function filterByTrials(entries: AuditLogEntry[], trialIdSet: Set<string>): AuditLogEntry[] {
    if (trialIdSet.size === 0) return entries;
    return entries.filter((row) => trialIdSet.has(row.trialId));
}

function mapDetailedEvent(ev: EventLog): AuditLogEntry {
    const args = ev.args as unknown as {
        action: unknown;
        trialId: bigint;
        patientHash: string;
        timestamp: bigint;
        performer: string;
    };
    return {
        id: `${ev.transactionHash}-${ev.index}`,
        actionType: actionTypeFromIndex(args.action),
        trialId: args.trialId.toString(),
        patientHash: String(args.patientHash),
        timestamp: new Date(Number(args.timestamp) * 1000),
        performer: String(args.performer).toLowerCase(),
        transactionHash: ev.transactionHash,
        source: "chain",
    };
}

async function fetchViaDetailedEvents(
    provider: Provider,
    trialIdSet: Set<string>,
): Promise<AuditLogEntry[] | null> {
    const contract = getDataAccessLog(provider);
    const trialIds = [...trialIdSet];

    try {
        let events: Awaited<ReturnType<typeof contract.queryFilter>> = [];

        if (trialIds.length > 0 && trialIds.length <= PARALLEL_TRIAL_EVENT_QUERIES) {
            const batches = await Promise.all(
                trialIds.map((trialId) =>
                    contract.queryFilter(
                        contract.filters.DetailedActionLogged(null, BigInt(trialId), null),
                        DATA_ACCESS_LOG_FROM_BLOCK,
                        "latest",
                    ),
                ),
            );
            events = batches.flat();
        } else {
            events = await contract.queryFilter(
                contract.filters.DetailedActionLogged(),
                DATA_ACCESS_LOG_FROM_BLOCK,
                "latest",
            );
        }

        const seen = new Set<string>();
        const entries: AuditLogEntry[] = [];

        for (const ev of events) {
            if (!("args" in ev) || ev.args == null) continue;
            const key = `${ev.transactionHash}-${ev.index}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push(mapDetailedEvent(ev as EventLog));
        }

        entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return filterByTrials(entries, trialIdSet).slice(0, MAX_DISPLAY_LOGS);
    } catch (err) {
        console.warn("[auditLogFetch] DetailedActionLogged query failed:", err);
        return null;
    }
}

/** Fallback: parallel `getLog` reads (only last N ring-buffer slots). */
async function fetchViaGetLogBatch(
    provider: Provider,
    trialIdSet: Set<string>,
): Promise<AuditLogEntry[]> {
    const contract = getDataAccessLog(provider);
    const count = Number(await contract.getLogCount());
    if (count === 0) return [];

    const start = Math.max(0, count - MAX_DISPLAY_LOGS);
    const indices: number[] = [];
    for (let i = count - 1; i >= start; i--) indices.push(i);

    const entries: AuditLogEntry[] = [];

    for (let offset = 0; offset < indices.length; offset += GET_LOG_BATCH_SIZE) {
        const chunk = indices.slice(offset, offset + GET_LOG_BATCH_SIZE);
        const rows = await Promise.all(chunk.map((i) => contract.getLog(i)));
        for (let j = 0; j < rows.length; j++) {
            const log = rows[j];
            const trialId = log.trialId.toString();
            if (trialIdSet.size > 0 && !trialIdSet.has(trialId)) continue;
            entries.push({
                id: `chain-${chunk[j]}`,
                actionType: actionTypeFromIndex(log.action),
                trialId,
                patientHash: String(log.patientHash),
                timestamp: new Date(Number(log.timestamp) * 1000),
                performer: String(log.performer).toLowerCase(),
                source: "chain",
            });
        }
    }

    return entries;
}

/**
 * Fast path: one (or few) `eth_getLogs` via DetailedActionLogged.
 * Slow path: batched parallel getLog reads on the ring buffer tail only.
 */
export async function fetchAuditLogsFromChain(
    provider: Provider,
    trialIdSet: Set<string>,
): Promise<AuditLogEntry[]> {
    const fromEvents = await fetchViaDetailedEvents(provider, trialIdSet);
    if (fromEvents) return fromEvents;
    return fetchViaGetLogBatch(provider, trialIdSet);
}
