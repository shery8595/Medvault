#!/usr/bin/env node
/**
 * Smoke test: offline MCP checks + optional live Sepolia/subgraph checks.
 * Usage: node mcp-server/scripts/smoke-test.mjs [--live]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  checkWiring,
  getTrialPoolReclaimStatus,
  loadConfigFromEnv,
  postSubgraph,
  PROTOCOL_CONTRACTS,
} from "@medvault/core";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const MCP_ENTRY = path.join(REPO_ROOT, "mcp-server", "dist", "index.js");

const live = process.argv.includes("--live");

const SUBGRAPH_URL =
  process.env.MEDVAULT_SUBGRAPH_URL ||
  process.env.VITE_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1742459/medvault-final/v0.1.2";

const RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

let passed = 0;
let failed = 0;

function ok(name, detail = "") {
  passed++;
  console.log(`  OK  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, err) {
  failed++;
  console.error(`  FAIL ${name}`);
  console.error(`       ${err instanceof Error ? err.message : err}`);
}

function parseToolJson(result) {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error("No text content in tool result");
  return JSON.parse(text);
}

async function testBuildOutput() {
  console.log("\n=== Build output ===\n");
  try {
    await access(MCP_ENTRY);
    ok("mcp-server/dist/index.js exists");
  } catch {
    fail("build output", "Run npm run mcp:build first");
  }
}

async function testPoolPrivacyShape() {
  console.log("\n=== Pool privacy (offline shape) ===\n");
  const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111);
  const status = await getTrialPoolReclaimStatus(provider, "1");
  if (status.totalFunded !== null || status.totalDepositedWei !== null) {
    throw new Error("Public caller should not receive pool amounts");
  }
  if (typeof status.poolFunded !== "boolean") {
    throw new Error("poolFunded should be boolean");
  }
  ok("getTrialPoolReclaimStatus withholds amounts for provider-only caller");
}

async function testCoreLive() {
  console.log("\n=== @medvault/core (live) ===\n");

  const config = loadConfigFromEnv({
    ...process.env,
    SEPOLIA_RPC_URL: RPC_URL,
    MEDVAULT_SUBGRAPH_URL: SUBGRAPH_URL,
  });
  ok("loadConfigFromEnv", `network=${config.networkKey}`);

  ok("PROTOCOL_CONTRACTS", `${PROTOCOL_CONTRACTS.length} entries`);

  const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111);
  const wiring = await checkWiring(provider, "sepolia");
  ok(
    "checkWiring",
    `vault→mm=${wiring.vault.milestoneManager.slice(0, 10)}… automation→vault=${wiring.automation.vault.slice(0, 10)}…`
  );

  const trials = await postSubgraph(SUBGRAPH_URL, "GetActiveTrials", { first: 3, skip: 0 });
  const count = (trials?.trials ?? []).length;
  ok("postSubgraph GetActiveTrials", `${count} trial(s)`);
}

async function testMcpStdio() {
  console.log("\n=== MCP stdio (offline) ===\n");

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_ENTRY],
    env: {
      ...process.env,
      SEPOLIA_RPC_URL: RPC_URL,
      MEDVAULT_SUBGRAPH_URL: SUBGRAPH_URL,
      MCP_PRIVATE_KEY: "",
      MCP_READ_ONLY: "true",
    },
    stderr: "pipe",
    cwd: REPO_ROOT,
  });

  const client = new Client({ name: "medvault-smoke", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  ok("listTools", `${tools.length} tools`);
  const names = new Set(tools.map((t) => t.name));

  for (const required of [
    "medvault_get_config",
    "medvault_check_wiring",
    "medvault_doctor",
    "medvault_list_capabilities",
    "medvault_get_trial_pool_status",
    "medvault_get_sponsor_trial_pool_details",
  ]) {
    if (!names.has(required)) throw new Error(`Missing tool: ${required}`);
  }
  ok("required tools present");

  if (names.has("medvault_create_trial")) {
    throw new Error("Write tools should be hidden when MCP_READ_ONLY=true");
  }
  ok("write tools hidden in read-only mode");

  const config = parseToolJson(await client.callTool({ name: "medvault_get_config", arguments: {} }));
  if (!config.safety?.readOnly) throw new Error("Expected safety.readOnly in config");
  ok("medvault_get_config", `readOnly=${config.safety.readOnly}`);

  const doctor = parseToolJson(await client.callTool({ name: "medvault_doctor", arguments: {} }));
  if (!("issues" in doctor)) throw new Error("doctor missing issues array");
  ok("medvault_doctor");

  const pool = parseToolJson(
    await client.callTool({
      name: "medvault_get_trial_pool_status",
      arguments: { trialId: "1" },
    })
  );
  if ("totalFunded" in pool && pool.totalFunded != null) {
    throw new Error("Public pool tool must not return totalFunded");
  }
  ok("medvault_get_trial_pool_status", `poolFunded=${pool.poolFunded}`);

  if (live) {
    const wiring = parseToolJson(
      await client.callTool({ name: "medvault_check_wiring", arguments: {} })
    );
    if (!wiring.vault?.owner) throw new Error("Wiring missing vault.owner");
    ok("medvault_check_wiring (live)");

    const trials = parseToolJson(
      await client.callTool({
        name: "medvault_get_active_trials",
        arguments: { first: 2 },
      })
    );
    ok("medvault_get_active_trials", `${(trials.trials ?? []).length} trial(s)`);
  }

  await client.close();
}

async function testHttpHealth() {
  if (!live) {
    console.log("\n=== MCP HTTP /health (skipped offline) ===\n");
    return;
  }
  console.log("\n=== MCP HTTP /health (live) ===\n");

  const httpEntry = path.join(REPO_ROOT, "mcp-server", "dist", "http.js");
  const child = spawn("node", [httpEntry], {
    env: {
      ...process.env,
      SEPOLIA_RPC_URL: RPC_URL,
      MEDVAULT_SUBGRAPH_URL: SUBGRAPH_URL,
      MCP_HTTP_PORT: "3101",
    },
    stdio: ["ignore", "pipe", "pipe"],
    cwd: REPO_ROOT,
  });

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const res = await fetch("http://127.0.0.1:3101/health");
    const body = await res.json();
    if (res.status !== 200 || body.status !== "ok") {
      throw new Error(`Unexpected health: ${res.status} ${JSON.stringify(body)}`);
    }
    ok("GET /health", JSON.stringify(body));
  } finally {
    child.kill();
  }
}

async function main() {
  console.log(`MedVault MCP smoke test (${live ? "live" : "offline"})`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Subgraph: ${SUBGRAPH_URL}`);

  try {
    await testBuildOutput();
  } catch (e) {
    fail("build output", e);
  }

  try {
    await testPoolPrivacyShape();
  } catch (e) {
    fail("pool privacy", e);
  }

  try {
    await testMcpStdio();
  } catch (e) {
    fail("MCP stdio", e);
  }

  if (live) {
    try {
      await testCoreLive();
    } catch (e) {
      fail("@medvault/core live", e);
    }
    try {
      await testHttpHealth();
    } catch (e) {
      fail("MCP HTTP", e);
    }
  }

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.error("Tip: npm run mcp:build && npm run mcp:export-config");
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
