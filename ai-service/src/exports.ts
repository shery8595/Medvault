export { loadAiConfig, type AiServiceConfig } from "./config.js";
export { createAiServiceApp, startAiService } from "./server.js";
export {
  CRITERIA_JSON_SCHEMA,
  NER_REDACTION_JSON_SCHEMA,
  validateExtractedCriteria,
  validateNerOutput,
} from "./schemas.js";
export {
  redactProtocol,
  redactProtocolRegexOnly,
  createOpenAiClient,
  type RedactOptions,
} from "./redaction.js";
export {
  extractCriteriaFromPdf,
  extractCriteriaFromText,
  extractCriteriaHeuristic,
} from "./criteriaExtractor.js";
export { auditLogs, summarizeAuditLogsHeuristic } from "./logAuditor.js";
export { pdfBufferToText } from "./pdfText.js";
export { NO_RETENTION_POLICY, zeroBuffer, safeClientError } from "./retention.js";
export type { NoRetentionPolicy } from "./retention.js";
export type {
  TrialCriteriaFields,
  RedactionReport,
  RedactionEntity,
  ExtractCriteriaResponse,
  AuditLogInput,
  AuditLogsSummary,
} from "./types.js";
