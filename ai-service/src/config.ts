import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadConfigFromEnv } from "@medvault/core";

const repoRootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
dotenv.config({ path: repoRootEnv });
dotenv.config();

export interface AiServiceConfig {
  port: number;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiRedactModel: string;
  regexOnly: boolean;
  /** When true (default), protocol uploads and LLM inputs are never persisted or logged. */
  noRetention: boolean;
  rpcUrl: string;
  subgraphUrl: string;
}

export function loadAiConfig(): AiServiceConfig {
  const core = loadConfigFromEnv();
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  return {
    port: Number(process.env.AI_SERVICE_PORT ?? 3200),
    openaiBaseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
    openaiApiKey: apiKey,
    openaiModel: model,
    openaiRedactModel: process.env.OPENAI_REDACT_MODEL?.trim() || model,
    regexOnly: process.env.AI_REDACT_REGEX_ONLY === "true",
    noRetention: process.env.AI_NO_RETENTION !== "false",
    rpcUrl: core.rpcUrl,
    subgraphUrl: core.subgraphUrl,
  };
}
