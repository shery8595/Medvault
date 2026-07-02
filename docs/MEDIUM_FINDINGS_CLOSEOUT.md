# Medium Findings Closeout (2026-07-02)

Canonical record for closing the three open/Accepted **Medium** rows in [`internal-docs/threat-model.md`](../internal-docs/threat-model.md). Produced after the post-P1 security audit cycle.

## Scope and method

| ID | Original threat-model row | Action |
|----|---------------------------|--------|
| **M-AUDIT-1** | `SponsorRegistry.auditor` dead role | **Resolved** — setter already shipped; doc reconciled; zero-address guard added |
| **M-SILENT-1** | Silent eligibility rejection | **Closed (Informational)** — privacy-by-design after P1; no code change |
| **M-REGCON-1** | Registration consistency gap | **Closed (Low)** — SDK-blocked (P5-B = no); residual trust assumption documented |

**Out of scope:** Mitigated Mediums (reentrancy, public-exit mis-binding, legacy trial bounds, KMS proof gate, indexer HTTP auth) and already-Resolved Mediums (M-1 consent, M-2 automation).

---

## M-AUDIT-1 — `SponsorRegistry.auditor` dead role → Resolved

### Finding recap

The threat model claimed `auditor` was checked in auth paths but had **no on-chain setter**, so the role would remain `address(0)` unless the contract was upgraded.

### Actual state (stale doc)

`scheduleAuditor` / `applyAuditor` already exist with a **6-hour timelock** (`READER_CHANGE_DELAY`):

```79:89:contracts/SponsorRegistry.sol
    function scheduleAuditor(address _auditor) external onlyOwner {
        pendingAuditor = _auditor;
        auditorChangeEta = block.timestamp + READER_CHANGE_DELAY;
    }

    function applyAuditor() external onlyOwner {
        require(auditorChangeEta != 0 && block.timestamp >= auditorChangeEta, "Timelock active");
        auditor = pendingAuditor;
        auditorChangeEta = 0;
        pendingAuditor = address(0);
    }
```

The role gates read access to encrypted institution IDs at `getEncryptedInstitutionId` and `getRequestEncryptedId` (`contracts/SponsorRegistry.sol` ~187, ~198). Regression coverage existed in `test/unit/remediation-vuln-fixes.test.ts` (LOW-2).

### Remediation (this closeout)

1. **Zero-address guard** on `scheduleAuditor` — prevents owner from scheduling `address(0)` and silently clearing the role via `applyAuditor`.
2. **Natspec** on `auditor`, `scheduleAuditor`, and `applyAuditor` describing the off-chain attestation workflow.
3. **Dedicated tests** in `test/unit/sponsor-registry-auditor.test.ts`.

### Test assertions

- `scheduleAuditor(ZERO)` reverts `"Zero auditor"`.
- `applyAuditor()` before timelock reverts `"Timelock active"`.
- After timelock, `auditor` is set; auditor can read `getEncryptedInstitutionId`; strangers revert `"Not authorized"`.
- `pendingAuditor` and `auditorChangeEta` cleared after apply.

---

## M-SILENT-1 — Silent eligibility rejection → Informational (closed, by-design)

### Finding recap

In plaintext-mode trials (Hardhat fixtures), ineligible anonymous finalize calls `_rejectStagedFinalize` without reverting; `silentApplyOutcome = SilentRejected`. Observers see no on-chain plaintext eligibility bit.

### Why this is not a contract vulnerability

After **P1 (H-1 redesign)**:

- Encrypted-mode Noir proves **identity and binding only** — not eligibility (`circuits/eligibility_encrypted`).
- **FHE** is the sole eligibility authority; vault payout uses `getAnonymousResultForVault` + `FHE.select` in `VaultChallengeLib.deliverConfirmedReward`.
- Reverting on ineligible finalize would emit a **public eligibility signal** on-chain, re-introducing the leak P1 removed.

`anonymousApplicationAccepted` marks a **verified anonymous application**, not medical eligibility (`SECURITY.md`, P1 plan).

### Remediation

**None.** Document as Informational / closed by-design. Sponsors and integrators should treat `silentApplyOutcome` and FHE `anonymousResults` as the confidential eligibility path.

### Evidence

- `contracts/EligibilityEngine.sol` — `_rejectStagedFinalize`, `_finalizeAnonymousEligibilityWithProofCore`
- `.cursor/plans/p1_h1_encrypted_eligibility_redesign.plan.md`
- `test/unit/eligibility-engine.test.ts` (encrypted ineligible + valid proof → accepted application, vault does not pay)

---

## M-REGCON-1 — Registration consistency gap → Low (closed, SDK-blocked)

### Finding recap

`AnonymousPatientRegistry.registerPatient` stores `profileCommitment` independently of FHE ciphertext handles. `FHE.fromExternal` + `inputProof` validate well-formedness only. A malicious client could commit to profile **A** and encrypt profile **B**.

### Why Medium → Low

This is an **accepted residual trust assumption**, not an exploitable contract defect:

- **RegConsistency-A** is **blocked** until Zama ships a privacy-preserving dual-layer binding API (P5-B = **No**). See [`docs/REGCONSISTENCY_B_FINDING.md`](./REGCONSISTENCY_B_FINDING.md).
- `FHE.checkSignatures` at registration would require **public decrypt** — unacceptable PHI leakage.
- **Consistency ≠ clinical truth.** Even perfect binding would only prove internal alignment, not real-world medical records (`SECURITY.md`).

### Remediation

**None on-chain.** Operational mitigation: honest-client assumption on wallet/relayer UX; `profileSaltCommitment` (MED-1) blocks deterministic salt replay.

### Evidence

- `contracts/AnonymousPatientRegistry.sol` — `registerPatient`
- [`docs/REGCONSISTENCY_B_FINDING.md`](./REGCONSISTENCY_B_FINDING.md)
- [`SECURITY.md`](../SECURITY.md#registration-consistency-p5-regconsistency-b--blocked)

---

## Sync table

| ID | Vector | Old severity | New severity | Status | Primary evidence |
|----|--------|--------------|--------------|--------|------------------|
| M-AUDIT-1 | `SponsorRegistry.auditor` dead role | Medium | — | **Resolved** | `SponsorRegistry.sol:79-89`, `sponsor-registry-auditor.test.ts` |
| M-SILENT-1 | Silent eligibility rejection | Medium | **Informational** | **Closed (by-design)** | `EligibilityEngine.sol:936-992`, P1 plan |
| M-REGCON-1 | Registration consistency gap | Medium | **Low** | **Closed (SDK-blocked)** | `REGCONSISTENCY_B_FINDING.md`, `SECURITY.md` |

---

## Related docs

- [`internal-docs/threat-model.md`](../internal-docs/threat-model.md) — STRIDE table (rows updated to match this file)
- [`SECURITY.md`](../SECURITY.md) — Registration consistency + Noir-FHE integrity sections
- [`.cursor/plans/p1_h1_encrypted_eligibility_redesign.plan.md`](../.cursor/plans/p1_h1_encrypted_eligibility_redesign.plan.md) — P1 context for M-SILENT-1
