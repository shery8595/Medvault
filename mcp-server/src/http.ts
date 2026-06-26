#!/usr/bin/env node
/**
 * Streamable HTTP MCP transport for ChatGPT Connectors / OpenClaw remote mode.
 * Default: http://127.0.0.1:3100/mcp
 */
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MedVaultMcpContext } from "./context.js";
import { createMedVaultMcpServer } from "./server.js";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 3100);
const HOST = process.env.MCP_HTTP_HOST ?? "127.0.0.1";

async function main() {
  const ctx = new MedVaultMcpContext(undefined, "http");
  const mcp = createMedVaultMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });
  await mcp.connect(transport);

  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "medvault-mcp" }));
      return;
    }
    if (req.url?.startsWith("/mcp")) {
      await transport.handleRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, HOST, () => {
    console.error(`[medvault-mcp] HTTP listening on http://${HOST}:${PORT}/mcp`);
  });
}

main().catch((err) => {
  console.error("[medvault-mcp] HTTP fatal:", err);
  process.exit(1);
});
