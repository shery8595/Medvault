import type { TrialCriteriaFields } from "./trialCriteriaNormalize";

export interface RedactionReport {
  tokensRedacted: number;
  entities: { type: string; token: string }[];
  fullyRedacted: boolean;
  nerUsed: boolean;
  regexOnly: boolean;
}

export interface ExtractCriteriaResult {
  criteria: TrialCriteriaFields;
  redactionReport: RedactionReport;
}

export interface AuditLogsSummary {
  matchRatePercent: number;
  totalEvents: number;
  eligibilityChecked: number;
  consentsGranted: number;
  applicationsChanged: number;
  bottleneckCriteria: string[];
  narrative: string;
}

function aiServiceBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_AI_SERVICE_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (import.meta.env.DEV) return "/ai-service";
  return "";
}

export function isAiServiceConfigured(): boolean {
  return Boolean(aiServiceBaseUrl());
}

export async function extractCriteriaFromProtocolPdf(
  file: File,
  blocklist?: string[]
): Promise<ExtractCriteriaResult> {
  const base = aiServiceBaseUrl();
  if (!base) {
    throw new Error("AI service URL is not configured (VITE_AI_SERVICE_URL)");
  }

  const form = new FormData();
  form.append("protocol", file);
  if (blocklist?.length) {
    form.append("blocklist", JSON.stringify(blocklist));
  }

  const res = await fetch(`${base}/ai/extract-criteria`, {
    method: "POST",
    body: form,
  });

  const body = (await res.json()) as ExtractCriteriaResult & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `AI extract failed (${res.status})`);
  }
  return body;
}

export async function fetchAiAuditSummary(
  trialIds: string[],
  logs?: Array<{
    id: string;
    actionType: string;
    trialId: string;
    patientHash: string;
    timestamp: string | Date;
    performer: string;
  }>
): Promise<AuditLogsSummary> {
  const base = aiServiceBaseUrl();
  if (!base) {
    throw new Error("AI service URL is not configured (VITE_AI_SERVICE_URL)");
  }

  const payload = {
    trialIds,
    logs: logs?.map((l) => ({
      ...l,
      timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
    })),
  };

  const res = await fetch(`${base}/ai/audit-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as AuditLogsSummary & { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `AI audit summary failed (${res.status})`);
  }
  return body;
}
