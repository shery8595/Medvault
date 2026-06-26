# 🧬 MedVault: Confidential Clinical Research on FHE

**MedVault** is privacy-centric clinical trial infrastructure on **Zama (Zama FHE)**. Using **Fully Homomorphic Encryption (FHE)**, it bridges individual medical sovereignty and collective research—patient records stay mathematically private during matching, scoring, and incentive settlement.

| | |
|:--|:--|
| 🌐 **Live** | https://med-vault.xyz |
| 📚 **Docs** | https://med-vault.xyz/docs |
| 📄 **Changelog** | https://med-vault.xyz/docs/changelog |
| 📦 **Repo** | https://github.com/shery8595/Med-Vault |
| 🎥 **Demo** | https://www.youtube.com/watch?v=1wR01KflBOM&t=88s |

**⚙️ Stack** — Zama FHE · Semaphore · Noir/UltraHonk · Ethereum Sepolia · The Graph · Chainlink Automation · Hardhat

**🧪 Verification** — 265 Hardhat tests: FHE eligibility (encrypted patient + sponsor criteria), aggregates, batch matching, attestation binding, Semaphore anonymity, relayer registration, incentives, end-to-end patient workflows.

---

## 🏗️ Mission & vision

Clinical research faces a **Privacy–Data Paradox** 🔒: trials need rich health signals, but exposing PHI erodes trust and blocks enrollment.

MedVault ensures patient health data is **not decrypted for on-chain matching**—`EligibilityEngine` compares encrypted profiles against **public** trial bounds stored in `TrialManager`, patients decrypt outcomes locally, and auditors get tamper-proof access logs without vitals on-chain.

---

## 🔐 Technological core (Zama fhEVM)

| Capability | Implementation |
|:-----------|:----------------|
| 🧮 Homomorphic matching | `EligibilityEngine` — `FHE.ge` / `FHE.le` / `FHE.select` on encrypted patient **and** sponsor criteria |
| 🔒 Encrypted sponsor criteria | `TrialManager.createTrialWithEncryptedCriteria` — bounds hidden on-chain |
| 📊 Encrypted aggregates | `EncryptedScoreLeaderboard.addToAggregate` — homomorphic sum/count |
| ⚡ Batch matching | `checkEligibilityBatch` — multi-trial FHE in one call |
| 🗄️ Encrypted storage | `MedVaultRegistry` + `AnonymousPatientRegistry` — ciphertext handles only |
| 🔑 Patient decrypt | Zama FHE permits + `FHE.allow` ACL — validators never see plaintext PHI |
| 🎭 Anonymous identity | Semaphore commitments decouple wallet from application |
| ✅ ZK attestation | Noir compliance seal + `HonkVerifier` bound to Zama FHE stage handles |

---

## ⚙️ How it works

### 🩺 Patient vaulting

Vitals encrypt in-browser via `@zama-fhe/sdk`; only ciphertexts and proofs land on-chain.

### 🔍 Stealth eligibility

Sponsors publish **public** trial bounds in `TrialManager`. `EligibilityEngine` scores encrypted profiles homomorphically—aggregate signals only. Optional gasless relayer finalize for anonymous applicants.

### 💰 Confidential DeFi · ⚖️ Compliance

`ConfidentialETH` + `StakingManager` (Aave V3) · `SponsorIncentiveVault` + `TrialMilestoneManager` · `MedVaultAutomation` + **Chainlink Automation** ⛓️ at `endTime`. Compliance-oriented audit design (`DataAccessLog`); not a claim of HIPAA/GDPR certification.

| Actor | Capabilities |
|:------|:-------------|
| 🧑‍⚕️ **Patients** | Encrypted profiles · anonymous apply · consent · local decrypt |
| 🏛️ **Sponsors** | Trials · incentive pools · aggregate matches — never raw PHI |

---

## 🌊 Five waves — build timeline (in order)

Waves follow **how MedVault was built**: patient UI first → FHE contracts → sponsor portal → Semaphore/Noir → testing & launch on [med-vault.xyz](https://med-vault.xyz).

| # | Phase | Status | Shipped |
|:-:|:------|:------:|:--------|
| 🌊 **1** | Patient UI & Zama SDK client | ✅ | React dApp · medical vault · `@zama-fhe/sdk` · find-trials · results · Privy |
| 🌊 **2** | Core FHE contracts | ✅ | `EligibilityEngine` · `MedVaultRegistry` · `TrialManager` · Sepolia deploy |
| 🌊 **3** | Sponsor portal & incentives | ✅ | `SponsorRegistry` · dashboards · `SponsorIncentiveVault` · `TrialMilestoneManager` |
| 🌊 **4** | Semaphore, Noir attestation & consent | ✅ | Anonymous apply · compliance seal · consent gates · gasless relayer |
| 🌊 **5** | Testing, ops & production | ✅ | 265 tests · subgraph · Chainlink · `DataAccessLog` · Aave staking · FHIR/Reclaim · analytics · live testnet |
| 🔭 | **Next** | 📋 | Confidential training · MPC · cross-chain hub · DAO |

### Wave highlights (chronological)

**🌊 Wave 1 — Patient UI** — React/Vite frontend first: vault forms, trial discovery, local decrypt UX wired to `@zama-fhe/sdk` before the full on-chain surface was finished.

**🌊 Wave 2 — Core contracts** — `EligibilityEngine` FHE matching, `MedVaultRegistry` registration, and `TrialManager` (public trial bounds) deployed to Ethereum Sepolia.

**🌊 Wave 3 — Sponsor side** — Sponsor portal: verified onboarding, trial create/fund flows, incentive escrows, milestones, aggregate match views (no PHI).

**🌊 Wave 4 — Semaphore & Noir attestation** — Privacy layer: Semaphore nullifiers, `EncryptedConsentGate`, Noir compliance seal (`eligibility_proof` + `HonkVerifier`) bound to Zama FHE stages, optional relayer finalize.

**🌊 Wave 5 — Testing & launch** — 265 Hardhat suites (unit → integration → E2E), encrypted criteria + aggregate + batch tests, FHE-bound attestation circuit, relayer registration privacy, production ship.

---

<p align="center">
  <strong>Join the evolution of healthcare</strong> 🌍<br><br>
  Built with ❤️ on <strong>Zama</strong> · <strong>Ethereum Sepolia</strong> · <strong>Chainlink Automation</strong>
</p>
