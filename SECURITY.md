Repository-level security findings and architectural limits. Indexed from [docs/README.md](docs/README.md) and in-app docs (`/docs/security-model`).

## Remediation status (P0–P6)

| ID | Severity | Status | Summary |
|----|----------|--------|---------|
| **C-1** | Critical | **Resolved** | Outbound cETH transfers gated on `!_isPending`; `setOperator` blocked while withdraw pending. PoC blocked; contract stays solvent (`CET-21`, `CET-22`). |
| **H-1** | High | **Resolved (redesign)** | Two Noir circuits (`eligibility_plaintext`, `eligibility_encrypted`). Encrypted mode: ZK = identity/binding only; **FHE is sole eligibility authority**; vault payout gated on FHE `anonymousResults`. |
| **H-2** | High | **Resolved (forward-only + off-chain)** | Atomic `revokeAccess` + `rotateDocument`; sponsor must `pullSponsorKeyAccess`; IPFS unpin best-effort via indexer. fhEVM `FHE.allow` irreversible — see hybrid limits below. |
| **M-1** | Medium | **Resolved** | Consent consumers audited to use `getActiveConsent`; revoke clears raw-handle paths (`CM-11`–`CM-14`, `CGA-01`). |
| **M-2** | Medium | **Resolved** | Automation quarantines stuck trials after `MAX_BATCH_FAILURES`; `checkUpkeep` gas bounded (`M2-01`, `M2-02`). |
| **H-3 (original audit)** | High | **No longer applicable** | Original finding — eligibility via commitment binding in ZK — was **superseded by P1 redesign**, not fixed in place. Do **not** mark as "resolved." |
| **RegConsistency** | Low | **Closed (SDK-blocked)** | Registration consistency re-classified Low; see [MEDIUM_FINDINGS_CLOSEOUT.md](docs/MEDIUM_FINDINGS_CLOSEOUT.md) and RegConsistency-A blocked pending Zama dual-layer binding API. |

### Architectural trust model (post-P1)

| Layer | Role after remediation |
|-------|------------------------|
| **FHE (`EligibilityEngine`)** | Sole on-chain eligibility compute authority on encrypted patient data and trial criteria |
| **Noir (encrypted mode)** | Identity, nullifier, staged-handle, and policy binding — **not** fhEVM execution proof and **not** eligibility attestation |
| **Vault payout** | FHE `anonymousResults` + pull-claim (`confirmReceipt` before cETH credit); `anonymousApplicationAccepted` means **application verified**, not medically eligible |

## Limitations & Trust Model (summary)

| Layer | Guarantees | Does not guarantee |
|-------|------------|-------------------|
| **FHE** | Homomorphic matching on ciphertext in `EligibilityEngine` | Off-chain PHI; wallet linkage; L1 ETH visibility |
| **Noir** | Identity and policy attestation | fhEVM execution; compliance seal ≠ eligibility proof |
| **Relayer** | Gasless relay; P0.2 staged-ciphertext re-decrypt before finalize (defense-in-depth); multi-relayer choice (P3.1) | Payout integrity via `FHE.select` gating (P2 shipped). Relayer can **censor or delay** only — see [docs/RELAYER_TRUST_BOUNDARIES.md](docs/RELAYER_TRUST_BOUNDARIES.md) |
| **Compliance** | Privacy-by-design on-chain | **Not HIPAA-compliant today** |

