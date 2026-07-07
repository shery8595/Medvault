import cors from "cors";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import type { AiServiceConfig } from "./config.js";
import { extractCriteriaFromPdf, extractCriteriaFromText } from "./criteriaExtractor.js";
import { auditLogs } from "./logAuditor.js";
import { NO_RETENTION_POLICY, safeClientError, zeroBuffer } from "./retention.js";
import { validateExtractedCriteria } from "./schemas.js";
import type { AuditLogInput } from "./types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function createAiServiceApp(config: AiServiceConfig): Express {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "@medvault/ai",
      llmConfigured: Boolean(config.openaiApiKey),
      regexOnly: config.regexOnly,
      noRetention: config.noRetention && NO_RETENTION_POLICY.persistUploads === false,
    });
  });

  app.post(
    "/ai/extract-criteria",
    upload.single("protocol"),
    asyncHandler(async (req, res) => {
      const blocklistRaw = req.body?.blocklist;
      let blocklist: string[] | undefined;
      if (typeof blocklistRaw === "string" && blocklistRaw.trim()) {
        try {
          blocklist = JSON.parse(blocklistRaw) as string[];
        } catch {
          blocklist = blocklistRaw.split(",").map((s: string) => s.trim());
        }
      }

      let result;
      try {
        if (req.file?.buffer) {
          result = await extractCriteriaFromPdf(req.file.buffer, config, { blocklist });
        } else if (typeof req.body?.text === "string" && req.body.text.trim()) {
          result = await extractCriteriaFromText(req.body.text, config, { blocklist });
        } else {
          res.status(400).json({ error: "Provide multipart field 'protocol' (PDF) or JSON body { text }" });
          return;
        }

        res.json(result);
      } finally {
        if (config.noRetention) {
          zeroBuffer(req.file?.buffer);
        }
      }
    })
  );

  app.post(
    "/ai/audit-logs",
    asyncHandler(async (req, res) => {
      const trialIds = Array.isArray(req.body?.trialIds)
        ? (req.body.trialIds as unknown[]).map(String)
        : undefined;
      const logs = Array.isArray(req.body?.logs) ? (req.body.logs as AuditLogInput[]) : undefined;

      if ((!trialIds || trialIds.length === 0) && (!logs || logs.length === 0)) {
        res.status(400).json({ error: "Provide trialIds and/or logs array" });
        return;
      }

      const summary = await auditLogs(config, { trialIds, logs });
      res.json(summary);
    })
  );

  app.post("/ai/validate-criteria", (req, res) => {
    const validated = validateExtractedCriteria(req.body);
    if (!validated.ok) {
      res.status(422).json({ ok: false, errors: validated.errors });
      return;
    }
    res.json({ ok: true, criteria: validated.criteria });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = safeClientError(err);
    res.status(500).json({ error: message });
  });

  return app;
}

export function startAiService(app: Express, port: number): void {
  app.listen(port, () => {
    console.log(`[@medvault/ai] listening on :${port}`);
  });
}
