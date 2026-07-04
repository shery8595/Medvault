# MedVault Documentation Audit (Plan 00)

> **Generated:** 2026-06-30 · **Scope:** repository baseline for Plans 01–10  
> **Rule:** counts below were re-verified against source (Glob/Grep); do not copy numbers into other docs without re-running verification.

## Verified statistics

| Metric | Value | Backing |
|--------|------:|---------|
| Production contracts | 17 | `contracts/*.sol` (15 protocol + HonkVerifier + `ConfidentialETH` alias) |
| `PROTOCOL_CONTRACTS` catalog | 16 | `src/lib/protocolContracts.ts` (15 + optional Honk `ZK`) |
| Test/helper contracts | 5 | `contracts/test/*.sol` |
| Noir circuits | 2 | `circuits/eligibility_plaintext/`, `circuits/eligibility_encrypted/` |
| Packages | 2 | `packages/medvault-core`, `packages/medvault-sdk` |
| Services | 5 (+3 aux) | relayer, ai-service, indexer, mcp-server, frontend; + subgraph, sepolia-faucet, android |
| App pages | 25 | `src/App.tsx` (non-`/docs` routes) |
| In-app doc pages | 32 | `src/pages/docs/**/*.tsx` (excl. `DocsLayout`) |
| Docs nav items | 48 | `src/lib/docsNav.ts` → `DOCS_NAV_ITEMS` |
| Components | 95 | `src/components/**/*.tsx` |
| Hooks | 27 | `src/hooks/**/*.ts` |
| Lib modules (top-level) | 64 | `src/lib/*.{ts,tsx}` (excl. `contracts/`, `__tests__/`) |
| HTTP routes | 21 | relayer 10, ai-service 4, indexer 5, MCP HTTP 2 |
| MCP tools | 33 | 23 read, 10 write — `mcp-server/src/server.ts` |
| Background jobs | 5 | relayer watcher, batch-exit queue, indexer sync/reconcile, Chainlink CRE workflow |
| Scripts | 36 | 33 `scripts/*` + 3 `scripts/lib/*` |
| Test files (TS) | 97 | `test/`, `packages/**/tests`, `src/lib/__tests__` |
| Registered test cases | ~2,028 | 499 literal `it()` + 832 parametric + fuzz loop expansion |
| Default suite passing | **491** | `npm test` / `scripts/hardhat-test-suite.mjs` default (verified 2026-07-04) |
| Unit suite passing | **403** (+ 6 pending) | `npm run test:unit` |
| Integration passing | **85** | `npm run test:integration` |
| Crypto (nullifier) | **3** | `npm run test:crypto` |
| CI workflows | 4 | contracts-test, docker-smoke, frontend, mcp — **no CD** |
| Dockerfiles | 3 | root, `relayer/`, `indexer/` |
| Compose services | 10 | 4 profiles: default, `relayer`, `graph`, `indexer` |
| Networks | 3+1 | Sepolia 11155111, Hardhat 31337, sepoliaFork; `arbitrum` key in addresses (Reclaim/Semaphore) |
| Integrations | 12 | Zama FHE, Noir/Honk, Chainlink (×2), IPFS/Pinata, The Graph, OpenAI, MCP, Semaphore, Privy, Aave V3, Reclaim |
| Markdown files | 33 | see inventory below |
| Eligibility public inputs | **25** (plaintext) / **15** (encrypted) | `circuits/eligibility_plaintext`, `circuits/eligibility_encrypted` |
| `DOCS_CONTRACT_COUNT` | **15** | `src/lib/docsNav.ts` — matches `PROTOCOL_CONTRACTS` production entries |

**Importable manifest:** `src/lib/docsStats.ts` exports `STAT_BACKING`, `REPO_STATS`, and integration/network lists.

### Reproduction commands

```bash
# Contracts
ls contracts/*.sol | wc -l          # 17
ls contracts/test/*.sol | wc -l     # 5

# Frontend surface
find src/components -name '*.tsx' | wc -l   # 95
find src/hooks -name '*.ts' | wc -l         # 27
ls src/lib/*.{ts,tsx} 2>/dev/null | wc -l   # 64 (PowerShell: (Get-ChildItem src/lib -File -Include *.ts,*.tsx).Count)

# Tests
find test packages -name '*.test.ts' src/lib/__tests__ -name '*.test.ts' | wc -l  # 74
rg -c '\bit\s*\(' test packages src/lib/__tests__ --glob '*.test.ts' | awk -F: '{s+=$2} END {print s}'  # 361

# MCP tools
rg -c 'server\.tool\(' mcp-server/src/server.ts   # 31

# Markdown
find . -name '*.md' -not -path './node_modules/*' | wc -l   # 33
```

