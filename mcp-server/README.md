# MedVault MCP Server (`@medvault/mcp-server`)

[Model Context Protocol](https://modelcontextprotocol.io) server for **developers** and **sponsors** on Ethereum Sepolia — protocol debugging, subgraph reads, and sponsor trial operations. Does not expose patient FHE decrypt or anonymous relayer finalize flows.

**Stack:** `@modelcontextprotocol/sdk`, zod, ethers v6, `@medvault/core`, `@medvault/sdk`.

## Quick start

```bash
npm run mcp:build
npm run mcp:export-config
npm run mcp:doctor
```

Enable in your IDE using templates in [config/mcp/README.md](../config/mcp/README.md).

## Transports

| Transport | Entry | Endpoint |
|-----------|-------|----------|
| **stdio** (default) | `mcp-server/dist/index.js` / bin `medvault-mcp` | IDE-spawned process |
| **HTTP** | `npm run mcp:http` | `http://127.0.0.1:3100/mcp` |
| HTTP health | — | `GET http://127.0.0.1:3100/health` → `{ "status": "ok", "service": "medvault-mcp" }` |

HTTP env: `MCP_HTTP_PORT` (default `3100`), `MCP_HTTP_HOST` (default `127.0.0.1`).

## Tools (33 total)

**23 read** tools are always registered. **10 write** tools register only when `MCP_READ_ONLY` is not `true`.

### Read tools (23)

| Tool | Params | Action |
|------|--------|--------|
| `medvault_get_config` | — | Addresses, URLs, safety summary, optional signer |
| `medvault_list_protocol_contracts` | — | Protocol contract catalog |
| `medvault_check_wiring` | — | Vault / automation / milestone cross-checks |
| `medvault_subgraph_query` | `queryName`, `variables?` | Allowlisted GraphQL only |
| `medvault_get_active_trials` | `first?`, `skip?` | Active trials from subgraph |
| `medvault_get_sponsor_trials` | `sponsor` | Trials for sponsor address |
| `medvault_get_sponsor_matches` | `sponsor` | Applications, eligibility, consents, anonymous submissions |
| `medvault_get_sponsor_stats` | `sponsor` | Sponsor entity aggregates |
| `medvault_get_audit_logs` | `sponsor`, `first?` | Subgraph + chain audit entries |
| `medvault_get_sponsor_verification` | `sponsor` | SponsorRegistry status |
| `medvault_get_trial_pool_status` | `trialId`, `trialEndTimeSec?` | Public coarse pool status (no amounts) |
| `medvault_get_sponsor_trial_pool_details` | `trialId`, `trialEndTimeSec?` | Deposited/reclaimable ETH (sponsor signer) |
| `medvault_read_contract_view` | `contract`, `functionName`, `args?` | Generic `eth_call` (blocklist enforced) |
| `medvault_relayer_health` | — | `GET /health` on `MEDVAULT_RELAYER_URL` |
| `medvault_doctor` | — | Env, build, RPC, subgraph, sponsor diagnostic |
| `medvault_list_capabilities` | — | Tools, transports, read-only mode, privacy |
| `medvault_get_client_config_help` | `client?` | Per-client config paths |
| `medvault_get_protocol_health` | — | Wiring + subgraph + relayer aggregate |
| `medvault_get_sponsor_overview` | `sponsor` | Trials, matches, stats; amounts if signer is sponsor |
| `medvault_preview_fund_trial_pool` | `trialId`, `amountEth` | Dry-run fund preview |
| `medvault_get_trial_operations_timeline` | `trialId` | Pool status + subgraph context |
| `medvault_ai_extract_criteria` | `text?`, `pdfBase64?`, `blocklist?` | Proxy to `@medvault/ai` |
| `medvault_ai_audit_logs` | `trialIds?`, `logs?` | Proxy to `@medvault/ai` |

### Write tools (8) — sponsor only

Disabled when `MCP_READ_ONLY=true`. Require `MCP_PRIVATE_KEY` and verified sponsor (or `MEDVAULT_SPONSOR_OPEN_ACCESS=true`).

| Tool | Params | On-chain action |
|------|--------|-----------------|
| `medvault_create_trial` | criteria fields, `durationSeconds`, optional `milestones`, `fundingAmountEth` | `TrialManager.createTrial` + optional milestones/fund |
| `medvault_set_trial_milestones` | `trialId`, `durationSeconds`, `milestones[]` | `TrialMilestoneManager.setMilestones` |
| `medvault_fund_trial_pool` | `trialId`, `amountEth` | `SponsorIncentiveVault.fundTrial` |
| `medvault_update_application_status` | `trialId`, `patientAddress`, `newStatus`, `decisionMessage?` | `EligibilityEngine.updateApplicationStatus` |
| `medvault_deactivate_trial` | `trialId` | `TrialManager.deactivateTrial` |
| `medvault_distribute_milestone` | `trialId`, `milestoneIndex` | Partial milestone distribution |
| `medvault_register_anonymous_participant` | `trialId`, `nullifier`, `identitySecret?` | Vault register by nullifier — pass `identitySecret` when MCP signer ≠ decrypt permit holder |
| `medvault_reclaim_trial_pool` | `trialId` | Sponsor: schedule `reclaimUndistributed` |
| `medvault_reclaim_abandoned_pool` | `trialId` | Vault owner: schedule `reclaimAbandonedToOwner` (revoked sponsor) |
| `medvault_claim_reclaimed_pool` | `trialId` | Claim scheduled reclaim (sponsor or vault owner recipient) |

Write attempts append JSON lines to `.mcp-audit.log` (repo root) unless `MCP_AUDIT_LOG=false`.

## Allowlisted subgraph queries (7)

Used by `medvault_subgraph_query` and dedicated read tools:

1. `GetSponsorData`
2. `GetSponsorStats`
3. `GetSponsorTrialIds`
4. `GetSubgraphAuditLogs`
5. `GetTrialsBySponsor`
6. `GetActiveTrials`
7. `GetPendingRequests`

Arbitrary GraphQL is rejected.

## Blocked sensitive contract views

`medvault_read_contract_view` rejects these `SponsorIncentiveVault` functions:

- `getTotalDeposited`
- `getEncryptedPoolSize`
- `requestEncryptedPoolAccess`

Use `medvault_get_sponsor_trial_pool_details` with the trial sponsor's key for authorized amounts.

## Write authentication

1. `MCP_PRIVATE_KEY` must be set.
2. `MCP_READ_ONLY` must not be `true`.
3. Signer must pass `assertSponsorCanWrite` (SponsorRegistry verified) unless open-access flag is set.
4. Chain id must be `11155111` (Sepolia).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `SEPOLIA_RPC_URL` | Reads | JSON-RPC |
| `MEDVAULT_SUBGRAPH_URL` | Indexed reads | Same as `VITE_SUBGRAPH_URL` |
| `MCP_PRIVATE_KEY` | Writes | Sponsor/dev hot wallet |
| `MCP_READ_ONLY` | No | `true` disables write tools |
| `MCP_MAX_ETH_PER_TX` | No | Cap `medvault_fund_trial_pool` |
| `MCP_AUDIT_LOG` | No | `false` disables audit log |
| `MCP_AUDIT_LOG_PATH` | No | Override `.mcp-audit.log` path |
| `MCP_HTTP_PORT` | No | HTTP transport port |
| `MCP_HTTP_HOST` | No | HTTP bind host |
| `MEDVAULT_SPONSOR_OPEN_ACCESS` | No | `true` skips SponsorRegistry check |
| `MEDVAULT_RELAYER_URL` | No | Relayer health tool |
| `AI_SERVICE_URL` / `VITE_AI_SERVICE_URL` | No | AI proxy tools |
| `MEDVAULT_NETWORK` | No | `sepolia` (default) or `hardhat` |

## Client configuration

Templates in `config/mcp/` cover:

| Client | Template | Env interpolation |
|--------|----------|-------------------|
| Cursor | `cursor.mcp.json` | `${env:VAR}` |
| Claude Code | `claude.mcp.json` | `${env:VAR}` |
| Codex | `codex.toml` | `${VAR}` |
| ChatGPT Desktop | `chatgpt.mcp.json` | `${env:VAR}` |
| ChatGPT Connectors | `chatgpt-http.mcp.json` | URL to HTTP transport |
| Antigravity (stdio) | `antigravity.mcp.json` | `${env:VAR}` |
| Antigravity (HTTP) | `antigravity-http.mcp.json` | `serverUrl` |
| OpenClaw | `openclaw.json` | `${VAR}` |

Run `medvault_get_client_config_help` or see [config/mcp/README.md](../config/mcp/README.md).

## Related

- [docs/MCP_SERVER.md](../docs/MCP_SERVER.md) — overview
- [packages/medvault-core/README.md](../packages/medvault-core/README.md) — shared library
- [packages/medvault-sdk/README.md](../packages/medvault-sdk/README.md) — programmatic facade
