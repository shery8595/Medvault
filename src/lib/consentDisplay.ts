import type { ConsentLog } from "../types";

export type ConsentRowVariant = "active" | "pending" | "revoked" | "expiring";

export function consentRowVariant(log: ConsentLog): ConsentRowVariant {
  const s = (log.status || "").toLowerCase();
  if (s === "rejected" || s === "revoked" || log.granted === false) return "revoked";
  if (s === "pending") return "pending";

  const now = Math.floor(Date.now() / 1000);
  if (log.expiresAt && log.expiresAt > now) {
    const daysLeft = Math.ceil((log.expiresAt - now) / 86400);
    if (daysLeft <= 30) return "expiring";
  }

  return "active";
}

/** Whether the patient can call on-chain `revokeConsent` for this row. */
export function canRevokeConsent(log: ConsentLog): boolean {
  return consentRowVariant(log) !== "revoked" && log.trialId != null && String(log.trialId) !== "";
}

export function formatGrantedUtc(rawTimestamp?: number): { date: string; time: string } {
  if (rawTimestamp == null || Number.isNaN(rawTimestamp)) {
    return { date: "—", time: "" };
  }
  const d = new Date(rawTimestamp * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return { date: `${y}.${m}.${day}`, time: `${h}:${min} UTC` };
}

export function formatExpires(log: ConsentLog): { date: string; sub: string } {
  const now = Math.floor(Date.now() / 1000);
  if (!log.expiresAt || log.expiresAt <= 0) {
    if (consentRowVariant(log) === "revoked") {
      const { date } = formatGrantedUtc(log.rawTimestamp);
      return { date, sub: "Access revoked" };
    }
    return { date: "—", sub: "No expiry set" };
  }
  const { date } = formatGrantedUtc(log.expiresAt);
  const daysLeft = Math.ceil((log.expiresAt - now) / 86400);
  if (daysLeft < 0) return { date, sub: "Expired" };
  if (daysLeft === 0) return { date, sub: "Expires today" };
  if (daysLeft === 1) return { date, sub: "1 day left" };
  return { date, sub: `${daysLeft} days left` };
}

export function exportConsentLogsCsv(logs: ConsentLog[], filename = "medvault-consent-logs.csv") {
  const header = ["Trial", "Sponsor", "Status", "Granted", "Expires", "Data shared"];
  const rows = logs.map((l) => {
    const g = formatGrantedUtc(l.rawTimestamp);
    const e = formatExpires(l);
    return [
      l.trialName,
      l.sponsorName ?? "",
      l.status ?? "",
      `${g.date} ${g.time}`.trim(),
      `${e.date} ${e.sub}`.trim(),
      (l.dataShared ?? []).join("; "),
    ];
  });
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function trialIconIndex(trialId: string | undefined): number {
  if (!trialId) return 0;
  let h = 0;
  for (let i = 0; i < trialId.length; i++) h = (h + trialId.charCodeAt(i)) % 4;
  return h;
}