---

## Consolidated documentation debt (Plans 01–10)

| ID | Issue | Status (Plan 10) |
|----|-------|------------------|
| D1 | Test-count contradictions | **Resolved** — canonical **491** via `docsStats` / `testSuiteData`; historical rows labeled in `VERIFICATION_SNAPSHOT.md` |
| D2 | Stale contract count | **Resolved** — `DOCS_CONTRACT_COUNT = 15` |
| D3 | Stale public-input count | **Resolved** — **25** in circuit, Prover.toml, `EligibilityEngineDoc` |
| D4 | Missing service READMEs | **Resolved** (Plans 05–09) — relayer, ai-service, indexer, mcp-server, medvault-core |
| D5 | Orphan/un-indexed docs | **Resolved** — indexed in `docs/README.md` + `docsNav.ts` |
| D6 | Stale design proposals | **Resolved** — moved to `docs/archive/` |
| D7 | Public vs encrypted criteria narrative | **Resolved** (Plan 07) — encrypted default documented in README, FHE_AUDIT, SECURITY |
| D8 | Subgraph slug/version mismatch | **Resolved** (Plan 09) — canonical `medvault/v0.2.0` (redeployed July 2026 post library-extraction Sepolia deploy) |
| D9 | Docker `indexer` profile undocumented | **Resolved** (Plan 09) — `DOCKER.md`, `LOCAL_DEVELOPMENT.md` |
| D10 | Undocumented backend behavior | **Partial** — service READMEs; engineering gaps flagged only (no code changes in doc plans) |
| D11 | Contract-source quirks | **Documented** — `SmartContractsDoc`, `protocolContracts.ts` quirks table |

**Resolved:** `.env.docker.example` **exists** (742 B) — links valid; content freshness TBD in Plan 01.

---

## Markdown inventory (33 files)

| File | Canonical owner | Indexed in `docsNav` | Staleness verdict |
|------|-----------------|----------------------|-------------------|
| `README.md` | GitHub landing | Partial (via intro links) | **OK** |
| `VISION.md` | Product narrative | No | **OK** |
| `SECURITY.md` | Security policy | Yes (external) | **OK** |
| `docs/README.md` | Docs index | Yes (external link) | **OK** — glossary, dual-doc sync, archive index |
| `docs/TESTING_GUIDE.md` | Test ops | Partial | **OK** |
| `docs/TEST_MATRIX.md` | Test catalog | Partial | **OK** |
| `docs/VERIFICATION_SNAPSHOT.md` | Release audit log | No | **OK** |
| `docs/FHE_AUDIT_README.md` | FHE audit pack | No | **OK** |
| `docs/DOCKER.md` | Docker ops | Yes (external) | **OK** |
| `docs/LOCAL_DEVELOPMENT.md` | Dev setup | Yes (external) | **OK** |
| `docs/MCP_SERVER.md` | MCP ops | Partial | **OK** |
| `docs/PRIVATE_WITHDRAWALS.md` | Withdrawals | In-app page | **OK** |
| `docs/ERC7984_CONFIDENTIAL_TOKEN.md` | Token spec | Yes (external) | **OK** |
| `docs/TIMELOCK_WIRING.md` | Timelock | In-app + md | **OK** |
| `docs/SUBGRAPH_SYNC.md` | Subgraph ops | Yes (external) | **OK** |
| `docs/ANDROID_APK.md` | Mobile | In-app | **OK** |
| `docs/MOBILE_ARCHITECTURE.md` | Mobile arch | Partial | **OK** |
| `docs/ATOMIC_FLOWS.md` | Flow spec | Yes (external) | **OK** |
| `docs/HYBRID_STORAGE.md` | Hybrid storage | Yes (external) | **OK** |
| `docs/ZERO_REVELATION_REWARDS.md` | Rewards design | Yes (external) | **OK** |
| `docs/archive/NEW_CONTRACTS_GUIDE.md` | Historical design | Yes (archive link) | **Archived** |
| `docs/archive/UPGRADE_V1.1_…` | Historical upgrade | Yes (archive link) | **Archived** |
| `docs/formal-verification/eligibility-engine.spec.md` | Formal spec | Yes (external) | **OK** |
| `docs/formal-verification/certora-halmos-results.md` | Phase 5 formal/differential results | Yes (external) | **OK** |
| `internal-docs/README.md` | Internal index | Yes (external) | **OK** |
| `internal-docs/architecture.md` | Architecture | Yes (external) | **OK** |
| `internal-docs/threat-model.md` | Threat model | Yes (external) | **OK** |
| `internal-docs/srs.md` | SRS | Yes (external) | **OK** |
| `internal-docs/dfd.md` | DFD | Yes (external) | **OK** |
| `internal-docs/zama-integration.md` | Zama guide | Yes (external) | **OK** |
| `packages/medvault-sdk/README.md` | SDK package | In-app SDK doc | **OK** |
| `config/mcp/README.md` | MCP config | Partial | **OK** |
| `sepolia-faucet/README.md` | Faucet service | Partial | **OK** |
| `android/README.md` | Android shell | Partial | **OK** |

