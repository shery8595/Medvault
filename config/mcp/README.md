# MedVault MCP client configs

Portable templates for connecting AI tools to the local MedVault MCP server.

## Prerequisites

1. `npm run mcp:build` from the repo root
2. Replace `<REPO_ROOT>` in Codex/OpenClaw snippets with your clone path (Cursor/Claude templates use `${workspaceFolder}`).
3. Environment variables (never commit secrets):
   - `SEPOLIA_RPC_URL` — Ethereum Sepolia RPC
   - `MEDVAULT_SUBGRAPH_URL` — same as `VITE_SUBGRAPH_URL` in the dapp
   - `MCP_PRIVATE_KEY` — sponsor/dev wallet (write tools only)

Optional (set in shell or IDE env, not inline in config files):
- `MEDVAULT_SPONSOR_OPEN_ACCESS=true` — bypass SponsorRegistry (testnet only)
- `MCP_MAX_ETH_PER_TX` — cap `medvault_fund_trial_pool` amounts
- `MEDVAULT_RELAYER_URL` — for `medvault_relayer_health`
- `MCP_READ_ONLY=true` — disable write tools even if a key is set

## Env interpolation by client

| Client | Syntax |
|--------|--------|
| Cursor, Claude Code, ChatGPT Desktop, Antigravity (stdio) | `${env:VAR}` |
| Codex, OpenClaw | `${VAR}` |

## Clients

| Client | File | Install |
|--------|------|---------|
| Cursor | `cursor.mcp.json` → `.cursor/mcp.json` | Reload MCP in settings |
| Claude Code | `claude.mcp.json` → `.mcp.json` | `claude mcp list` |
| Codex | `codex.toml` → `~/.codex/config.toml` | Restart Codex |
| ChatGPT Desktop | `chatgpt.mcp.json` | See paths below |
| ChatGPT Connectors | `chatgpt-http.mcp.json` | Developer mode URL connector |
| Antigravity (stdio) | `antigravity.mcp.json` → `~/.gemini/antigravity/mcp_config.json` | Refresh MCP panel |
| Antigravity (HTTP) | `antigravity-http.mcp.json` | Use `serverUrl` when running `npm run mcp:http` |
| OpenClaw | `openclaw.json` → `~/.openclaw/openclaw.json` | `openclaw gateway restart` |

### ChatGPT Desktop config paths

- **macOS:** `~/Library/Application Support/com.openai.chat/mcp.json`
- **Windows:** `%APPDATA%\\OpenAI\\ChatGPT\\mcp.json`
- **Linux:** `~/.config/openai-chat/mcp.json`

## HTTP transport

```bash
npm run mcp:http
# http://127.0.0.1:3100/mcp  (health: /health)
```

Tunnel only for clients that cannot reach localhost. Do not tunnel with `MCP_PRIVATE_KEY` set unless you trust the network.

## Local generated configs

`npm run mcp:export-config` also writes machine-specific files (gitignored):

- `.cursor/mcp.json`
- `.mcp.json`

## Example prompts

- "Run medvault_doctor and tell me what's misconfigured."
- "Is trial 42's incentive pool funded?" (public coarse status)
- "As the trial sponsor, how much ETH is in trial 42's pool?" (requires `MCP_PRIVATE_KEY`)
- "Preview funding trial 7 with 0.5 ETH without sending a transaction."
- "Summarize my sponsor trials and application counts."

Regenerate: `npm run mcp:export-config`
