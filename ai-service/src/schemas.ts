import Ajv from "ajv";
import type { TrialCriteriaFields } from "./types.js";

/** JSON Schema for criteria extraction LLM output (matches TrialManager FHE field set). */
export const CRITERIA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "minAge",
    "maxAge",
    "requiresDiabetes",
    "minHb",
    "genderRequirement",
    "minHeight",
    "maxWeight",
    "requiresNonSmoker",
    "requiresNormalBP",
  ],
  properties: {
    minAge: { type: "integer", minimum: 0, maximum: 120 },
    maxAge: { type: "integer", minimum: 0, maximum: 120 },
    requiresDiabetes: { type: "boolean" },
    minHb: { type: "integer", minimum: 0, maximum: 255 },
    genderRequirement: { type: "integer", enum: [0, 1, 2] },
    minHeight: { type: "integer", minimum: 0, maximum: 300 },
    maxWeight: { type: "integer", minimum: 0, maximum: 65535 },
    requiresNonSmoker: { type: "boolean" },
    requiresNormalBP: { type: "boolean" },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateCriteriaSchema = ajv.compile(CRITERIA_JSON_SCHEMA);

export const NER_REDACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entities"],
  properties: {
    entities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text"],
        properties: {
          type: {
            type: "string",
            enum: [
              "PATIENT_NAME",
              "DOB",
              "MRN",
              "PHONE",
              "EMAIL",
              "SSN",
              "ADDRESS",
              "OTHER_PHI",
            ],
          },
          text: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

const validateNerSchema = ajv.compile(NER_REDACTION_JSON_SCHEMA);

export function validateExtractedCriteria(data: unknown): {
  ok: true;
  criteria: TrialCriteriaFields;
} | { ok: false; errors: string[] } {
  if (!validateCriteriaSchema(data)) {
    return {
      ok: false,
      errors: (validateCriteriaSchema.errors ?? []).map(
        (e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`
      ),
    };
  }
  const c = data as TrialCriteriaFields;
  if (c.minAge > c.maxAge) {
    return { ok: false, errors: ["minAge must be <= maxAge"] };
  }
  return { ok: true, criteria: c };
}

export function validateNerOutput(data: unknown): boolean {
  return validateNerSchema(data);
}