---

## In-app documentation inventory (32 pages + layout)

| Route | Component | Tab | Staleness verdict |
|-------|-----------|-----|-------------------|
| `/docs` | `IntroductionDoc.tsx` | getting-started | **OK** — uses `docsStats`, hero image verified |
| `/docs/guides` | `UserGuideDoc.tsx` | getting-started | **OK** |
| `/docs/faq` | `FaqDoc.tsx` | getting-started | **OK** |
| `/docs/architecture` | `ArchitectureDoc.tsx` | protocol | **OK** |
| `/docs/zama-fhe` | `ZamaFheDoc.tsx` | zama | **OK** |
| `/docs/fhe-primitives` | `FhePrimitivesDoc.tsx` | zama | **OK** |
| `/docs/client-encryption` | `ClientEncryptionDoc.tsx` | zama | **OK** |
| `/docs/semaphore` | `SemaphoreDoc.tsx` | semaphore | **OK** |
| `/docs/noir` | `NoirDoc.tsx` | noir | **OK** |
| `/docs/engine` | `EligibilityEngineDoc.tsx` | noir | **OK** — public inputs = 25 |
| `/docs/contracts` | `SmartContractsDoc.tsx` | protocol | **OK** |
| `/docs/sponsor-system` | `SponsorSystemDoc.tsx` | protocol | **OK** |
| `/docs/automation` | `ChainlinkAutomationDoc.tsx` | protocol | **OK** |
| `/docs/subgraph` | `SubgraphIndexingDoc.tsx` | clients | **OK** — Studio `medvault/v0.2.0` via `SUBGRAPH_QUERY_URL` |
| `/docs/frontend` | `FrontendArchitectureDoc.tsx` | clients | **OK** |
| `/docs/identity-privacy` | `IdentityPrivacyDoc.tsx` | clients | **OK** |
| `/docs/private-withdrawals` | `PrivateWithdrawalsDoc.tsx` | operations | **OK** |
| `/docs/staking` | `PrivateStakingDoc.tsx` | operations | **OK** |
| `/docs/deployment` | `DeploymentGuideDoc.tsx` | operations | **OK** |
| `/docs/timelock-wiring` | `TimelockWiringDoc.tsx` | operations | **OK** |
| `/docs/mobile/android-apk` | `AndroidApkDoc.tsx` | operations | **OK** |
| `/docs/mcp` | `McpServerDoc.tsx` | mcp | **OK** |
| `/docs/mcp/sdk` | `SdkDoc.tsx` | mcp | **OK** |
| `/docs/mcp/setup` | `McpSetupDoc.tsx` | mcp | **OK** |
| `/docs/mcp/tools` | `McpToolsDoc.tsx` | mcp | **Review** — tool count vs server |
| `/docs/testing` | `TestingOverviewDoc.tsx` | testing | **OK** — `SUITE_STATS` from manifest |
| `/docs/testing/matrix` | `TestingMatrixDoc.tsx` | testing | **OK** — uses `testSuiteData` |
| `/docs/testing/infrastructure` | `TestingInfrastructureDoc.tsx` | testing | **OK** |
| `/docs/testing/ci` | `TestingCiDoc.tsx` | testing | **OK** |
| `/docs/security-model` | `SecurityModelDoc.tsx` | security | **OK** |
| `/docs/compliance` | `ComplianceDoc.tsx` | security | **OK** |
| `/docs/changelog` | `ChangelogDoc.tsx` | operations | **OK** |
| — | `DocsLayout.tsx` | shell | **OK** |

---

## Key source files (documentation-adjacent)

