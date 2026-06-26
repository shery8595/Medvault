#!/usr/bin/env node
/**
 * Emit MCP client config snippets for MedVault.
 * Usage:
 *   node mcp-server/scripts/export-mcp-config.mjs [--client all|cursor|...] [--mode template|local|both] [--repo-root PATH]
 *
 * template → portable files in config/mcp/ (committed)
 * local    → machine-specific .cursor/mcp.json and .mcp.json (gitignored)
 * both     → default for npm run mcp:export-config
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, "../..");
const REPO_PLACEHOLDER = "<REPO_ROOT>";
const WORKSPACE_ENTRY = "${workspaceFolder}/mcp-server/dist/index.js";

/** @typedef {"template" | "local" | "both"} ExportMode */

function parseArgs(argv) {
  let client = "all";
  let repoRoot = defaultRepoRoot;
  /** @type {ExportMode} */
  let mode = "both";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--client" && argv[i + 1]) {
      client = argv[++i];
    } else if (argv[i] === "--repo-root" && argv[i + 1]) {
      repoRoot = path.resolve(argv[++i]);
    } else if (argv[i] === "--mode" && argv[i + 1]) {
      const m = argv[++i];
      if (m === "template" || m === "local" || m === "both") mode = m;
      else throw new Error(`Invalid --mode ${m}; use template, local, or both`);
    }
  }
  return { client, repoRoot, mode };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function serverEntry(mode, repoRoot) {
  if (mode === "template") return REPO_PLACEHOLDER + "/mcp-server/dist/index.js";
  return path.join(repoRoot, "mcp-server", "dist", "index.js").replace(/\\/g, "/");
}

