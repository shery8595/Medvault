import OpenAI from "openai";
import type { AiServiceConfig } from "./config.js";
import { NER_REDACTION_JSON_SCHEMA, validateNerOutput } from "./schemas.js";
import type { RedactionEntity, RedactionEntityType, RedactionReport } from "./types.js";

const TOKEN_PREFIX: Record<RedactionEntityType, string> = {
  PATIENT_NAME: "PATIENT_NAME",
  DOB: "DOB",
  MRN: "MRN",
  PHONE: "PHONE",
  EMAIL: "EMAIL",
  SSN: "SSN",
  ADDRESS: "ADDRESS",
  OTHER_PHI: "PHI",
};

const TYPE_COUNTERS: Record<RedactionEntityType, number> = {
  PATIENT_NAME: 0,
  DOB: 0,
  MRN: 0,
  PHONE: 0,
  EMAIL: 0,
  SSN: 0,
  ADDRESS: 0,
  OTHER_PHI: 0,
};

function nextToken(type: RedactionEntityType): string {
  TYPE_COUNTERS[type] += 1;
  return `[${TOKEN_PREFIX[type]}_${TYPE_COUNTERS[type]}]`;
}

function resetCounters(): void {
  for (const k of Object.keys(TYPE_COUNTERS) as RedactionEntityType[]) {
    TYPE_COUNTERS[k] = 0;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** High-signal PHI patterns — always applied before any LLM call. */
const REGEX_PATTERNS: { type: RedactionEntityType; pattern: RegExp }[] = [
  { type: "EMAIL", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: "PHONE", pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g },
  {
    type: "SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: "DOB",
    pattern:
      /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,
  },
  {
    type: "DOB",
    pattern: /\b(?:19|20)\d{2}-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])\b/g,
  },
  {
    type: "MRN",
    pattern: /\b(?:MRN|Medical Record|Patient ID|Record #?)\s*[:#]?\s*[\w-]{4,}\b/gi,
  },
  {
    type: "ADDRESS",
    pattern:
      /\b\d{1,5}\s+(?:[A-Za-z0-9.'-]+\s+){1,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Terrace)\b/gi,
  },
];

function applyRegexSweep(text: string, blocklist: string[]): {
  redacted: string;
  entities: RedactionEntity[];
} {
  const entities: RedactionEntity[] = [];
  let redacted = text;

  for (const name of blocklist) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;
    const re = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(redacted)) !== null) {
      const token = nextToken("PATIENT_NAME");
      entities.push({ type: "PATIENT_NAME", token });
      redacted = redacted.slice(0, match.index) + token + redacted.slice(match.index + match[0].length);
      re.lastIndex = match.index + token.length;
    }
  }

  for (const { type, pattern } of REGEX_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(redacted)) !== null) {
      const token = nextToken(type);
      entities.push({ type, token });
      redacted = redacted.slice(0, match.index) + token + redacted.slice(match.index + match[0].length);
      re.lastIndex = match.index + token.length;
    }
  }

  return { redacted, entities };
}

function applyNerEntities(
  text: string,
  nerEntities: { type: RedactionEntityType; text: string }[]
): { redacted: string; entities: RedactionEntity[] } {
  const entities: RedactionEntity[] = [];
  let redacted = text;

  const sorted = [...nerEntities].sort((a, b) => b.text.length - a.text.length);
  for (const ent of sorted) {
    const needle = ent.text.trim();
    if (needle.length < 2) continue;
    const re = new RegExp(escapeRegExp(needle), "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(redacted)) !== null) {
      const token = nextToken(ent.type);
      entities.push({ type: ent.type, token });
      redacted = redacted.slice(0, match.index) + token + redacted.slice(match.index + match[0].length);
      re.lastIndex = match.index + token.length;
    }
  }

  return { redacted, entities };
}

async function runNerPass(
  client: OpenAI,
  model: string,
  text: string
): Promise<{ type: RedactionEntityType; text: string }[] | null> {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "phi_entities",
        strict: true,
        schema: NER_REDACTION_JSON_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "Extract PHI entities from clinical protocol text. Return ONLY patient-identifying entities (names, DOB, MRN, phone, email, SSN/national ID, street addresses). Do NOT extract clinical criteria, lab values, or trial eligibility bounds.",
      },
      { role: "user", content: text },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!validateNerOutput(parsed)) return null;
  return (parsed as { entities: { type: RedactionEntityType; text: string }[] }).entities;
}

export interface RedactOptions {
  blocklist?: string[];
  regexOnly?: boolean;
  /** Test hook: override NER pass (throw to simulate NER failure). */
  nerPass?: (text: string) => Promise<{ type: RedactionEntityType; text: string }[] | null>;
}

export function createOpenAiClient(config: Pick<AiServiceConfig, "openaiBaseUrl" | "openaiApiKey">): OpenAI {
  return new OpenAI({
    apiKey: config.openaiApiKey || "not-configured",
    baseURL: config.openaiBaseUrl,
  });
}

/**
 * Redact PHI from protocol text BEFORE any criteria-extraction LLM call.
 * Un-redacted input must not be persisted or logged by callers.
 */
export async function redactProtocol(
  text: string,
  config: AiServiceConfig,
  options: RedactOptions = {}
): Promise<{ redactedText: string; report: RedactionReport }> {
  resetCounters();
  const blocklist = options.blocklist ?? [];
  const regexOnly = options.regexOnly ?? config.regexOnly;

  const regexResult = applyRegexSweep(text, blocklist);
  let redactedText = regexResult.redacted;
  const entities = [...regexResult.entities];
  let nerUsed = false;

  if (!regexOnly && config.openaiApiKey) {
    try {
      const nerEntities = options.nerPass
        ? await options.nerPass(redactedText)
        : await runNerPass(createOpenAiClient(config), config.openaiRedactModel, redactedText);
      if (nerEntities && nerEntities.length > 0) {
        const nerResult = applyNerEntities(redactedText, nerEntities);
        redactedText = nerResult.redacted;
        entities.push(...nerResult.entities);
        nerUsed = true;
      }
    } catch {
      /* NER failure — regex-only fallback (already applied) */
    }
  }

  const tokensRedacted = entities.length;
  return {
    redactedText,
    report: {
      tokensRedacted,
      entities,
      fullyRedacted: tokensRedacted > 0,
      nerUsed,
      regexOnly: !nerUsed,
    },
  };
}

/** Test helper: regex-only redaction without LLM. */
export function redactProtocolRegexOnly(text: string, blocklist: string[] = []): {
  redactedText: string;
  report: RedactionReport;
} {
  resetCounters();
  const regexResult = applyRegexSweep(text, blocklist);
  return {
    redactedText: regexResult.redacted,
    report: {
      tokensRedacted: regexResult.entities.length,
      entities: regexResult.entities,
      fullyRedacted: regexResult.entities.length > 0,
      nerUsed: false,
      regexOnly: true,
    },
  };
}
