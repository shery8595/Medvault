# Local Development

MedVault targets **Ethereum Sepolia** with hosted Zama fhEVM relayer and Graph Studio. You can start the demo with Docker Compose or the legacy npm workflow.

**Detailed Docker guide:** [DOCKER.md](./DOCKER.md) (profiles, production build, troubleshooting).

## One-command Docker (recommended for judges)

```bash
cp .env.docker.example .env.local
# Edit VITE_PRIVY_APP_ID (required) and optional relayer vars

docker compose up --build
```

Open **http://localhost:3000**. The frontend container runs Vite against Sepolia RPC, hosted subgraph, and Zama relayer (proxied in dev).

### Optional profiles

| Profile | Command | Services |
|---------|---------|----------|
| *(default)* | `docker compose up --build` | Frontend on `:3000` |
| Relayer | `docker compose --profile relayer up --build` | HTTP relayer on `:8787` |
| Local Graph | `docker compose --profile graph up --build` | IPFS, Postgres, Graph Node, subgraph deploy |
| Indexer | `docker compose --profile indexer up --build` | Mongo, Redis, indexer API on `:3300` |

Profiles can be combined, e.g. `docker compose --profile relayer --profile indexer up --build`.

Relayer requires `relayer/.env` or env vars from `.env.docker.example` (`REGISTRY_ADDRESS`, `RELAYER_PRIVATE_KEY`, `CONFIDENTIAL_ETH_ADDRESS`, etc.).

See [DOCKER.md](./DOCKER.md) for architecture diagram, env reference, and troubleshooting.

### Smoke check

```bash
npm run docker:smoke
```

Builds and starts the frontend service, waits for `:3000`, then tears down.

## Legacy npm workflow

```bash
npm install
cp .env.example .env.local
npm run compile
npm run dev
```

Optional services:

| Service | Command |
|---------|---------|
| Relayer | `cd relayer && npm install && node server.js` |
| MCP server | `npm run mcp:build && npm run mcp:dev` |
| Indexer | `npm run indexer:dev` |
| AI service | `npm run ai:dev` |
| Tests | `npm test` |

## CI (no CD)

GitHub Actions runs **four workflows** on push/PR to `main`/`master`. There is **no continuous deployment** — production releases are manual:

| Surface | Manual deploy path |
|---------|-------------------|
| Contracts | Hardhat scripts (`npm run deploy:sepolia`, wiring, subgraph) |
| Frontend | Vercel (`npm run vercel:ship`) |
| Relayer | Railway (or host `relayer/server.js`) |
| Subgraph | Graph Studio (`npm run subgraph:deploy`) |

### Workflows

| Workflow | Trigger | Jobs | Secrets / env | What it does |
|----------|---------|------|---------------|--------------|
| [contracts-test.yml](../.github/workflows/contracts-test.yml) | push/PR `main`, `master` | `test`, `fork`, `coverage` | `SEPOLIA_RPC_URL` (fork job) | Compile, `verify-production-deploy.mjs`, `verify-honk-verifier.mjs`, unit/integration/crypto/fuzz tests, Sepolia fork tests, coverage gate (≥85%) |
| [frontend.yml](../.github/workflows/frontend.yml) | push/PR `main`, `master` | `build` | — | `tsc --noEmit`, `build:prebuilt`, Vitest frontend tests |
| [docker-smoke.yml](../.github/workflows/docker-smoke.yml) | push/PR `main`, `master` | `smoke` | — | `npm run docker:smoke` (frontend Compose health) |
| [mcp.yml](../.github/workflows/mcp.yml) | push/PR when MCP paths change | `mcp` | — | `mcp:build`, export/validate config, offline smoke, `@medvault/sdk` tests |

Path filters on `mcp.yml`: `mcp-server/**`, `packages/medvault-core/**`, `packages/medvault-sdk/**`, `config/mcp/**`, `package.json`.

**Not in CI:** contract deploy, Vercel publish, Railway relayer deploy, Graph Studio subgraph publish, Android APK builds.

## Networks

| Network | Hardhat name | Chain ID | Use |
|---------|--------------|----------|-----|
| Ethereum Sepolia | `sepolia` | `11155111` | **Production testnet** — deploy, frontend, relayer, subgraph |
| Hardhat local | `hardhat` | `31337` | Unit/integration tests (auto timelock fast-forward) |
| Sepolia fork | `sepoliaFork` | `11155111` | Fork tests (`npm run test:fork`; needs `SEPOLIA_RPC_URL`) |
| Arbitrum | — | — | **Reclaim + Semaphore only** in `addresses.json` — no full MedVault deploy |
| Mainnet | — | — | **Not supported** — no mainnet addresses or deploy scripts |

## Environment variables

| File | Use |
|------|-----|
| [.env.example](../.env.example) | Legacy Vite local dev + deploy/subgraph/MCP/indexer vars |
| [.env.docker.example](../.env.docker.example) | Docker Compose defaults |
| [relayer/.env.example](../relayer/.env.example) | Relayer service (Railway / local) |
| [sepolia-faucet/.env.example](../sepolia-faucet/.env.example) | Optional testnet drip service |

Minimum for the web demo:

- `VITE_PRIVY_APP_ID` — wallet auth
- `VITE_SUBGRAPH_URL` — The Graph Studio query URL (canonical: `medvault` / `v0.2.0`)

Deploy scripts additionally need `PRIVATE_KEY` and `SEPOLIA_RPC_URL` in `.env` (see `.env.example`).

## New in parity release

| Feature | Doc |
|---------|-----|
| IERC7984 cETH | [ERC7984_CONFIDENTIAL_TOKEN.md](./ERC7984_CONFIDENTIAL_TOKEN.md) |
| Docker Compose | [DOCKER.md](./DOCKER.md) |
| Formal specs | [internal-docs/](../internal-docs/README.md) |
| Verification record | [VERIFICATION_SNAPSHOT.md](./VERIFICATION_SNAPSHOT.md) |
| Repository audit baseline | [AUDIT.md](./AUDIT.md) |

## Internal documentation

Formal engineering docs live in [internal-docs/](../internal-docs/README.md) (SRS, DFD, threat model, Zama integration guide).

Full doc index: [docs/README.md](./README.md).
