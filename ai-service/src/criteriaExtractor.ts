import OpenAI from "openai";
import type { AiServiceConfig } from "./config.js";
import { CRITERIA_JSON_SCHEMA, validateExtractedCriteria } from "./schemas.js";
import { createOpenAiClient, redactProtocol } from "./redaction.js";
import { pdfBufferToText } from "./pdfText.js";
import type { ExtractCriteriaResponse, TrialCriteriaFields } from "./types.js";

const EXTRACTION_SYSTEM_PROMPT = `You extract clinical trial eligibility criteria from a REDACTED protocol document.
Return JSON matching the schema. Use these field meanings:
- minAge/maxAge: inclusive age bounds in years
- requiresDiabetes: true if Type 1 or Type 2 diabetes is required
- minHb: minimum hemoglobin g/dL (default 100 if unspecified)
- genderRequirement: 0=any, 1=male only, 2=female only
- minHeight: minimum height in cm (0 if not specified)
- maxWeight: maximum weight in kg (0 if no max)
- requiresNonSmoker: true if non-smokers only
- requiresNormalBP: true if normal blood pressure required
Infer reasonable defaults when the protocol is silent. PHI placeholders like [PATIENT_NAME_1] are not real data.`;

/**
 * Deterministic heuristic extractor for tests and offline mode (no LLM).
 * Parses common patterns from redacted protocol text.
 */
export function extractCriteriaHeuristic(redactedText: string): TrialCriteriaFields {
  const text = redactedText.toLowerCase();
  const ageRange = text.match(/(?:age|aged)\s*(?:between\s*)?(\d{1,3})\s*(?:to|-|and)\s*(\d{1,3})/);
  const minAge = ageRange ? Number(ageRange[1]) : 18;
  const maxAge = ageRange ? Number(ageRange[2]) : 65;

  const hba1c = text.match(/hba1c\s*(?:≤|<=|under|below|max(?:imum)?)?\s*(\d+(?:\.\d+)?)/);
  const requiresDiabetes = /\bdiabetes\b|\btype\s*[12]\b|\bhba1c\b/.test(text);

  const hbMatch = text.match(/hemoglobin\s*(?:≥|>=|at least|min(?:imum)?)?\s*(\d+(?:\.\d+)?)/);
  const minHb = hbMatch ? Math.round(Number(hbMatch[1])) : requiresDiabetes && hba1c ? 100 : 100;

  let genderRequirement = 0;
  if (/\bmale\s+only\b|\bmen\s+only\b/.test(text)) genderRequirement = 1;
  if (/\bfemale\s+only\b|\bwomen\s+only\b|\bfemale\s+participants?\s+only\b/.test(text)) genderRequirement = 2;

  const heightMatch = text.match(/height\s*(?:≥|>=|at least|min(?:imum)?)?\s*(\d{2,3})\s*cm/);
  const minHeight = heightMatch ? Number(heightMatch[1]) : 0;

  const weightMatch = text.match(/weight\s*(?:≤|<=|under|max(?:imum)?)?\s*(\d{2,3})\s*kg/);
  const maxWeight = weightMatch ? Number(weightMatch[1]) : 0;

  const requiresNonSmoker = /\bnon[- ]?smok/.test(text) || /\bnever\s+smok/.test(text);
  const requiresNormalBP = /\bnormal\s+blood\s+pressure\b|\bnormotensive\b/.test(text);

  return {
    minAge,
    maxAge,
    requiresDiabetes,
    minHb,
    genderRequirement,
    minHeight,
    maxWeight,
    requiresNonSmoker,
    requiresNormalBP,
  };
}

async function extractWithLlm(
  client: OpenAI,
  model: string,
  redactedText: string
): Promise<TrialCriteriaFields> {
  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "trial_criteria",
        strict: true,
        schema: CRITERIA_JSON_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: redactedText.slice(0, 120_000) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("LLM returned empty criteria response");
  const parsed: unknown = JSON.parse(raw);
  const validated = validateExtractedCriteria(parsed);
  if (!validated.ok) {
    throw new Error(`Criteria schema validation failed: ${validated.errors.join("; ")}`);
  }
  return validated.criteria;
}

export interface ExtractFromTextOptions {
  blocklist?: string[];
  forceHeuristic?: boolean;
}

/** PDF buffer → text → redact → extract. Un-redacted text is never sent to extraction LLM. */
export async function extractCriteriaFromPdf(
  pdfBuffer: Buffer,
  config: AiServiceConfig,
  options: ExtractFromTextOptions = {}
): Promise<ExtractCriteriaResponse> {
  const rawText = await pdfBufferToText(pdfBuffer);
  return extractCriteriaFromText(rawText, config, options);
}

export async function extractCriteriaFromText(
  rawText: string,
  config: AiServiceConfig,
  options: ExtractFromTextOptions = {}
): Promise<ExtractCriteriaResponse> {
  const { redactedText, report } = await redactProtocol(rawText, config, {
    blocklist: options.blocklist,
  });

  let criteria: TrialCriteriaFields;
  if (options.forceHeuristic || !config.openaiApiKey) {
    criteria = extractCriteriaHeuristic(redactedText);
  } else {
    const client = createOpenAiClient(config);
    criteria = await extractWithLlm(client, config.openaiModel, redactedText);
  }

  const validated = validateExtractedCriteria(criteria);
  if (!validated.ok) {
    throw new Error(`Criteria schema validation failed: ${validated.errors.join("; ")}`);
  }

  return { criteria: validated.criteria, redactionReport: report };
}
