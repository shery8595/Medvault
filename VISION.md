# MedVault: Confidential Clinical Research on FHE

**Private clinical-trial matching over encrypted patient vitals and encrypted sponsor trial criteria on Ethereum Sepolia.**

MedVault is the **reference fhEVM architecture for encrypted clinical-trial matching**, with a complete patient-to-reward workflow on Sepolia. Homomorphic eligibility is the core; Semaphore anonymity and Noir identity/policy attestation extend the matching workflow — see [docs/TRUST_ARCHITECTURE.md](docs/TRUST_ARCHITECTURE.md).

MedVault is privacy-centric clinical trial infrastructure on **Zama (Zama FHE)**. Using **Fully Homomorphic Encryption (FHE)**, it bridges individual medical sovereignty and collective research—patient records stay mathematically private during matching, scoring, and incentive settlement.

| | |
|:--|:--|
| **Live** | https://med-vault.xyz |
| **Docs** | https://med-vault.xyz/docs |
| **Lightpaper** | [docs/LIGHTPAPER.md](docs/LIGHTPAPER.md) |
| **Pitch deck** | [docs/PITCH_DECK.md](docs/PITCH_DECK.md) |
| **FHE audit map** | [docs/FHE_AUDIT_README.md](docs/FHE_AUDIT_README.md) |
| **Changelog** | https://med-vault.xyz/docs/changelog |
| **Repo** | https://github.com/shery8595/Med-Vault |
| **Demo video** | https://youtu.be/7VrcpRRugWc |
| **Terminal demo** | `npm run demo:fhe` |

**Stack** — Core: Zama FHE · Ethereum Sepolia. Extensions: Semaphore · Noir/UltraHonk · The Graph · Chainlink CRE · Hardhat

**Verification** — **491** default Hardhat cases (**~2,028** registered incl. fuzz; see `src/lib/docsStats.ts`): FHE eligibility (encrypted patient + **encrypted sponsor criteria**), aggregates, batch matching, attestation binding, trust-gap payout gating, Phase 5 differential properties, Semaphore anonymity, **multi-relayer adversarial bounds (REL-*)**, relayer registration, incentives, end-to-end patient workflows.

---

## Mission & vision

Clinical research faces a **Privacy–Data Paradox**: trials need rich health signals, but exposing PHI erodes trust and blocks enrollment.

MedVault ensures patient health data is **not decrypted for on-chain matching**—`EligibilityEngine` compares encrypted profiles against sponsor criteria homomorphically. Production sponsors use **`createTrialWithEncryptedCriteria`** (bounds hidden on-chain); legacy **`createTrial`** (public bounds) remains for tests and SDK/MCP integrators. Patients decrypt outcomes locally; auditors get tamper-proof access logs without vitals on-chain.

---

## Technological core (Zama fhEVM)

| Capability | Implementation |
|:-----------|:----------------|
| Homomorphic matching | `EligibilityEngine` — `FHE.ge` / `FHE.le` / `FHE.select` on encrypted patient **and** sponsor criteria |
| Encrypted sponsor criteria | `TrialManager.createTrialWithEncryptedCriteria` — bounds hidden on-chain (**recommended**) |
| Encrypted aggregates | `EncryptedScoreLeaderboard.addToAggregate` — homomorphic sum/count |
| Batch matching | `checkEligibilityBatch` — multi-trial FHE in one call |
| Encrypted storage | `MedVaultRegistry` + `AnonymousPatientRegistry` — ciphertext handles only |
| Patient decrypt | Zama FHE permits + `FHE.allow` ACL — validators never see plaintext PHI |
| Anonymous identity | Semaphore commitments decouple wallet from application |
| ZK attestation | Noir identity/policy attestation + `HonkVerifier` bound to Zama FHE stage handles |

---

## How it works

### Patient vaulting

Vitals encrypt in-browser via `@zama-fhe/sdk`; only ciphertexts and proofs land on-chain.

### Stealth eligibility

Sponsors publish trial criteria via **`createTrialWithEncryptedCriteria`** (recommended; bounds as FHE handles). `EligibilityEngine` scores encrypted profiles homomorphically—aggregate signals only. Optional gasless relayer finalize for anonymous applicants.

### Confidential DeFi · Compliance

`ConfidentialETH` + `StakingManager` (Aave V3) · `SponsorIncentiveVault` + `TrialMilestoneManager` · `MedVaultAutomation` + **Chainlink CRE** at `endTime`.

| Actor | Capabilities |
|:------|:-------------|
| **Patients** | Encrypted profiles · anonymous apply · consent · local decrypt |
| **Sponsors** | Trials · incentive pools · aggregate matches — never raw PHI |

---

## Five waves — build timeline (in order)

| # | Phase | Status | Shipped |
|:-:|:------|:------:|:--------|
| **1** | Patient UI & Zama SDK client | Done | React dApp · medical vault · `@zama-fhe/sdk` |
| **2** | Core FHE contracts | Done | `EligibilityEngine` · `MedVaultRegistry` · `TrialManager` |
| **3** | Sponsor portal & incentives | Done | `SponsorRegistry` · dashboards · vault · milestones |
| **4** | Semaphore, Noir & consent | Done | Anonymous apply · identity/policy attestation · relayer |

---

## Limitations & Trust Model

| Layer | Guarantees | Does not guarantee |
|-------|------------|-------------------|
| **FHE** | Homomorphic eligibility on ciphertext | Off-chain PHI, wallet linkage, L1 ETH visibility |
| **Noir** | Identity and policy attestation | fhEVM correctness; seal ≠ eligibility proof |
| **Relayer** | Gasless relay; default patient-decrypt (browser); optional P0.2 relayer-assisted (not default; learns eligibility bit) | Payout integrity via `FHE.select` (P2 shipped); relayer cannot steal vault funds, cannot forge eligibility, can only censor or delay |
| **Compliance** | Privacy-by-design matching | **Not HIPAA-compliant today** |

---
| **5** | Testing, ops & production | Done | 491 tests · dual relayer · subgraph · live testnet |
| **Next** | Mainnet pilot | Planned | External audit · sponsor KYC |

---

<p align="center">
  <strong>Join the evolution of healthcare</strong><br><br>
  Built with Zama FHE · Ethereum Sepolia · Chainlink CRE
</p>
