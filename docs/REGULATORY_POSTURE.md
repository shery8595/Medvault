# MedVault regulatory posture

> **Scope statement:** MedVault is a **reference architecture for encrypted clinical-trial matching** — **not a certified clinical system**, not a HIPAA-covered entity, and not approved for regulated trial enrollment without additional operational controls.

This document is an honest assessment of where MedVault stands today versus what production deployment would require under common US and EU frameworks. It complements the technical trust model in [SECURITY.md](../SECURITY.md) and [README.md](../README.md#limitations--trust-model).

## What MedVault is (and is not)

| Claim | Status |
|-------|--------|
| Encrypted on-chain eligibility matching (Zama fhEVM) | **Implemented** (Sepolia demo) |
| Identity and policy attestation (Noir + Semaphore) | **Implemented** — attestation, not fhEVM execution proof |
| Gasless patient flows (trusted relayer) | **Implemented** — interim re-decrypt (P0.2 defense-in-depth); ciphertext payout gating via `FHE.select` (P2 shipped) |
| Production clinical trial management system | **Not in scope today** |
| HIPAA-compliant PHI platform | **Not today** — see off-chain gaps below |
| FDA-validated medical device / SaMD | **Not in scope** |
| IRB-approved research protocol | **Not in scope** — demo enrollment only |

## Regulatory topic matrix

| Topic | MedVault today | Production requirement |
|-------|----------------|------------------------|
| **PHI on-chain** | FHE handles only (`euint*` / `ebool`); no plaintext vitals in contract storage | Design intent OK for privacy-by-design matching |
| **PHI off-chain** (IPFS, AI service, indexer, relayer logs) | Encrypted/hybrid (AES-256-GCM + FHE-wrapped keys); AI redacts before LLM; services default to no-retention | **BAA** with cloud/LLM vendors; documented retention & deletion; access logging; DPA where applicable |
| **Trial enrollment** | Demo protocol on Sepolia; sponsor-created trials via allowlist | **IRB** approval; informed consent forms; protocol versioning; adverse-event reporting per jurisdiction |
| **Sponsor identity** | `SponsorRegistry` on-chain allowlist (`isVerifiedSponsor`) | **KYC/AML** vendor integration; contractual sponsor obligations; sanctions screening |
| **Audit trail** | `DataAccessLog` on-chain hashes + subgraph/indexer mirrors | **21 CFR Part 11** mapping for US sponsors (electronic records, signatures, audit trails, validation) |
| **GDPR** (EU patients/sponsors) | Not formally documented until this file | **DPA** with processors; lawful basis (likely consent + legitimate interest analysis); data minimization; right to erasure for off-chain copies |
| **CCPA / state privacy** (US) | Not assessed | Consumer notice; opt-out where applicable for non-HIPAA identifiers |
| **Clinical validity** | Engineering demo | Protocol scientific review; principal investigator oversight; monitoring |

## PHI handling boundaries

### On-chain (lower residual risk)

- Patient vitals and trial criteria are encrypted before submission.
- Eligibility results are `ebool` / `euint*` handles until explicitly decrypted under FHE ACL.
- Noir public inputs bind identity and handles — they do **not** prove fhEVM homomorphic correctness (see [SECURITY.md](../SECURITY.md)).

### Off-chain (higher residual risk — requires production controls)

| Surface | Data | Current control | Production gap |
|---------|------|-----------------|----------------|
| **IPFS / Pinata** | AES-encrypted document bodies | Client-side encryption; CID on-chain; **P7** trusted indexer unpin + on-chain attestation after `rotateDocument` | Key custody policy; BAA with Pinata; monitor `LegacyCidUnpinAttested` |
| **AI service** | Protocol PDFs / text | PHI redaction before LLM; **no-retention** policy (in-memory only) | Enterprise LLM agreement; zero-data-retention API tier; SOC 2 vendor review |
| **Indexer** | Trial metadata, nullifiers, application status | No plaintext PHI by design; **Bearer auth** on data routes when `INDEXER_API_SECRET` set | VPC deployment; encrypted Mongo/Redis at rest |
| **Relayer** | Staging/finalize metadata | Re-decrypt eligibility bit as permitRecipient; redaction discipline | Published logging policy; multi-relayer (P3) |
| **Frontend / Privy** | Wallet linkage | Optional Semaphore anonymous path | Privacy policy; minimize wallet↔patient linkage in production |

## US-specific notes

### HIPAA

MedVault is **not HIPAA-compliant today**. A production deployment that stores or transmits PHI on behalf of covered entities would need:

- Business Associate Agreements (BAAs) with infrastructure, IPFS, LLM, and hosting vendors
- Risk analysis and administrative/physical/technical safeguards (45 CFR §164.308–316)
- Breach notification procedures
- Minimum necessary access controls for sponsor document decrypt

The on-chain FHE layer reduces **validator/indexer** PHI exposure but does **not** remove HIPAA obligations for off-chain document and AI flows.

### 21 CFR Part 11 (electronic records — US sponsors)

For sponsors subject to FDA electronic records rules, map MedVault components as follows:

| Part 11 theme | MedVault component | Gap |
|---------------|-------------------|-----|
| Audit trail | `DataAccessLog`, subgraph, indexer | Needs validated export, immutable retention policy, time sync |
| Electronic signatures | EIP-712 consent / withdraw signatures | Needs signature meaning documented in protocol; identity binding |
| System validation | Smart contracts + off-chain services | Formal IQ/OQ/PQ not performed |
| Record retention | On-chain permanent; off-chain variable | Retention schedule not defined |

See [docs/EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md) for planned third-party security review scope.

## EU / UK (GDPR)

| Principle | MedVault approach today | Production action |
|-----------|------------------------|-------------------|
| Lawfulness | Demo — no production lawful basis asserted | Document basis per trial (consent Art. 6(1)(a) + Art. 9(2)(a) for health data) |
| Purpose limitation | Matching + incentive demo | Limit secondary use of protocol PDFs and audit logs |
| Data minimization | FHE handles on-chain; redacted AI input | Avoid collecting fields not needed for criteria |
| Storage limitation | AI no-retention; IPFS until unpin | Define TTLs; honor erasure requests for off-chain copies |
| Integrity & confidentiality | Encryption + access control | Key rotation, indexer auth, sponsor KYC |
| Accountability | This document + [SECURITY.md](../SECURITY.md) | DPA with subprocessors; ROPA |

## Sponsor KYC and trial governance

Today: `SponsorRegistry` owner-gated allowlist (`verifySponsor` / `emergencyRemoveSponsor`).

Production: integrate a KYC/AML vendor; store attestation hashes on-chain; contractual trial master file; medical monitor role for serious adverse events (outside MedVault contracts today).

## Informed consent and IRB

MedVault demo flows use encrypted consent gates (`ConsentManager`, `EncryptedConsentGate`) for **technical** consent state — not a substitute for:

- IRB-approved protocol and consent form
- Witnessed consent where required
- Pediatric assent / guardian consent
- Re-consent on material protocol amendments

## Operational controls (implemented / documented)

| Control | Location |
|---------|----------|
| AI no-retention policy | [ai-service/README.md](../ai-service/README.md), `ai-service/src/retention.ts` |
| Indexer route authentication | `INDEXER_API_SECRET` — [indexer/README.md](../indexer/README.md) |
| IPFS / AES key custody | [HYBRID_STORAGE.md](./HYBRID_STORAGE.md#aes-key-custody-and-rotation) |
| Threat model | [internal-docs/threat-model.md](../internal-docs/threat-model.md) |
| External security audit scope | [EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md) |

## Roadmap to production viability

1. **Now (demo):** Honest disclosure; off-chain ops controls (P4.2); regulatory posture doc (this file).
2. **Done (P2):** Ciphertext-gated payouts — reduces forgery risk for incentives. Phase 5 differential evidence recorded in [formal-verification/certora-halmos-results.md](./formal-verification/certora-halmos-results.md).
3. **Before pilot:** External security audit ([EXTERNAL_AUDIT_SUMMARY.md](./EXTERNAL_AUDIT_SUMMARY.md)); IRB package; BAAs; KYC integration.
4. **Institutional pilot:** Multi-relayer / threshold decrypt (P3.3); Part 11 validation plan; GDPR DPA bundle.

## Related documents

- [SECURITY.md](../SECURITY.md) — technical threat mitigations
- [README.md#limitations--trust-model](../README.md#limitations--trust-model) — integrator-facing summary
- [HYBRID_STORAGE.md](./HYBRID_STORAGE.md) — hybrid document architecture
- [EXTERNAL_AUDIT_SCOPE.md](./EXTERNAL_AUDIT_SCOPE.md) — third-party audit RFP scope
- [EXTERNAL_AUDIT_SUMMARY.md](./EXTERNAL_AUDIT_SUMMARY.md) — public audit status
