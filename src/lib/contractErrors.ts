/** Map common on-chain revert strings to actionable UI copy. */
export function friendlyContractError(err: unknown): string {
  const raw = extractRevertText(err);
  const lower = raw.toLowerCase();

  if (lower.includes("stale stage permit")) {
    return "Stale stage permit — sign a new apply authorization with a later deadline and try again.";
  }
  if (lower.includes("trial not open") || lower.includes("trial ended") || lower.includes("not open for registration")) {
    return "This trial is not open for pool registration (trial must be active and before end time).";
  }
  if (lower.includes("engine not set") || lower.includes("eligibility engine not set")) {
    return "Eligibility engine is not wired yet. Try again after protocol deployment finishes.";
  }
  if (lower.includes("noir attestation required")) {
    return "Complete ZK attestation (Noir seal) during anonymous apply before joining the reward pool.";
  }
  if (lower.includes("is trial sponsor verified") || lower.includes("sponsor not verified")) {
    return "Trial sponsor is not verified on SponsorRegistry.";
  }

  return raw;
}

function extractRevertText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "Transaction failed");
  const e = err as Record<string, unknown>;
  if (typeof e.reason === "string" && e.reason) return e.reason;
  if (typeof e.shortMessage === "string") return e.shortMessage;
  if (typeof e.message === "string") return e.message;
  return "Transaction failed";
}

export function isStaleStagePermitError(text: string): boolean {
  return text.toLowerCase().includes("stale stage permit");
}