/** @param {"cursor" | "codex" | "openclaw"} client */
function envBlock(client, mode) {
  if (client === "cursor") {
    return {
      SEPOLIA_RPC_URL: "${env:SEPOLIA_RPC_URL}",
      MEDVAULT_SUBGRAPH_URL: "${env:MEDVAULT_SUBGRAPH_URL}",
      MCP_PRIVATE_KEY: "${env:MCP_PRIVATE_KEY}",
    };
  }
  return {
    SEPOLIA_RPC_URL: "${SEPOLIA_RPC_URL}",
    MEDVAULT_SUBGRAPH_URL: "${MEDVAULT_SUBGRAPH_URL}",
    MCP_PRIVATE_KEY: "${MCP_PRIVATE_KEY}",
  };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function cursorConfig(mode, repoRoot) {
  const entry = mode === "template" ? WORKSPACE_ENTRY : serverEntry(mode, repoRoot);
  return {
    mcpServers: {
      medvault: {
        command: "node",
        args: [entry],
        env: envBlock("cursor", mode),
      },
    },
  };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function claudeConfig(mode, repoRoot) {
  return cursorConfig(mode, repoRoot);
}

/** @param {ExportMode} mode @param {string} repoRoot */
function chatgptConfig(mode, repoRoot) {
  const entry = mode === "template" ? WORKSPACE_ENTRY : serverEntry(mode, repoRoot);
  return {
    mcpServers: {
      medvault: {
        command: "node",
        args: [entry],
        env: envBlock("cursor", mode),
      },
    },
  };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function antigravityStdioConfig(mode, repoRoot) {
  const entry = mode === "template" ? WORKSPACE_ENTRY : serverEntry(mode, repoRoot);
  return {
    mcpServers: {
      medvault: {
        command: "node",
        args: [entry],
        env: envBlock("cursor", mode),
      },
    },
  };
}

/** HTTP connector template for Antigravity / ChatGPT Connectors */
function antigravityHttpConfig() {
  return {
    mcpServers: {
      medvault: {
        serverUrl: "http://127.0.0.1:3100/mcp",
      },
    },
  };
}

function chatgptHttpConfig() {
  return {
    mcpServers: {
      medvault: {
        url: "http://127.0.0.1:3100/mcp",
      },
    },
  };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function openclawConfig(mode, repoRoot) {
  const entry = serverEntry(mode, repoRoot);
  return {
    mcpServers: {
      medvault: {
        transport: "stdio",
        command: "node",
        args: [entry],
        env: envBlock("openclaw", mode),
      },
    },
  };
}

/** @param {ExportMode} mode @param {string} repoRoot */
function codexToml(mode, repoRoot) {
  const entry = serverEntry(mode, repoRoot);
  return `# MedVault MCP — paste into ~/.codex/config.toml
# Env interpolation: Codex uses \${VAR} (not \${env:VAR})
[mcp_servers.medvault]
command = "node"
args = ["${entry}"]
enabled = true
startup_timeout_sec = 30
tool_timeout_sec = 120

[mcp_servers.medvault.env]
SEPOLIA_RPC_URL = "\${SEPOLIA_RPC_URL}"
MEDVAULT_SUBGRAPH_URL = "\${MEDVAULT_SUBGRAPH_URL}"
MCP_PRIVATE_KEY = "\${MCP_PRIVATE_KEY}"
`;
}

const readme = `# MedVault MCP client configs

Portable templates for connecting AI tools to the local MedVault MCP server.

## Prerequisites

1. \`npm run mcp:build\` from the repo root
2. Replace \`<REPO_ROOT>\` in Codex/OpenClaw snippets with your clone path (Cursor/Claude templates use \`\${workspaceFolder}\`).
3. Environment variables (never commit secrets):
   - \`SEPOLIA_RPC_URL\` — Ethereum Sepolia RPC
   - \`MEDVAULT_SUBGRAPH_URL\` — same as \`VITE_SUBGRAPH_URL\` in the dapp
   - \`MCP_PRIVATE_KEY\` — sponsor/dev wallet (write tools only)

Optional (set in shell or IDE env, not inline in config files):
- \`MEDVAULT_SPONSOR_OPEN_ACCESS=true\` — bypass SponsorRegistry (testnet only)
- \`MCP_MAX_ETH_PER_TX\` — cap \`medvault_fund_trial_pool\` amounts
- \`MEDVAULT_RELAYER_URL\` — for \`medvault_relayer_health\`
- \`MCP_READ_ONLY=true\` — disable write tools even if a key is set

## Env interpolation by client

| Client | Syntax |
|--------|--------|
| Cursor, Claude Code, ChatGPT Desktop, Antigravity (stdio) | \`\${env:VAR}\` |
| Codex, OpenClaw | \`\${VAR}\` |

## Clients

| Client | File | Install |
|--------|------|---------|
| Cursor | \`cursor.mcp.json\` → \`.cursor/mcp.json\` | Reload MCP in settings |
| Claude Code | \`claude.mcp.json\` → \`.mcp.json\` | \`claude mcp list\` |
| Codex | \`codex.toml\` → \`~/.codex/config.toml\` | Restart Codex |
| ChatGPT Desktop | \`chatgpt.mcp.json\` | See paths below |
| ChatGPT Connectors | \`chatgpt-http.mcp.json\` | Developer mode URL connector |
| Antigravity (stdio) | \`antigravity.mcp.json\` → \`~/.gemini/antigravity/mcp_config.json\` | Refresh MCP panel |
| Antigravity (HTTP) | \`antigravity-http.mcp.json\` | Use \`serverUrl\` when running \`npm run mcp:http\` |
| OpenClaw | \`openclaw.json\` → \`~/.openclaw/openclaw.json\` | \`openclaw gateway restart\` |

### ChatGPT Desktop config paths

- **macOS:** \`~/Library/Application Support/com.openai.chat/mcp.json\`
- **Windows:** \`%APPDATA%\\\\OpenAI\\\\ChatGPT\\\\mcp.json\`
- **Linux:** \`~/.config/openai-chat/mcp.json\`

## HTTP transport

\`\`\`bash
npm run mcp:http
# http://127.0.0.1:3100/mcp  (health: /health)
\`\`\`

Tunnel only for clients that cannot reach localhost. Do not tunnel with \`MCP_PRIVATE_KEY\` set unless you trust the network.

## Local generated configs

\`npm run mcp:export-config\` also writes machine-specific files (gitignored):

- \`.cursor/mcp.json\`
- \`.mcp.json\`

## Example prompts

- "Run medvault_doctor and tell me what's misconfigured."
- "Is trial 42's incentive pool funded?" (public coarse status)
- "As the trial sponsor, how much ETH is in trial 42's pool?" (requires \`MCP_PRIVATE_KEY\`)
- "Preview funding trial 7 with 0.5 ETH without sending a transaction."
- "Summarize my sponsor trials and application counts."

Regenerate: \`npm run mcp:export-config\`
`;

/**
 * @param {ExportMode} writeMode
 * @param {string} client
 * @param {string} repoRoot
 * @param {string} outDir
 * @param {Promise<void>[]} writes
 */
async function scheduleWrites(writeMode, client, repoRoot, outDir, writes) {
  const templateMode = writeMode === "template" ? "template" : "local";
  const isTemplate = writeMode === "template";

  if (client === "all" || client === "cursor") {
    if (!isTemplate) {
      await mkdir(path.join(repoRoot, ".cursor"), { recursive: true });
      writes.push(
        writeFile(
          path.join(repoRoot, ".cursor", "mcp.json"),
          JSON.stringify(cursorConfig("local", repoRoot), null, 2) + "\n"
        )
      );
    }
    if (writeMode !== "local") {
      writes.push(
        writeFile(
          path.join(outDir, "cursor.mcp.json"),
          JSON.stringify(cursorConfig("template", repoRoot), null, 2) + "\n"
        )
      );
    }
  }

  if (client === "all" || client === "claude") {
    if (!isTemplate) {
      writes.push(
        writeFile(
          path.join(repoRoot, ".mcp.json"),
          JSON.stringify(claudeConfig("local", repoRoot), null, 2) + "\n"
        )
      );
    }
    if (writeMode !== "local") {
      writes.push(
        writeFile(
          path.join(outDir, "claude.mcp.json"),
          JSON.stringify(claudeConfig("template", repoRoot), null, 2) + "\n"
        )
      );
    }
  }

  if ((client === "all" || client === "codex") && writeMode !== "local") {
    writes.push(writeFile(path.join(outDir, "codex.toml"), codexToml("template", repoRoot)));
  }

  if ((client === "all" || client === "chatgpt") && writeMode !== "local") {
    writes.push(
      writeFile(
        path.join(outDir, "chatgpt.mcp.json"),
        JSON.stringify(chatgptConfig("template", repoRoot), null, 2) + "\n"
      )
    );
    writes.push(
      writeFile(
        path.join(outDir, "chatgpt-http.mcp.json"),
        JSON.stringify(chatgptHttpConfig(), null, 2) + "\n"
      )
    );
  }

  if ((client === "all" || client === "antigravity") && writeMode !== "local") {
    writes.push(
      writeFile(
        path.join(outDir, "antigravity.mcp.json"),
        JSON.stringify(antigravityStdioConfig("template", repoRoot), null, 2) + "\n"
      )
    );
    writes.push(
      writeFile(
        path.join(outDir, "antigravity-http.mcp.json"),
        JSON.stringify(antigravityHttpConfig(), null, 2) + "\n"
      )
    );
  }

  if ((client === "all" || client === "openclaw") && writeMode !== "local") {
    writes.push(
      writeFile(
        path.join(outDir, "openclaw.json"),
        JSON.stringify(openclawConfig("template", repoRoot), null, 2) + "\n"
      )
    );
  }

  if (client === "all" && writeMode !== "local") {
    writes.push(writeFile(path.join(outDir, "README.md"), readme));
  }
}

async function main() {
  const { client, repoRoot, mode } = parseArgs(process.argv);
  const outDir = path.join(repoRoot, "config", "mcp");
  await mkdir(outDir, { recursive: true });

  const writes = [];

  if (mode === "both") {
    await scheduleWrites("template", client, repoRoot, outDir, writes);
    await scheduleWrites("local", client, repoRoot, outDir, writes);
  } else {
    await scheduleWrites(mode, client, repoRoot, outDir, writes);
  }

  await Promise.all(writes);
  console.log(`Exported MCP config for client=${client} mode=${mode} → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
