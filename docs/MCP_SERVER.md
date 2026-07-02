# MedVault MCP Server

Standalone MCP server for **developers** and **sponsors** on Ethereum Sepolia — a local AI-native admin/dev console, not a patient-facing product. Lives in `mcp-server/`, `packages/medvault-core/`, and `packages/medvault-sdk/`.

## Quick start

```bash
npm install
npm run mcp:build
npm run mcp:export-config    # portable templates + local .cursor/mcp.json, .mcp.json
npm run mcp:validate-config
npm run mcp:doctor           # optional setup check
npm run mcp:smoke            # offline smoke; use mcp:smoke:live for Sepolia
```

Set environment variables (see below), then enable MCP using [config/mcp/README.md](../config/mcp/README.md).

Committed files under `config/mcp/` are **portable templates** (`<REPO_ROOT>` or `${workspaceFolder}`). Machine-specific `.mcp.json` and `.cursor/mcp.json` are gitignored.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `SEPOLIA_RPC_URL` | Yes (reads) | JSON-RPC for Ethereum Sepolia |
| `MEDVAULT_SUBGRAPH_URL` | Yes (indexed reads) | The Graph endpoint (`VITE_SUBGRAPH_URL` in the dapp) |
| `MCP_PRIVATE_KEY` | Writes / sponsor pool amounts | Hot wallet for sponsor transactions |
| `MEDVAULT_SPONSOR_OPEN_ACCESS` | No | `true` skips SponsorRegistry verification (testnet only) |
| `MCP_MAX_ETH_PER_TX` | No | Max ETH per `medvault_fund_trial_pool` |
| `MEDVAULT_RELAYER_URL` | No | Base URL for `medvault_relayer_health` |
| `MCP_READ_ONLY` | No | `true` disables write tools even if a key is set |
| `MCP_AUDIT_LOG` | No | Set `false` to disable local write audit log (default: on) |
| `MCP_AUDIT_LOG_PATH` | No | Override default `.mcp-audit.log` path |
| `MCP_HTTP_PORT` / `MCP_HTTP_HOST` | No | HTTP transport bind (default `127.0.0.1:3100`) |
| `AI_SERVICE_URL` / `VITE_AI_SERVICE_URL` | No | Base URL for AI proxy tools |
| `MEDVAULT_NETWORK` | No | `sepolia` (default) or `hardhat` |

## Pool privacy

Trial incentive pool **amounts are sponsor-private** on-chain.

| Data | Public (`medvault_get_trial_pool_status`) | Sponsor signer (`medvault_get_sponsor_trial_pool_details`) |
|------|-------------------------------------------|----------------------------------------------------------|
| Pool funded (bool) | yes | yes |
| Participant count | yes | yes |
| Distribution / reclaim flags | yes | yes |
| Deposited / reclaimable ETH | **no** | yes |

`medvault_read_contract_view` blocklists `getTotalDeposited` and other sensitive vault views.

## Tools (33 total)

**23 read** + **10 write** (writes disabled when `MCP_READ_ONLY=true`). Full parameter reference: [mcp-server/README.md](../mcp-server/README.md).

### Read / diagnostic

- `medvault_get_config`, `medvault_list_protocol_contracts`, `medvault_check_wiring`
- `medvault_subgraph_query` (allowlisted GraphQL only)
- `medvault_get_active_trials`, `medvault_get_sponsor_trials`, `medvault_get_sponsor_matches`, `medvault_get_sponsor_stats`
- `medvault_get_audit_logs`, `medvault_get_sponsor_verification`
- `medvault_get_trial_pool_status` — public coarse pool status only
- `medvault_get_sponsor_trial_pool_details` — sponsor-authorized amounts
- `medvault_read_contract_view`, `medvault_relayer_health`
- `medvault_doctor`, `medvault_list_capabilities`, `medvault_get_client_config_help`, `medvault_get_protocol_health`
- `medvault_get_sponsor_overview`, `medvault_preview_fund_trial_pool`, `medvault_get_trial_operations_timeline`
- `medvault_ai_extract_criteria`, `medvault_ai_audit_logs` — read-only proxies to `@medvault/ai` (PHI redacted before LLM)

### Write (sponsor only, disabled when `MCP_READ_ONLY=true`)

Requires verified sponsor (or open-access flag) and `MCP_PRIVATE_KEY`:

- `medvault_create_trial`, `medvault_set_trial_milestones`, `medvault_fund_trial_pool`
- `medvault_update_application_status`, `medvault_deactivate_trial`, `medvault_distribute_milestone`
- `medvault_register_anonymous_participant`, `medvault_reclaim_trial_pool`
- `medvault_reclaim_abandoned_pool` (vault owner), `medvault_claim_reclaimed_pool` (scheduled recipient)

Patient/FHE writes are **not** included.

## Clients

See [config/mcp/README.md](../config/mcp/README.md) for per-client install paths, env interpolation (`${env:VAR}` vs `${VAR}`), and HTTP templates.

## HTTP transport (optional)

```bash
npm run mcp:http
# http://127.0.0.1:3100/mcp  (health: /health)
```

Use `config/mcp/chatgpt-http.mcp.json` or `antigravity-http.mcp.json` for URL-based clients. Do not tunnel with write-capable keys unless you trust the network.

Full tool reference: [mcp-server/README.md](../mcp-server/README.md).

## Security

- Dedicated Sepolia test wallet with minimal funds.
- Never commit `MCP_PRIVATE_KEY` or paste it into config files.
- MCP does not decrypt patient health data or run anonymous relayer finalize flows.
- Write attempts are appended to `.mcp-audit.log` (gitignored) unless disabled.
