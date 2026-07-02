/** Anonymous apply pipeline statuses indexed by the subgraph. */
export type AnonymousSubmissionStatus =
  | "Staged"
  | "Pending"
  | "Accepted"
  | "Rejected"
  | "None"
  | string;

/**
 * Staged = FHE eligibility computed, finalize not completed (may be ineligible).
 * Sponsors must only see applications that finished finalize (identity attested).
 * "Accepted" application status = sponsor accepted the application, not medical eligibility.
 */
export function isSponsorVisibleAnonymousStatus(status: AnonymousSubmissionStatus | null | undefined): boolean {
  return status === "Pending" || status === "Accepted" || status === "Rejected";
}

export function filterSponsorVisibleSubmissions<T extends { status?: string }>(rows: T[] | undefined): T[] {
  return (rows ?? []).filter((row) => isSponsorVisibleAnonymousStatus(row.status));
}
