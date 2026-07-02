const INDEXER_URL = import.meta.env.VITE_INDEXER_URL as string | undefined;

export function isIndexerConfigured(): boolean {
  return Boolean(INDEXER_URL?.trim());
}

export function getIndexerBaseUrl(): string | undefined {
  const url = INDEXER_URL?.trim();
  return url || undefined;
}

type IndexerRoute =
  | { kind: "trials"; active?: boolean }
  | { kind: "sponsorStats"; sponsor: string }
  | { kind: "trialApplications"; trialId: string };

/** Map known GraphQL query names to indexer REST endpoints. */
export function mapQueryToIndexerRoute(query: string, variables?: Record<string, unknown>): IndexerRoute | null {
  const name = query.match(/query\s+([A-Za-z0-9_]+)/)?.[1];
  if (!name) return null;

  switch (name) {
    case "GetActiveTrials":
      return { kind: "trials", active: true };
    case "GetTrialsBySponsor":
    case "GetSponsorStats":
    case "GetSponsorData":
      if (variables?.sponsor) {
        return { kind: "sponsorStats", sponsor: String(variables.sponsor) };
      }
      return null;
    default:
      return null;
  }
}

function indexerPath(route: IndexerRoute): string {
  switch (route.kind) {
    case "trials":
      return route.active ? "/trials?active=true" : "/trials";
    case "sponsorStats":
      return `/sponsor/${encodeURIComponent(route.sponsor)}/stats`;
    case "trialApplications":
      return `/trial/${encodeURIComponent(route.trialId)}/applications`;
  }
}

/** Transform indexer JSON into GraphQL-shaped payload expected by hooks. */
export function shapeIndexerResponse(route: IndexerRoute, body: Record<string, unknown>): unknown {
  switch (route.kind) {
    case "trials":
      return { trials: body.trials ?? [] };
    case "sponsorStats":
      return { sponsor: (body as { sponsor?: unknown }).sponsor ?? body };
    case "trialApplications":
      return body;
    default:
      return body;
  }
}

export async function fetchFromIndexer<T>(
  route: IndexerRoute,
  timeoutMs = 2500
): Promise<T | null> {
  const base = getIndexerBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const health = await fetch(`${base.replace(/\/$/, "")}/health`, {
      signal: controller.signal,
    });
    if (!health.ok) return null;

    const res = await fetch(`${base.replace(/\/$/, "")}${indexerPath(route)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    return shapeIndexerResponse(route, body) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
