/**
 * Plan 07 — AI criteria extraction + PHI redaction roundtrip.
 * CI-safe: no live LLM calls; tests redaction, schema validation, heuristic extraction, NER fallback.
 */
import { expect } from "chai";
import {
  redactProtocolRegexOnly,
  redactProtocol,
  extractCriteriaHeuristic,
  validateExtractedCriteria,
  createAiServiceApp,
  type AiServiceConfig,
} from "@medvault/ai/lib";
import type { Express } from "express";
import { createServer, type Server } from "node:http";

const SEEDED_PHI_PROTOCOL = `
Clinical Trial Protocol — Phase 2 Diabetes Study

Patient Jane Doe (DOB 03/15/1985, MRN: 44556677) was referenced in an appendix example.
Contact coordinator at jane.doe@example.org or (555) 123-4567.
SSN 123-45-6789 for legacy form only.
Site address: 742 Evergreen Terrace, Springfield.

Eligibility:
- Age between 21 and 55 years
- Type 2 diabetes with HbA1c under 8.5%
- Hemoglobin at least 11.0 g/dL
- Non-smokers only
- Female participants only
- Minimum height 160 cm
- Maximum weight 95 kg
- Normal blood pressure required
`;

const SEEDED_TOKENS = [
  "Jane Doe",
  "03/15/1985",
  "44556677",
  "jane.doe@example.org",
  "(555) 123-4567",
  "123-45-6789",
  "742 Evergreen Terrace",
];

function mockAiConfig(overrides: Partial<AiServiceConfig> = {}): AiServiceConfig {
  return {
    port: 0,
    openaiBaseUrl: "https://api.openai.com/v1",
    openaiApiKey: "",
    openaiModel: "gpt-4o-mini",
    openaiRedactModel: "gpt-4o-mini",
    regexOnly: true,
    rpcUrl: "http://127.0.0.1:8545",
    subgraphUrl: "",
    ...overrides,
  };
}

async function listen(app: Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no address"));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe("AI criteria + PHI redaction (Plan 07)", () => {
  it("redacts seeded PHI tokens and reports expected count", () => {
    const { redactedText, report } = redactProtocolRegexOnly(SEEDED_PHI_PROTOCOL, ["Jane Doe"]);

    expect(report.tokensRedacted).to.be.greaterThan(0);
    expect(report.regexOnly).to.equal(true);
    expect(report.nerUsed).to.equal(false);

    for (const token of SEEDED_TOKENS) {
      expect(redactedText).to.not.include(token);
    }
  });

  it("extracts criteria from redacted protocol text (heuristic / no LLM)", () => {
    const { redactedText } = redactProtocolRegexOnly(SEEDED_PHI_PROTOCOL, ["Jane Doe"]);
    const criteria = extractCriteriaHeuristic(redactedText);

    const validated = validateExtractedCriteria(criteria);
    expect(validated.ok).to.equal(true);
    if (!validated.ok) return;

    expect(validated.criteria.minAge).to.equal(21);
    expect(validated.criteria.maxAge).to.equal(55);
    expect(validated.criteria.requiresDiabetes).to.equal(true);
    expect(validated.criteria.requiresNonSmoker).to.equal(true);
    expect(validated.criteria.genderRequirement).to.equal(2);
    expect(validated.criteria.minHeight).to.equal(160);
    expect(validated.criteria.maxWeight).to.equal(95);
    expect(validated.criteria.requiresNormalBP).to.equal(true);
  });

  it("rejects malformed criteria via JSON schema validation", () => {
    const bad = {
      minAge: 70,
      maxAge: 18,
      requiresDiabetes: "yes",
      minHb: 999,
      genderRequirement: 9,
      minHeight: 0,
      maxWeight: 0,
      requiresNonSmoker: false,
      requiresNormalBP: false,
    };
    const result = validateExtractedCriteria(bad);
    expect(result.ok).to.equal(false);
    if (result.ok) return;
    expect(result.errors.length).to.be.greaterThan(0);
  });

  it("NER failure falls back to regex-only and still redacts high-signal tokens", async () => {
    const config = mockAiConfig({ openaiApiKey: "test-key", regexOnly: false });
    const { redactedText, report } = await redactProtocol(SEEDED_PHI_PROTOCOL, config, {
      nerPass: async () => {
        throw new Error("simulated NER outage");
      },
    });

    expect(report.regexOnly).to.equal(true);
    expect(report.nerUsed).to.equal(false);
    const highSignal = [
      "jane.doe@example.org",
      "(555) 123-4567",
      "123-45-6789",
      "03/15/1985",
    ];
    for (const token of highSignal) {
      expect(redactedText).to.not.include(token);
    }
  });

  it("NER success path redacts entities returned by NER pass", async () => {
    const config = mockAiConfig({ openaiApiKey: "test-key", regexOnly: false });
    const { redactedText, report } = await redactProtocol(SEEDED_PHI_PROTOCOL, config, {
      blocklist: ["Jane Doe"],
      nerPass: async () => [{ type: "OTHER_PHI", text: "Springfield" }],
    });
    expect(report.nerUsed).to.equal(true);
    expect(redactedText).to.not.include("Springfield");
  });

  it("POST /ai/extract-criteria returns criteria + redactionReport for text body", async () => {
    const app = createAiServiceApp(mockAiConfig());
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/ai/extract-criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: SEEDED_PHI_PROTOCOL }),
      });
      expect(res.ok).to.equal(true);
      const body = (await res.json()) as {
        criteria: { minAge: number };
        redactionReport: { tokensRedacted: number };
      };
      expect(body.criteria.minAge).to.equal(21);
      expect(body.redactionReport.tokensRedacted).to.be.greaterThan(0);
    } finally {
      server.close();
    }
  });

  it("POST /ai/audit-logs summarizes supplied anonymized events", async () => {
    const app = createAiServiceApp(mockAiConfig());
    const { server, url } = await listen(app);
    try {
      const res = await fetch(`${url}/ai/audit-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: [
            {
              id: "1",
              actionType: "PROFILE_SUBMISSION",
              trialId: "1",
              patientHash: "0xabc",
              timestamp: new Date().toISOString(),
              performer: "0xsponsor",
            },
            {
              id: "2",
              actionType: "ELIGIBILITY_CHECKED",
              trialId: "1",
              patientHash: "0xdef",
              timestamp: new Date().toISOString(),
              performer: "0xsponsor",
            },
          ],
        }),
      });
      expect(res.ok).to.equal(true);
      const body = (await res.json()) as { totalEvents: number; matchRatePercent: number };
      expect(body.totalEvents).to.equal(2);
      expect(body.matchRatePercent).to.be.a("number");
    } finally {
      server.close();
    }
  });
});