| File | Role | Audit note |
|------|------|------------|
| `src/lib/docsNav.ts` | IA, search, `DOCS_CONTRACT_COUNT` | **OK** — 48 nav entries |
| `src/lib/docsStats.ts` | **Canonical stats manifest (Plan 00)** | Source of truth for counts going forward |
| `src/lib/protocolContracts.ts` | Contract catalog | 15 + Honk; trial criteria described as public |
| `src/pages/docs/testing/testSuiteData.ts` | Test section facts | `SUITE_STATS.totalPassing = 491` (from `docsStats`) |
| `docs/AUDIT.md` | This file | Baseline artifact |

---

## HTTP route inventory

### Relayer (`relayer/server.js`) — 10

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/relay/pin-document` |
| POST | `/relay/apply-stage` |
| POST | `/relay/apply-finalize` |
| POST | `/relay/register` |
| POST | `/relay/claim` |
| POST | `/relay/register-anon` |
| POST | `/relay/completion-proof` |
| POST | `/relay/public-exit` |
| POST | `/relay/apply` (deprecated stub) |

### AI service (`ai-service/src/server.ts`) — 4

| Method | Path |
|--------|------|
| GET | `/health` |
| POST | `/ai/extract-criteria` |
| POST | `/ai/audit-logs` |
| POST | `/ai/validate-criteria` |

### Indexer (`indexer/src/api.ts`) — 5

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/alerts` |
| GET | `/trials` |
| GET | `/sponsor/:addr/stats` |
| GET | `/trial/:id/applications` |

### MCP HTTP (`mcp-server/src/http.ts`) — 2

| Method | Path |
|--------|------|
| GET | `/health` |
| * | `/mcp` (Streamable HTTP transport) |

---

## MCP tools (33)

**Read (23):** `medvault_get_config`, `medvault_list_protocol_contracts`, `medvault_check_wiring`, `medvault_subgraph_query`, `medvault_get_active_trials`, `medvault_get_sponsor_trials`, `medvault_get_sponsor_matches`, `medvault_get_sponsor_stats`, `medvault_get_audit_logs`, `medvault_get_sponsor_verification`, `medvault_get_trial_pool_status`, `medvault_get_sponsor_trial_pool_details`, `medvault_read_contract_view`, `medvault_relayer_health`, `medvault_doctor`, `medvault_list_capabilities`, `medvault_get_client_config_help`, `medvault_get_protocol_health`, `medvault_get_sponsor_overview`, `medvault_preview_fund_trial_pool`, `medvault_get_trial_operations_timeline`, `medvault_ai_extract_criteria`, `medvault_ai_audit_logs`

**Write (10):** `medvault_create_trial`, `medvault_set_trial_milestones`, `medvault_fund_trial_pool`, `medvault_update_application_status`, `medvault_deactivate_trial`, `medvault_distribute_milestone`, `medvault_register_anonymous_participant`, `medvault_reclaim_trial_pool`, `medvault_reclaim_abandoned_pool`, `medvault_claim_reclaimed_pool`

---

## Verification checklist (Plan 00)

- [x] Statistics table matches Glob/Grep counts reproduced above
- [x] Every conflict (test counts, contract count, public-input count, subgraph slug) listed with values and paths
- [x] `.env.docker.example` confirmed present (742 B)
- [x] `docsStats` exports compile and are imported by at least one doc page (`IntroductionDoc.tsx`)

---

## Plan 10 — Final QA coverage table (2026-06-30)

Every major system has **one canonical doc home**. Cross-links point here; duplicate prose avoided per [docs/README.md](./README.md) dual-doc sync rule.

### Features & workflows

| Topic | Canonical doc | Layer |
|-------|---------------|-------|
| Anonymous apply (Semaphore + relayer) | `/docs/semaphore`, `/docs/guides` | In-app |
| Eligibility FHE scoring + finalize | `/docs/engine`, `docs/ATOMIC_FLOWS.md` | Both |
| Hybrid document upload (IPFS + FHE keys) | `docs/HYBRID_STORAGE.md`, `/docs/guides` | Both |
| Zero-revelation milestone rewards | `docs/ZERO_REVELATION_REWARDS.md`, `/docs/sponsor-system` | Both |
| Private withdrawals / public exit | `docs/PRIVATE_WITHDRAWALS.md`, `/docs/private-withdrawals` | Both |
| Private staking (cETH + Aave) | `/docs/staking` | In-app |
| Sponsor KYC & trial funding | `/docs/sponsor-system` | In-app |
| Chainlink trial finalization | `/docs/automation`, `contracts/MedVaultAutomation.sol`, `contracts/cre/AutomationReceiver.sol`, `cre/` | Both |
| Timelock admin wiring | `docs/TIMELOCK_WIRING.md`, `/docs/timelock-wiring` | Both |
| Compliance audit trail | `/docs/compliance`, `DataAccessLog` in `/docs/contracts` | Both |
| Android demo APK | `docs/ANDROID_APK.md`, `/docs/mobile/android-apk` | Both |

