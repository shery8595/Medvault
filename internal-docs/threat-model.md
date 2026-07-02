# Threat Model

STRIDE-oriented threat table exported from in-app security docs and contract audit comments. Each row maps to a verified source finding in contracts, indexer, or [`SECURITY.md`](../SECURITY.md).

## Remediation index (P0–P6)

| ID | Status | Notes |
|----|--------|-------|
| C-1 | Resolved | cETH pending-withdraw transfer gate |
| H-1 | Resolved (redesign) | Dual circuits; FHE = eligibility; ZK encrypted mode = identity/binding |
| H-2 | Resolved (hybrid) | Atomic revoke+rotate; pull key access; IPFS limits documented |
| M-1 | Resolved | `getActiveConsent` consumer audit |
| M-2 | Resolved | Automation liveness / quarantine |
| H-3 (original) | **No longer applicable** | Superseded by P1 — **not** marked "resolved" |
| RegConsistency | Low / closed (SDK-blocked) | Separate from eligibility; RegConsistency-A blocked — see [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md) |

Post-P1: **`anonymousApplicationAccepted`** ≠ medical eligibility; vault pays on FHE results only.

| Vector | Severity | Status | Mitigation | Source |
|--------|----------|--------|------------|--------|
| Plaintext exposure in transit | Critical | Mitigated | Browser encrypts via `@zama-fhe/sdk` before RPC; ZK `inputProof` on-chain | `AnonymousPatientRegistry`, `MedVaultRegistry` |
| On-chain state leakage | Critical | Mitigated | Vitals as `euint*` handles; decrypt requires FHE ACL | All FHE contracts |
| Sybil fake trials | High | Mitigated | `SponsorRegistry.isVerifiedSponsor()` gate | `TrialManager` |
| Malformed ciphertext injection | High | Mitigated | `FHE.fromExternal` + proof validation | Registry ingress |
| Cross-contract reentrancy | Medium | Mitigated | `nonReentrant` on fund paths; OZ guards elsewhere | `ConfidentialETH7984`, vault paths |
| Unauthorized decryption | Critical | Mitigated | `FHE.allow`; `ConsentManager` EIP-712 gates | `ConsentManager`, ACL |
| Sponsor key compromise | High | Partially mitigated | `emergencyRemoveSponsor`; consent expiry | `SponsorRegistry` |
| Withdrawal staging leakage | Low | Mitigated | `transferable = FHE.select(ge(bal, units), units, 0)` — no public sufficiency boolean at request; amount revealed only at KMS completion | `ConfidentialETH7984`, SUF-* tests |
| Malicious admin wiring | High | Mitigated | 2-day schedule/apply timelocks (MH-1, M-3) | `scripts/lib/timelockWiring.ts` |
| Unauthorized withdraw-to | High | Mitigated | Patient EIP-712 `WithdrawTo` on `ConfidentialETH7984` | TL-05, E2E-09 |
| Relayer public exit mis-binding | Medium | Mitigated | EIP-712 v2 `WithdrawAuthorization` binds `transferableHandle`; nonce replay protection | SUF-05 / PEX-* tests |
| Event metadata analysis | Low | Accepted | Structural events only; no ciphertext or amounts in logs | Privacy event tests |
| AI protocol PHI leakage | Critical | Mitigated | `@medvault/ai` redacts PHI before every LLM call | `ai-service/src/redaction.ts` |
| AI auto-transact | High | Mitigated | Criteria extraction is pre-fill only; sponsor must submit on-chain | `ai-service` |
| **FHE ACL persists after consent revoke** | High | Mitigated (forward-only) | `revokeAccess` bumps `documentEpoch`; sponsor reads gated on `sponsorGrantEpoch == documentEpoch` and **`pullSponsorKeyAccess`**. `updateDocumentKey` / `rotateDocument` rotates wrapped AES key. **Residual:** sponsors who already decrypted retain plaintext off-chain — fhEVM `FHE.allow` is irreversible; IPFS blobs may persist on other gateways | `PatientDocumentStore`, ACL-01..05, P4 |
| **`SponsorRegistry.auditor` dead role** | Medium | **Resolved** | Setter via `scheduleAuditor` / `applyAuditor` (6h timelock); zero-address guard on schedule. Auditor reads encrypted institution IDs for off-chain attestation — see [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md#m-audit-1--sponsorregistryauditor-dead-role--resolved) | `SponsorRegistry.sol` ~39, ~79–89 |
| **Silent eligibility rejection** | Medium | **Informational / closed (by-design)** | Ineligible anonymous finalize does not revert to avoid plaintext eligibility bit on-chain (P1); FHE `anonymousResults` + vault `FHE.select` payout gating — see [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md#m-silent-1--silent-eligibility-rejection--informational-closed-by-design) | `EligibilityEngine.sol` ~936–992 |
| **Indexer placeholder consent records** | Low | Accepted | `ConsentChanged` RPC handler writes `trialId: "0"`, zero address — use subgraph for real linkage | `indexer/README.md`, `docs/AUDIT.md` D10 |
| **Indexer HTTP API unauthenticated** | Medium | Mitigated | Data routes (`/alerts`, `/trials`, `/sponsor/*`, `/trial/*`) require `INDEXER_API_SECRET` Bearer token when set; `/health` public for probes | `indexer/src/auth.ts`, `indexer/README.md` |
| **Public trial bounds (legacy path)** | Medium | Mitigated | `createTrial` gated to chainid 31337; reverts on Sepolia/mainnet. Production uses `createTrialWithEncryptedCriteria` | LEG-01..04, `SECURITY.md` |
| **`ConfidentialETH.receive()` auto-deposit** | Low | Accepted | Plain ETH sent to contract auto-mints cETH to `msg.sender` — L1 amount visible | `ConfidentialETH7984.sol` ~572 |
| **KMS transferable proof gate** | Medium | Mitigated | Single-step completion decrypts homomorphic `transferable` (`uint64`); insufficient requests noop with no on-chain boolean | `docs/PRIVATE_WITHDRAWALS.md`, SUF-* |
| **Noir–FHE integrity gap** | High | Mitigated (P1 redesign + P0.2 + P2) | **P1:** encrypted Noir proves identity/binding only; FHE decides eligibility; `anonymousApplicationAccepted` ≠ eligible. Relayer re-decrypts staged ciphertext before finalize. P2 `FHE.select` payout gating. Original **H-3** (commitment-bound eligibility attestation) **no longer applicable** — superseded, not fixed in place | [`SECURITY.md`](../SECURITY.md), `EligibilityEngine.sol`, `test/unit/eligibility-engine.test.ts` |
| **cETH pending-withdraw double-spend (C-1)** | Critical | Resolved | `_requireTransferUnlocked` checks `!_isPending[from]`; `setOperator` blocked while pending | `ConfidentialETH7984.sol`, `CET-17`–`CET-22` |
| **Consent stale-handle reads (M-1)** | Medium | Resolved | Consumers use `getActiveConsent`; revoke invalidates raw handle paths | `ConsentManager`, `CM-11`–`CM-14` |
| **Automation liveness (M-2)** | Medium | Resolved | Stuck batch quarantine; bounded `checkUpkeep` | `MedVaultAutomation.sol`, `M2-01`, `M2-02` |
| **Registration consistency gap** | Medium | **Low / closed (SDK-blocked)** | `profileCommitment` and FHE profile handles stored without cross-binding; accepted residual trust assumption (P5-B = no). RegConsistency-A blocked — see [REGCONSISTENCY_B_FINDING.md](../docs/REGCONSISTENCY_B_FINDING.md) and [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md#m-regcon-1--registration-consistency-gap--low-closed-sdk-blocked) | `AnonymousPatientRegistry.registerPatient`, [`SECURITY.md`](../SECURITY.md#registration-consistency-p5-regconsistency-b--blocked) |

## Contract audit references

Embedded findings in [`contracts/SponsorIncentiveVault.sol`](../contracts/SponsorIncentiveVault.sol): CRIT-2 (distribution tracking), HIGH-3 (nullifier replay), M-1/M-3/M-5 (timelock, sponsor re-verify, reclaim), FINDING 11 (two-step ownership).

## Residual privacy limits

- Original audit **H-3** (ZK eligibility via commitment binding) is **no longer applicable** after P1 architectural redesign — do not conflate with RegConsistency.
- Registration does not cryptographically bind `profileCommitment` to encrypted vitals — honest-client assumption on wallet/relayer UX ([REGCONSISTENCY_B_FINDING.md](../docs/REGCONSISTENCY_B_FINDING.md)); re-classified **Low / closed (SDK-blocked)** in [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md).
- **`anonymousApplicationAccepted`** marks sponsor acceptance of a verified application, not on-chain medical eligibility; silent ineligible finalize is **Informational / by-design** (no plaintext eligibility bit) — see [MEDIUM_FINDINGS_CLOSEOUT.md](../docs/MEDIUM_FINDINGS_CLOSEOUT.md).
- Native ETH visible at L1 for `deposit` / trial funding / `receive()`.
- Trial criteria bounds **public** only on Hardhat legacy `createTrial` (chainid 31337); encrypted on production path.
- fhEVM `FHE.allow` grants may outlive `revokeConsent` / `revokeAccess` — forward-only revocation via epoch gating; post-decrypt sponsors may retain plaintext.
- Withdrawal sufficiency comparison no longer leaks pre-settlement; final transfer amount remains public at completion.
- Noir dishonest-witness gap in encrypted-criteria mode remains until user-decrypt proof API ships.

See [docs/FHE_AUDIT_README.md](../docs/FHE_AUDIT_README.md) for FHE primitive map and [SECURITY.md](../SECURITY.md) for Noir attestation limits.