Full disclosure: [README.md](README.md#limitations--trust-model), [relayer/README.md](relayer/README.md#transparency--logging-policy), `GET /transparency` on the relayer.

## Trial criteria: two on-chain paths

`TrialManager` supports both:

| Path | Function | Criteria on-chain | When used |
|------|----------|-------------------|-----------|
| **Encrypted (production)** | `createTrialWithEncryptedCriteria` | FHE `euint*` handles only | Production sponsor UI (`useSponsorTrialCreation`), Sepolia demos, Zama track, SDK `createTrialEncrypted`, MCP `medvault_create_trial` on non-Hardhat chains |
| **Legacy plaintext** | `createTrial` | Public min/max age, Hb, flags | **Hardhat-only** (chainid 31337) — gated by `require(block.chainid == 31337, "Use createTrialWithEncryptedCriteria on mainnet/testnet")` in `TrialManager.createTrial`. Reverts on Sepolia/mainnet. Used by Hardhat fixtures (`createTrialForSponsor`) and the deprecated SDK `createTrialOnChainPlaintext` helper. |

Patient profiles are **always** FHE-encrypted regardless of sponsor path. The plaintext-criteria path is retained only for local Hardhat fixtures and unit tests; it cannot ship to a public network. Document both paths in threat models and privacy disclosures — do not claim criteria are purely public or purely encrypted without naming this split.

## Noir-FHE Integrity Gap

MedVault combines **Zama FHE** (on-chain encrypted eligibility computation) with **Noir ZK** (compliance attestation that binds Semaphore identity, profile commitment, and the staged FHE result handle). After **P1 (H-1 redesign)**, responsibilities are explicit:

- **FHE engine** (`EligibilityEngine`) is the **compute authority** for eligibility on encrypted patient data and trial criteria.
- **Noir encrypted circuit** (`circuits/eligibility_encrypted`) provides **identity and policy attestation** — nullifier, staged FHE handle, criteria/document binding — without `eligible` or `profile_commitment` public inputs. It does **not** prove fhEVM homomorphic execution.
- **Noir plaintext circuit** (`circuits/eligibility_plaintext`, Hardhat-only) retains in-circuit `compute_eligible` for local fixtures.
- **Original audit H-3** (eligibility via commitment binding in ZK) is **no longer applicable** after P1; it was superseded by this split, not patched in the original single-circuit design.
- **`anonymousApplicationAccepted`** — renamed from `anonymousVaultScreeningEligible` — indicates the sponsor accepted a **verified anonymous application**, not on-chain medical eligibility. Vault screening payout follows FHE `anonymousResults` only.

### Known limitation

The Noir circuits do **not** cryptographically verify that FHE homomorphic operations were executed correctly inside the fhEVM coprocessor. After **P1**, encrypted mode no longer accepts an `eligible` or `decrypted_eligible` witness — dishonest eligibility bits cannot be smuggled via ZK in production encrypted-criteria trials. The residual gap is **Noir–FHE execution binding** (proving fhEVM ran the expected homomorphic program), not client-supplied eligibility bits.

A contract-level `FHE.checkSignatures` binding was scoped but **deferred**: current Zama tooling exposes a KMS-signed `decryptionProof` only for **public** decrypt, which would re-leak the eligibility bit. **P0.2 defense-in-depth:** the trusted relayer re-decrypts the staged ciphertext before finalize (defense-in-depth on staging integrity). **P2 shipped:** `FHE.select` gating makes vault payout integrity independent of relayer honesty. See [docs/formal-verification/certora-halmos-results.md](docs/formal-verification/certora-halmos-results.md).

### Mitigations in place

**Encrypted mode** (`criteria_mode = 1`, production — 15 public inputs, `HonkVerifierEncrypted`):

1. **Scope binding** — `publicInputs[0]` = `trialId`, `publicInputs[1]` = `nullifier`.
2. **FHE stage handle binding** — `publicInputs[3]` must equal the persisted on-chain `ebool` ciphertext handle (`finalCt`) from staging.
3. **Encrypted criteria echo binding** — `publicInputs[5]` must equal `keccak256(abi.encode(9 FHE criteria handles)) mod BN254`; contract recomputes from `TrialManager` encrypted criteria.
4. **Document binding** — optional document fields at indices 7–14 when `has_document = 1`.

**Plaintext mode** (Hardhat-only — 25 public inputs, `HonkVerifier`):

1. **Profile commitment binding** — `publicInputs[2]` must match `AnonymousPatientRegistry.getProfileCommitment(commitment)`.
2. **FHE stage handle binding** — `publicInputs[5]` must equal staged `finalCt`.
3. **In-circuit eligibility** — `publicInputs[4]` carries the circuit-computed eligible bit; contract compares against plaintext trial criteria at indices 7–16.

**Both modes:**

4. **Trusted relayer gate (HIGH-1)** — `MedVaultRegistry.finalizeAnonymousApplyWithProof`, `finalizeAnonymousApplyWithConsent`, `cancelAnonymousApplyStage`, and `registerPatientViaRelayer` require `authorizedRelayers[msg.sender]` (timelocked via `scheduleRelayerAuth` / `applyRelayerAuth`). A patient EOA cannot self-submit finalize; non-relayer finalize reverts with `Only authorized relayer`. `EligibilityEngine.finalizeAnonymousEligibilityWithProof` is registry-only (`Only authorized registry`).
5. **Relayer re-decrypt verification (P0.2 defense-in-depth)** — Before finalize, the relayer user-decrypts the staged `finalCt` ciphertext (relayer is `permitRecipient` from staging) via `@zama-fhe/sdk`. Cached per `(nullifier, trialId)` for `STAGING_TTL` (7 days); invalidated on cancel. Residual trust: honest relayer — same class as attester services. **P2 shipped:** `FHE.select` payout gating removes relayer honesty from the payout-integrity path.
6. **Profile salt policy (MED-1)** — Production `registerPatient` requires `profileSaltCommitment = keccak256(high-entropy salt)`; zero and deterministic per-commitment salts are rejected. See `test-support/profileCommitment.ts` for integrator helpers.
7. **Registration gate** — `SponsorIncentiveVault.registerAnonymousParticipant*` requires `eligibilityEngine.noirVerifiedResults(nullifier, trialId)` so pool enrollment follows a sealed attestation.
8. **Pool enrollment auth (MED-3)** — `registerAnonymousParticipant` requires `msg.sender == decrypt permit holder`. Trial sponsor acceptance does **not** auto-enroll; patient must call directly or via `registerAnonymousParticipantFor` (EIP-712) / relayer `POST /relay/register-anon`.
9. **Sponsor acceptance** — Anonymous participants must be explicitly accepted by the trial sponsor before registration or distribution.
10. **Pull-claim receipt (P0-1)** — `distributePartial*` stages entitlements without pushing cETH. Patients must `confirmReceipt` with a KMS decryption proof before `claimParticipantRewards`. Unconfirmed slots are prunable after `CHALLENGE_WINDOW` (7 days). Reclaim accounting uses `confirmedDistributedWei`.
11. **Abandoned pool recovery (vault HIGH-1 / P2)** — If a sponsor is removed from `SponsorRegistry` mid-trial, verified-sponsor distribution and `reclaimUndistributed` are permanently blocked. After trial end and `RECLAIM_GRACE_PERIOD`, vault owner `reclaimAbandonedToOwner` recovers residual ETH to the protocol owner (skips screening/milestone distribution gates; challenge-window timing still applies). When staged entitlements remain unconfirmed, the first `reclaimAbandonedToOwner` call opens `PARTICIPANT_CLAIM_WINDOW` (7 days); a second call within the window reverts `ParticipantClaimWindowOpen`; after the window, sweep proceeds. UI: `/admin/sponsors` recovery card; tests in `vault-security-fixes.test.ts` and `audit-remediation-fixes.test.ts`.
12. **FHE ACL epoch scaffolding (MEDIUM-1)** — `FheAclEpochLib` records `AclGranted` events and supports `rotateTrustedContract(kind, newAddr)` on patient registry, consent manager, eligibility engine, score leaderboard, trial manager, and document store. fhEVM `FHE.allow` remains append-only; epoch bumps coordinate off-chain re-grant pipelines. Full ciphertext re-encryption on rotation is deferred.
13. **Failed withdraw escrow (LOW-1)** — If ETH delivery fails in `completeWithdraw` / `completeWithdrawTo`, escrow credits the failed recipient (`pendingFailedWithdrawWei` + `claimFailedWithdraw`). If `completePublicExit` fails to pay `stealthRecipient`, escrow credits **`owner_`** (cETH holder) instead, and `withdrawNonces[owner]` is not consumed on that path. Tests: `remediation-vuln-fixes.test.ts` (LOW-1), `public-exit.test.ts` (PEX-06).

### Confidential cETH trial funding (LOW-2)

`SponsorIncentiveVault.onConfidentialTransferReceived` (ERC-7984 `confidentialTransferAndCall` path) is **disabled** via `confidentialFundingEnabled = false` and a hard `ConfidentialFundingDisabled` revert until `confidentialFundingAccountingReady` is also set true.

`VaultConfidentialLib.creditConfidentialFund` only increments the FHE `encryptedPoolSize`; it does **not** update plaintext `totalDepositedWei`, which drives distribution and reclaim math in `VaultDistributionLib`. On-chain code cannot extract plaintext from an `euint64` without leaking.

**Before re-enabling confidential funding**, pool accounting must be redesigned to track deposits and distributions as FHE sums (or via an on-chain verifiable decryption path) so plaintext totals stay consistent with actual cETH inflows. Flipping `confidentialFundingEnabled` alone is insufficient — both flags must be enabled in the same release that ships the accounting redesign.

### Hybrid document revocation (H-2 / P4)

On-chain `revokeAccess` / `rotateDocument` **cannot** revoke prior `FHE.allow` grants or delete IPFS blobs. Effective revocation requires:

1. **Forward-only on-chain gating** — `documentEpoch` / `sponsorGrantEpoch` block new sponsor reads after revoke; sponsors must **`pullSponsorKeyAccess`** per document before decrypt.
2. **Off-chain IPFS unpin** — `rotateDocument` emits `DocumentLegacyHandleRevoked` with `oldCid`; trusted indexers call Pinata unpin (best-effort) and post `attestLegacyCidUnpinned` on `PatientDocumentStore` after `postIndexerHeartbeat`.
3. **Residual risk** — sponsors who already decrypted retain plaintext off-chain; unpinned ciphertext may persist on other IPFS gateways; fhEVM ACL grants are append-only.

See [docs/HYBRID_STORAGE.md](docs/HYBRID_STORAGE.md) and [indexer/README.md](indexer/README.md).

### Registration consistency (P5 RegConsistency-B — blocked)

**Finding (2026-07-02):** The fhEVM SDK (`@zama-fhe/sdk` ^3.2.0, `@fhevm/solidity` ^0.11.1) does **not** expose an authenticated binding between a plaintext witness and a stored ciphertext handle that is verifiable in **both** Noir and Solidity without revealing PHI. Full analysis: [docs/REGCONSISTENCY_B_FINDING.md](docs/REGCONSISTENCY_B_FINDING.md). **Closeout (2026-07-02):** re-classified **Low / closed (SDK-blocked)** — see [docs/MEDIUM_FINDINGS_CLOSEOUT.md](docs/MEDIUM_FINDINGS_CLOSEOUT.md#m-regcon-1--registration-consistency-gap--low-closed-sdk-blocked).

**Residual trust assumption:**

- `registerPatient` validates FHE ingress via `FHE.fromExternal` + `inputProof` (user knows *some* plaintext for each ciphertext) but stores `profileCommitment` as an **independent** Poseidon digest with no cryptographic link to those handles.
- A malicious client can submit a commitment derived from profile **A** and ciphertexts encrypting profile **B**; both checks pass independently.
- Honest registration UX (`registerPatientWithHealthData`) uses the same plaintext for commitment and encryption — that alignment is **client trust**, not on-chain proof.
- **Consistency ≠ real PHI.** Even perfect binding would only prove internal alignment, not clinical truth; external attestation is a separate product workstream.
- **RegConsistency-A** (`circuits/profile_binding`, `ProfileBindingVerifier`) is **blocked** until Zama ships a privacy-preserving dual-layer binding API.

### Operational guidance

- Treat **authorized relayers** as **mandatory** for production finalize, cancel, and relayer registration — not optional gas savings. Configure relayers via `scheduleRelayerAuth` / `applyRelayerAuth` on `MedVaultRegistry`.
- Regenerate and redeploy **`HonkVerifier.sol`** and **`HonkVerifierEncrypted.sol`** after any circuit change (`npm run build:circuit` then `npm run generate:honk-verifier`).
- FHE remains authoritative for eligibility math; Noir encrypted mode provides identity and policy-binding evidence, not a full FHE-in-ZK proof today.
- Regression coverage: [`test/unit/remediation-vuln-fixes.test.ts`](test/unit/remediation-vuln-fixes.test.ts), [`test/unit/audit-remediation-fixes.test.ts`](test/unit/audit-remediation-fixes.test.ts), [`test/unit/confidential-eth.test.ts`](test/unit/confidential-eth.test.ts) (C-1 PoC), [`test/unit/eligibility-engine.test.ts`](test/unit/eligibility-engine.test.ts) (P1 dual-circuit).