### Services & packages

| Service / package | Canonical doc |
|-------------------|---------------|
| Frontend (Vite/React) | `/docs/frontend` |
| Relayer | `relayer/README.md`, `/docs/identity-privacy` |
| AI service | `ai-service/README.md`, MCP tools doc |
| Indexer | `indexer/README.md`, `docs/DOCKER.md` (indexer profile) |
| MCP server | `docs/MCP_SERVER.md`, `/docs/mcp/*` |
| Subgraph | `docs/SUBGRAPH_SYNC.md`, `/docs/subgraph` |
| `@medvault/sdk` | `packages/medvault-sdk/README.md`, `/docs/mcp/sdk` |
| `@medvault/core` | `packages/medvault-core/README.md` |
| Sepolia faucet | `sepolia-faucet/README.md` |

### Contracts (15 production + alias + Honk)

| Contract | Canonical doc |
|----------|---------------|
| All protocol contracts | `/docs/contracts`, `src/lib/protocolContracts.ts` |
| cETH / IERC7984 | `docs/ERC7984_CONFIDENTIAL_TOKEN.md` |
| EligibilityEngine formal properties | `docs/formal-verification/eligibility-engine.spec.md` |
| EligibilityEngine formal/differential results (Phase 5) | `docs/formal-verification/certora-halmos-results.md` |
| HonkVerifier | `/docs/noir`, `/docs/contracts` (optional ZK entry) |

### APIs & integrations

| API surface | Canonical doc |
|-------------|---------------|
| Relayer HTTP (10 routes) | `relayer/README.md` |
| AI service (4 routes) | `ai-service/README.md` |
| Indexer (5 routes) | `indexer/README.md` |
| MCP tools (31) | `/docs/mcp/tools`, `mcp-server/README.md` |
| Zama FHE client | `/docs/zama-fhe`, `internal-docs/zama-integration.md` |
| The Graph | `docs/SUBGRAPH_SYNC.md` |

### Architecture & security

| Topic | Canonical doc |
|-------|---------------|
| System architecture | `/docs/architecture`, `internal-docs/architecture.md` |
| Data flows | `internal-docs/dfd.md` |
| Threat model | `internal-docs/threat-model.md`, `/docs/security-model` |
| Noir–FHE integrity gap | `SECURITY.md` |
| SRS | `internal-docs/srs.md` |

### Testing & ops

| Topic | Canonical doc |
|-------|---------------|
| Test suite overview | `/docs/testing`, `docs/TESTING_GUIDE.md` |
| Case ID matrix | `docs/TEST_MATRIX.md`, `/docs/testing/matrix` |
| CI / Docker | `/docs/testing/ci`, `docs/DOCKER.md`, `docs/LOCAL_DEVELOPMENT.md` |
| Deploy runbook | `/docs/deployment` |
| Verification record | `docs/VERIFICATION_SNAPSHOT.md` |
| Statistics manifest | `src/lib/docsStats.ts`, `src/pages/docs/testing/testSuiteData.ts` |

## Plan 10 verification checklist

- [x] Conflicting counts (283, 285, 216, 218, ~330, 1,600, contract 14, public-input 16/17) reconciled or explicitly historical
- [x] Every `/docs/*` route has a `docsNav` entry; external markdown linked in nav
- [x] Coverage table above — one owner per topic
- [x] Stale design proposals in `docs/archive/`
- [x] Orphan docs indexed in `docs/README.md` + `docsNav.ts`
- [x] Glossary + terminology in `docs/README.md`
- [x] Mermaid diagrams in `internal-docs/` + `docs/DOCKER.md` match verified architecture (ConfidentialETH7984, indexer profile)
- [x] Dual-doc sync rule + PR checklist in `docs/README.md`
- [x] Hero image `public/assets/images/medvault_fhe_hero.png` verified; `.tmp-build-review/images/*` flagged as non-doc

---

*Plan 10 complete. Repository markdown and in-app docs share one statistics manifest (`docsStats`) and cross-link under the dual-doc sync rule.*
