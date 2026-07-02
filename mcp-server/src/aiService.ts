function resolveAiServiceUrl(): string {
  const fromEnv =
    process.env.AI_SERVICE_URL?.trim() ||
    process.env.VITE_AI_SERVICE_URL?.trim() ||
    "http://127.0.0.1:3200";
  return fromEnv.replace(/\/$/, "");
}

export async function postAiExtractCriteria(body: {
  text?: string;
  pdfBase64?: string;
  blocklist?: string[];
}): Promise<unknown> {
  const base = resolveAiServiceUrl();

  if (body.pdfBase64) {
    const buffer = Buffer.from(body.pdfBase64, "base64");
    const form = new FormData();
    form.append("protocol", new Blob([buffer], { type: "application/pdf" }), "protocol.pdf");
    if (body.blocklist?.length) {
      form.append("blocklist", JSON.stringify(body.blocklist));
    }
    const res = await fetch(`${base}/ai/extract-criteria`, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) {
      throw new Error((json as { error?: string }).error ?? `AI extract failed (${res.status})`);
    }
    return json;
  }

  const res = await fetch(`${base}/ai/extract-criteria`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: body.text, blocklist: body.blocklist }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `AI extract failed (${res.status})`);
  }
  return json;
}

export async function postAiAuditLogs(body: {
  trialIds?: string[];
  logs?: unknown[];
}): Promise<unknown> {
  const base = resolveAiServiceUrl();
  const res = await fetch(`${base}/ai/audit-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: string }).error ?? `AI audit failed (${res.status})`);
  }
  return json;
}
