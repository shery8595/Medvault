#!/usr/bin/env node
/**
 * Validate committed MCP config templates in config/mcp/.
 */
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const CONFIG_DIR = path.join(REPO_ROOT, "config", "mcp");

const ABSOLUTE_PATH_RE = /(?:^[A-Za-z]:[\\/]|^\/Users\/|^\/home\/)/m;
const SECRET_PATTERNS = [
  /0x[a-fA-F0-9]{64}/,
  /MCP_PRIVATE_KEY\s*[:=]\s*["'][^"']{20,}["']/,
];

let failed = 0;

function fail(msg) {
  failed++;
  console.error(`  FAIL ${msg}`);
}

function ok(msg) {
  console.log(`  OK  ${msg}`);
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function assertNoAbsolutePaths(relPath, content) {
  if (ABSOLUTE_PATH_RE.test(content)) {
    fail(`${relPath}: contains absolute machine path`);
    return false;
  }
  return true;
}

function assertNoSecrets(relPath, content) {
  for (const re of SECRET_PATTERNS) {
    if (re.test(content)) {
      fail(`${relPath}: possible secret detected`);
      return false;
    }
  }
  return true;
}

function validateJsonMcp(relPath, json) {
  const servers = json.mcpServers;
  if (!servers || typeof servers !== "object") {
    fail(`${relPath}: missing mcpServers`);
    return;
  }
  const medvault = servers.medvault;
  if (!medvault) {
    fail(`${relPath}: missing mcpServers.medvault`);
    return;
  }
  const isHttp = "serverUrl" in medvault || "url" in medvault;
  if (isHttp) {
    const url = medvault.serverUrl || medvault.url;
    if (!url || typeof url !== "string") fail(`${relPath}: HTTP config missing url`);
    else ok(`${relPath}: HTTP template`);
    return;
  }
  if (!medvault.command || !Array.isArray(medvault.args) || medvault.args.length < 1) {
    fail(`${relPath}: stdio config missing command/args`);
    return;
  }
  ok(`${relPath}: stdio template`);
}

async function validateJsonFile(name) {
  const full = path.join(CONFIG_DIR, name);
  if (!(await fileExists(full))) {
    fail(`missing ${name}`);
    return;
  }
  const raw = await readFile(full, "utf8");
  if (!assertNoAbsolutePaths(name, raw) || !assertNoSecrets(name, raw)) return;
  try {
    validateJsonMcp(name, JSON.parse(raw));
  } catch (e) {
    fail(`${name}: invalid JSON — ${e.message}`);
  }
}

async function validateCodexToml() {
  const name = "codex.toml";
  const full = path.join(CONFIG_DIR, name);
  if (!(await fileExists(full))) {
    fail(`missing ${name}`);
    return;
  }
  const raw = await readFile(full, "utf8");
  if (!assertNoAbsolutePaths(name, raw) || !assertNoSecrets(name, raw)) return;
  if (!raw.includes("[mcp_servers.medvault]")) {
    fail(`${name}: missing [mcp_servers.medvault]`);
    return;
  }
  if (!raw.includes("<REPO_ROOT>")) {
    fail(`${name}: expected <REPO_ROOT> placeholder`);
    return;
  }
  ok(`${name}: valid template`);
}

async function main() {
  console.log("MedVault MCP config validation\n");

  const jsonFiles = [
    "cursor.mcp.json",
    "claude.mcp.json",
    "chatgpt.mcp.json",
    "chatgpt-http.mcp.json",
    "antigravity.mcp.json",
    "antigravity-http.mcp.json",
    "openclaw.json",
  ];

  for (const f of jsonFiles) {
    await validateJsonFile(f);
  }
  await validateCodexToml();

  if (!(await fileExists(path.join(CONFIG_DIR, "README.md")))) {
    fail("missing README.md");
  } else {
    ok("README.md present");
  }

  console.log(`\n=== Summary: ${failed === 0 ? "all checks passed" : `${failed} failed`} ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
