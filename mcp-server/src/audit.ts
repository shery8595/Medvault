import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG = path.resolve(__dirname, "../../.mcp-audit.log");

export type McpAuditEntry = {
  ts: string;
  tool: string;
  signer?: string;
  trialId?: string;
  txHash?: string;
  ok: boolean;
  detail?: string;
};

export async function appendMcpAudit(entry: McpAuditEntry): Promise<void> {
  if (process.env.MCP_AUDIT_LOG === "false") return;
  const logPath = process.env.MCP_AUDIT_LOG_PATH?.trim() || DEFAULT_LOG;
  const line = JSON.stringify(entry) + "\n";
  try {
    await appendFile(logPath, line, "utf8");
  } catch {
    /* best-effort */
  }
}
