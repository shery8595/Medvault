import OpenAI from "openai";
import { ethers } from "ethers";
import { fetchAuditLogsFromChain } from "@medvault/core";
import type { AiServiceConfig } from "./config.js";
import { createOpenAiClient } from "./redaction.js";
import type { AuditLogInput, AuditLogsSummary } from "./types.js";

function countByAction(logs: AuditLogInput[], action: string): number {
  return logs.filter((l) => l.actionType === action).length;
}

/** Rule-based summary when LLM is unavailable. */
export function summarizeAuditLogsHeuristic(logs: AuditLogInput[]): AuditLogsSummary {
  const totalEvents = logs.length;
  const eligibilityChecked = countByAction(logs, "ELIGIBILITY_CHECKED");
  const consentsGranted = countByAction(logs, "CONSENT_GRANTED");
  const applicationsChanged = countByAction(logs, "APPLICATION_STATUS_CHANGED");
  const profileSubmissions = countByAction(logs, "PROFILE_SUBMISSION");

  const funnelTop = Math.max(profileSubmissions, consentsGranted, eligibilityChecked, 1);
  const matchRatePercent =
    totalEvents === 0 ? 0 : Math.round((eligibilityChecked / funnelTop) * 100);

  const bottleneckCriteria: string[] = [];
  if (profileSubmissions > 0 && consentsGranted / profileSubmissions < 0.5) {
    bottleneckCriteria.push("Consent conversion below 50% — review consent copy and trial visibility");
  }
  if (consentsGranted > 0 && eligibilityChecked / consentsGranted < 0.4) {
    bottleneckCriteria.push("Eligibility checks lag consents — criteria may be too strict or data incomplete");
  }
  if (applicationsChanged > 0 && eligibilityChecked > applicationsChanged * 2) {
    bottleneckCriteria.push("High eligibility volume vs application decisions — sponsor review queue bottleneck");
  }
  if (bottleneckCriteria.length === 0 && totalEvents > 0) {
    bottleneckCriteria.push("No major funnel bottleneck detected in anonymized audit events");
  }
  if (totalEvents === 0) {
    bottleneckCriteria.push("No audit events indexed — subgraph or chain fetch may be empty");
  }

  return {
    matchRatePercent,
    totalEvents,
    eligibilityChecked,
    consentsGranted,
    applicationsChanged,
    bottleneckCriteria,
    narrative: `Analyzed ${totalEvents} anonymized DataAccessLog events. Eligibility checks: ${eligibilityChecked}. Estimated funnel match rate: ${matchRatePercent}%.`,
  };
}

async function summarizeWithLlm(
  client: OpenAI,
  model: string,
  logs: AuditLogInput[],
  heuristic: AuditLogsSummary
): Promise<string> {
  const sample = logs.slice(0, 80).map((l) => ({
    action: l.actionType,
    trialId: l.trialId,
    ts: l.timestamp,
  }));

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "Summarize clinical trial recruitment funnel health from anonymized on-chain audit events. No PHI. Mention match rate and bottlenecks in 2-4 sentences.",
      },
      {
        role: "user",
        content: JSON.stringify({ heuristic, sampleEvents: sample }),
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || heuristic.narrative;
}

export interface AuditLogsRequest {
  trialIds?: string[];
  logs?: AuditLogInput[];
}

/**
 * Audit log analysis using Plan 00b non-truncating fetch when logs are not supplied.
 * Propagates fetch failures instead of silently returning partial data.
 */
export async function auditLogs(
  config: AiServiceConfig,
  request: AuditLogsRequest
): Promise<AuditLogsSummary> {
  let logs = request.logs ?? [];

  // Only fetch on-chain when the caller did not supply a logs array (e.g. MCP with trialIds only).
  if (request.logs === undefined && request.trialIds && request.trialIds.length > 0) {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const trialIdSet = new Set(request.trialIds);
    const chainLogs = await fetchAuditLogsFromChain(provider, trialIdSet);
    logs = chainLogs.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      trialId: row.trialId,
      patientHash: row.patientHash,
      timestamp: row.timestamp,
      performer: row.performer,
    }));
  }

  const heuristic = summarizeAuditLogsHeuristic(logs);

  if (!config.openaiApiKey) {
    return heuristic;
  }

  try {
    const client = createOpenAiClient(config);
    const narrative = await summarizeWithLlm(client, config.openaiModel, logs, heuristic);
    return { ...heuristic, narrative };
  } catch {
    return heuristic;
  }
}
