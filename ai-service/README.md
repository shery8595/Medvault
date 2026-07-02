# MedVault AI Service (`@medvault/ai`)

HTTP microservice for **PHI-safe** protocol criteria extraction and anonymized audit-log summarization. Used by the sponsor UI and MCP (`medvault_ai_extract_criteria`, `medvault_ai_audit_logs`).

**Stack:** TypeScript, Express, multer, OpenAI SDK, pdf-parse, ajv.

**Port:** `3200` (default via `AI_SERVICE_PORT`).

**No-retention policy:** Protocol PDFs and extracted text are processed **in memory only** — never written to disk or application logs. Only **redacted** text is sent to external LLM providers. Set `AI_NO_RETENTION=false` only for local debugging.

**No Dockerfile** — run via workspace scripts or wire into your own deployment.

## Quick start

```bash
npm run build -w @medvault/core
npm run dev -w @medvault/ai
# GET http://127.0.0.1:3200/health
```

## HTTP API (4 routes)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service status + LLM configuration |
| `POST` | `/ai/extract-criteria` | Extract trial criteria from PDF or text |
| `POST` | `/ai/audit-logs` | Summarize anonymized DataAccessLog events |
| `POST` | `/ai/validate-criteria` | Validate criteria JSON against schema |

### `GET /health`

```json
{
  "ok": true,
  "service": "@medvault/ai",
  "llmConfigured": true,
  "regexOnly": false,
  "noRetention": true
}
```

### `POST /ai/extract-criteria`

**Input (one of):**

1. **Multipart:** field `protocol` (PDF, max **12 MB**); optional `blocklist` (JSON array string or comma-separated names).
2. **JSON:** `{ "text": "...", "blocklist"?: string[] }`

**Pipeline:** PDF → `pdfBufferToText` → `redactProtocol` (regex + optional NER) → `extractWithLlm` or heuristic → `validateExtractedCriteria`.

**Response (`ExtractCriteriaResponse`):**

```json
{
  "criteria": {
    "minAge": 18,
    "maxAge": 65,
    "requiresDiabetes": false,
    "minHb": 100,
    "genderRequirement": 0,
    "minHeight": 0,
    "maxWeight": 0,
    "requiresNonSmoker": false,
    "requiresNormalBP": false
  },
  "redactionReport": {
    "tokensRedacted": 3,
    "entities": [{ "type": "PATIENT_NAME", "token": "[PATIENT_NAME_1]" }],
    "fullyRedacted": true,
    "nerUsed": true,
    "regexOnly": false
  }
}
```

**Criteria schema (9 fields)** — aligned with `TrialManager.createTrialWithEncryptedCriteria`:

| Field | Type | Notes |
|-------|------|-------|
| `minAge` / `maxAge` | integer 0–120 | Inclusive years |
| `requiresDiabetes` | boolean | Type 1/2 or HbA1c requirement |
| `minHb` | integer 0–255 | Minimum hemoglobin g/dL |
| `genderRequirement` | 0 \| 1 \| 2 | 0=any, 1=male, 2=female |
| `minHeight` | integer cm | 0 if unspecified |
| `maxWeight` | integer kg | 0 if no max |
| `requiresNonSmoker` | boolean | |
| `requiresNormalBP` | boolean | |

### `POST /ai/audit-logs`

**Request:** `{ "trialIds"?: string[], "logs"?: AuditLogInput[] }` — at least one required.

`AuditLogInput`: `id`, `actionType`, `trialId`, `patientHash`, `timestamp`, `performer`.

When `trialIds` are provided without `logs`, the service fetches anonymized events from chain via `@medvault/core` `fetchAuditLogsFromChain`.

**Response (`AuditLogsSummary`):**

```json
{
  "matchRatePercent": 42,
  "totalEvents": 120,
  "eligibilityChecked": 50,
  "consentsGranted": 80,
  "applicationsChanged": 25,
  "bottleneckCriteria": ["..."],
  "narrative": "..."
}
```

### `POST /ai/validate-criteria`

**Request:** raw criteria object.

**Success:** `{ "ok": true, "criteria": { ... } }`

**Failure:** `422` with `{ "ok": false, "errors": ["..."] }`

## Fallback modes

| Condition | Redaction | Extraction | Audit summary |
|-----------|-----------|------------|---------------|
| `OPENAI_API_KEY` unset | Regex + blocklist | Heuristic parser | Rule-based funnel |
| `AI_REDACT_REGEX_ONLY=true` | Regex only (no NER LLM) | LLM if key set, else heuristic | LLM if key set, else rules |
| API key + regex-only false | Regex + optional NER | OpenAI structured JSON | LLM narrative |

Heuristic extraction parses common age/gender/Hb patterns from **redacted** text only — unredacted protocol text is never sent to the extraction LLM.

## No-retention policy (LLM calls)

| Rule | Implementation |
|------|----------------|
| No disk persistence of uploads | `multer.memoryStorage()` only; buffers zeroed after response when `AI_NO_RETENTION` (default) |
| No request-body logging | Errors use `safeClientError` — raw protocol text never echoed |
| LLM input must be redacted | `redactProtocol` runs before `extractWithLlm` / NER |
| Stateless LLM calls | OpenAI chat completions without thread/store IDs |
| Audit log summaries | Only anonymized on-chain event metadata sent to LLM (`logAuditor.ts`) |

Policy constants: `ai-service/src/retention.ts` (`NO_RETENTION_POLICY`).

## PHI NER entity types

When NER redaction is enabled, detected types:

`PATIENT_NAME`, `DOB`, `MRN`, `PHONE`, `EMAIL`, `SSN`, `ADDRESS`, `OTHER_PHI`

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_SERVICE_PORT` | `3200` | HTTP listen port |
| `OPENAI_API_KEY` | — | Enables LLM extraction and NER |
| `OPENAI_MODEL` | `gpt-4o-mini` | Criteria extraction model |
| `OPENAI_REDACT_MODEL` | same as `OPENAI_MODEL` | NER redaction model |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Compatible API base |
| `AI_REDACT_REGEX_ONLY` | `false` | Skip NER LLM; regex + blocklist only |
| `AI_NO_RETENTION` | `true` (default) | In-memory-only processing; zero PDF buffers after response. Set `false` for local debug only |
| `SEPOLIA_RPC_URL` | via `@medvault/core` | Chain fetch for audit logs |
| `MEDVAULT_SUBGRAPH_URL` | via core | Subgraph URL (core config) |

## Related

- [mcp-server/README.md](../mcp-server/README.md) — MCP wrappers
- [packages/medvault-core/README.md](../packages/medvault-core/README.md) — `fetchAuditLogsFromChain`
