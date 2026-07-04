# Relayer trust boundaries

Proof-style summary of what MedVault's authorized relayer **cannot** do, what it **can** do, and how multi-relayer design limits residual risk. This is architectural evidence for judges and auditors — not a formal verification certificate.

See also: [P3_3_THRESHOLD_ATTESTATION.md](./P3_3_THRESHOLD_ATTESTATION.md) (deferred on-chain quorum), [SECURITY.md](../SECURITY.md), [relayer/README.md](../relayer/README.md).

## Threat model

The MedVault relayer is a **gasless submission operator** on Ethereum Sepolia. It:

- Submits transactions signed or permitted by patients (EIP-712, Semaphore)
- Optionally re-decrypts staged FHE eligibility when it is the staged `permitRecipient` (P0.2)
- Runs a chain watcher for withdraw/unstake completion proofs

The relayer is **not** the eligibility compute authority (that is `EligibilityEngine` FHE) and **not** a fund custodian (cETH lives in `ConfidentialETH` / `SponsorIncentiveVault`).

## What the relayer cannot do

### Cannot steal vault funds

| Control | Mechanism |
|---------|-----------|
| No cETH mint | Relayer has no `onlyOwner` on vault or cETH; cannot mint confidential balances |
| Pull-claim | Payout requires patient `confirmReceipt` + KMS decryption proof before cETH credit |
| P2 payout gate | `FHE.select` gates vault distribution on on-chain encrypted eligibility — forged Noir `eligible` cannot move value |
| Public exit binding | `completePublicExit` requires EIP-712 auth bound to `withdrawNonces` — replay consumed auth reverts |

**Tests:** `P3-05` (`test/unit/p3-relayer-trust-reduction.test.ts`), `PEX-04` (`test/unit/public-exit.test.ts`), `GASLESS-02` (`test/unit/gasless-claim.test.ts`).

### Cannot forge eligibility

| Control | Mechanism |
|---------|-----------|
| FHE authority | `EligibilityEngine` computes eligibility homomorphically; relayer does not write eligibility bits |
| Noir binding | Encrypted-mode circuit binds identity, nullifier, staged handle — not a standalone eligible flag |
| P0.2 re-decrypt | When relayer is `permitRecipient`, `/relay/apply-finalize` user-decrypts `finalCt` and **ignores** client `eligible` |
| Silent rejection | Ineligible finalize emits `SilentApply` — no trial enrollment, no payout path |

**Tests:** `RDV-01` (`test/integration/relayer-decrypt-verify.test.ts`), `SF-01` (`test/unit/silent-failure.test.ts`), `FLOW-02` (`test/integration/v09-complete-flow.test.ts`).

### Cannot replay consumed stages or exits

| Control | Mechanism |
|---------|-----------|
| Nullifier consumption | `trialApplications[trialId][nullifier]` — second finalize reverts `Already applied to this trial` |
| Stale stage permit | `deadline > lastStageDeadline[trialId][nullifier]` after cancel — old permit cannot re-stage |
| Public exit replay | Consumed EIP-712 exit auth cannot be reused (`PEX-04`) |

**Tests:** `REL-REP-01`, `REL-REP-02`, `INT-EE-10` (`test/integration/eligibility-anonymous.test.ts`).

## What the relayer can do (residual risk)

**Censor or delay** — the relayer can:

- Refuse to relay stage, finalize, register, or cancel
- Withhold gas and leave patients to wait or switch relayers
- Go offline (availability risk)

**Mitigations (shipped / spec):**

- **P3.1 multi-relayer:** `authorizedRelayers` allowlist with 6-hour timelock; patients choose among relayers (`VITE_RELAYER_URLS`)
- **P3.3 (spec only):** independent decrypt attestations + M-of-N co-sign before finalize — see [P3_3_THRESHOLD_ATTESTATION.md](./P3_3_THRESHOLD_ATTESTATION.md)
- **On-chain transparency:** `AuthorizedRelayerUpdated`, `PatientRegisteredViaRelayer`, `AnonymousApplyStaged` indexed for monitoring

Equivocation (two relayers attesting conflicting eligibility off-chain) is **detectable** under P3.3 spec; today only the relayer that successfully submits on-chain matters, and duplicate finalize reverts.

## Comparison to escrow-style payment models

| Dimension | MedVault | Typical escrow coordinator |
|-----------|----------|----------------------------|
| Payment integrity | FHE-gated pull-claim; relayer cannot credit cETH | Coordinator holds or releases escrow |
| Eligibility truth | On-chain FHE engine | Often off-chain CRM / coordinator attestation |
| Identity | Semaphore nullifier + commitment | KYC or wallet-only |
| Operator trust | N authorized relayers; censorship-only residual | Single coordinator can block or mis-route |
| Availability | Patient switches relayer URL | Single API endpoint |

## Operational requirements

1. Each Railway relayer service uses a distinct `RELAYER_PRIVATE_KEY` listed in `RELAYER_ADDRESSES`
2. Each relayer receives `ensureCethContractAuth` via `wireAllContracts`
3. Only one instance should run `WATCHER_ENABLED=true` (avoid duplicate auto-completions)
4. `GET /transparency` on each relayer publishes pinned contracts, P0.2 policy, and metrics

## Test matrix (relayer adversarial)

| ID | Scenario | Expected |
|----|----------|----------|
| REL-EQV-01 | Two relayers, conflicting off-chain attestations | Second on-chain finalize reverts; equivocation auditable under P3.3 spec |
| REL-EQV-02 | Unauthorized wallet finalize | `Only authorized relayer` |
| REL-REP-01 | Double finalize same nullifier | `Already applied to this trial` |
| REL-REP-02 | Re-stage with stale permit after cancel | `Stale stage permit` |
| REL-FF-01 | P0.2 decrypt false | HTTP `NOT_ELIGIBLE` |
| REL-FF-02 | Forged Noir + ineligible FHE | Payout blocked / `SilentApply` |
| REL-STALE-01 | Finalize after staging TTL | `STAGING_EXPIRED` |
| REL-STALE-02 | Finalize after cancel | Cache invalidated |

Implemented in `test/unit/relayer-adversarial.test.ts` and related integration tests.
