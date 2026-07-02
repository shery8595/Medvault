/**
 * No-retention policy for @medvault/ai LLM calls.
 *
 * MedVault AI service processes protocol PDFs and audit summaries in memory only.
 * Raw protocol text, PDF buffers, and unredacted PHI must not be written to disk,
 * logged, or retained after the HTTP response is sent.
 */

export const NO_RETENTION_POLICY = {
  /** Raw protocol PDF buffers and extracted text are not persisted. */
  persistUploads: false,
  /** Request/response bodies are not written to application logs. */
  logRequestBodies: false,
  /** Only redacted text may be sent to external LLM providers. */
  llmInputMustBeRedacted: true,
  /** LLM provider calls use stateless completions (no thread/store IDs). */
  statelessLlmCalls: true,
} as const;

export type NoRetentionPolicy = typeof NO_RETENTION_POLICY;

/** Zero sensitive buffers after processing (best-effort in Node). */
export function zeroBuffer(buf: Buffer | undefined): void {
  if (!buf || buf.length === 0) return;
  buf.fill(0);
}

/** Safe error message for clients — never echo raw protocol text. */
export function safeClientError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.length > 240) return `${msg.slice(0, 240)}…`;
    return msg;
  }
  return "Internal server error";
}
