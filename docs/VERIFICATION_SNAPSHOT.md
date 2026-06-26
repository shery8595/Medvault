# Verification snapshot

Recorded after the Zama submission fix pass (direct wallet FHE stage binding + privacy wording updates).

| Item | Result |
|------|--------|
| **Date** | 2026-06-26 |
| **Node** | 20+ (see `package.json` engines) |
| **Network** | Ethereum Sepolia (`11155111`) — contracts unchanged |

## Commands run

```bash
npm run compile
npm run test:unit
npm run test:integration
npm run test:crypto
npm run build
npm run mobile:build
```

## Test results

| Suite | Command | Passing | Skipped / notes |
|-------|---------|---------|-----------------|
| Unit + smoke + staking | `npm run test:unit` | **194** | 2 pending (`TM-03`, `SIV-10`) |
| Integration | `npm run test:integration` | **62** | — |
| Crypto (nullifier) | `npm run test:crypto` | **3** | Honk full pipeline excluded (`npm run test:honk`) |
| **Total (default CI scope)** | — | **265** | +2 pending |

FHE sharpening pass (encrypted criteria, aggregates, batch, relayer registration, FHE-bound attestation circuit):

- `ECR-01–02`, `AGG-01`, `BAT-01`, `REL-REG-01`
- `BIND-01–03` (on-chain FHE stage hash gate); circuit `staged_fhe_handle` assert

## Build results

| Target | Command | Status |
|--------|---------|--------|
| Production web bundle | `npm run build` | Success (`dist/`) |
| Capacitor Android sync | `npm run mobile:build` | See build log below |

## Deployed contracts (unchanged)

Sepolia addresses: [`src/lib/contracts/addresses.json`](../src/lib/contracts/addresses.json)

Key contracts:

- `EligibilityEngine` — `0x4A86acb45c040c3B0331d3D8339d629863303Ec2`
- `MedVaultRegistry` — `0x1113B04951b58CC55425B6E8849CC78ADD879500`
- `HonkVerifier` — `0x1D89fC4a3FF876817b146c9d6871B1125Fa259Ae`

## Frontend fix (no redeploy required for contracts)

Direct wallet anonymous apply in `src/lib/semaphore.ts` now passes the staged FHE handle (`finalCt`) into `generateEligibilityProof`, matching the relayer path. Rebuild the web bundle and APK to ship; no contract or subgraph redeploy.
