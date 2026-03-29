# MedVault — Private, FHE-Powered Clinical Trials

[![Fhenix](https://img.shields.io/badge/Powered%20By-Fhenix-teal?style=for-the-badge)](https://fhenix.io)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-blue?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-100%20Passing-emerald?style=for-the-badge)](docs/TESTING_GUIDE.md)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge)](https://vercel.com)

**MedVault** is a decentralized clinical trial platform leveraging **Fully Homomorphic Encryption (FHE)** to bridge the gap between medical privacy and decentralized research. Built on **Fhenix (CoFHE)**, it allows patients to match with life-saving trials while keeping their medical data mathematically encrypted at all times on **Arbitrum Sepolia**.

---

## 🏗️ 1. Architecture Overview

MedVault uses a multi-layered approach to synchronize browser-level encryption with on-chain computation. The system ensures that patient data never exists in plaintext outside of the user's localized memory.

```mermaid
graph TD
    subgraph "Frontend Layer (React + Vite)"
        A[MedVault DApp] --> B[Fhenix CoFHE SDK]
        B -->|FHE Key Gen + Permits| C[EIP-712 Signing]
        C -->|Encrypted Payloads| D[RPC Provider]
    end
    
    subgraph "Execution Layer (Fhenix CoFHE)"
        D --> E[EligibilityEngine.sol]
        E -->|Homomorphic Compute| F[ConfidentialETH.sol]
        E -->|Manage Trials| H[SponsorRegistry.sol]
        F -->|Yield Generation| G[StakingManager.sol]
    end
    
    subgraph "DeFi & Indexing"
        G -->|Cross-Chain RPC| I[Aave V3 Protocol]
        E .-x|Events emitted| J[The Graph Node]
        J -->|GraphQL API| A
    end
    
    subgraph "Automation & Oracles"
        K[Chainlink Automation] -->|Trigger PerformUpkeep| H
    end

    classDef default fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f1f5f9;
    classDef fhenix fill:#064e3b,stroke:#059669,stroke-width:2px,color:#ecfdf5;
    classDef link fill:#1d4ed8,stroke:#2563eb,stroke-width:2px,color:#eff6ff;
    class E,F,G,H fhenix
    class K link
```

---

## 📜 2. Smart Contract Ecosystem

MedVault's core logic is distributed across a modular set of FHE-aware smart contracts. Each contract is designed to handle encrypted types (`euint8`, `euint16`, `ebool`) securely using the Fhenix `FHE.sol` library.

```mermaid
erDiagram
    SponsorRegistry ||--o{ TrialMilestoneManager : creates
    TrialMilestoneManager ||--o{ EligibilityEngine : defines_criteria
    EligibilityEngine }o--|| ConfidentialETH : secures_deposits
    ConfidentialETH ||--o{ StakingManager : routes_liquidity
    DataAccessLog }|--|| SponsorRegistry : tracks_access
    
    SponsorRegistry {
        address sponsor
        bool isVerified
        string organizationName
    }
    
    EligibilityEngine {
        euint8 encryptedAge
        euint16 encryptedHbLevel
        ebool trialMatchStatus
    }
```

| Contract | Purpose | Key Feature |
|-----------|---------|-------------|
| **`EligibilityEngine.sol`** | Core Matching Logic | Homomorphic matching on `euint8`, `euint16`, and `ebool`. |
| **`ConfidentialETH.sol`** | Privacy Wrapper | 1e12 scaled `euint64` encrypted balances to prevent tracking. |
| **`StakingManager.sol`** | De-Fi Integration | Native Aave V3 yield generation on private assets. |
| **`PatientRegistry.sol`** | Patient Identity | Manages encrypted health profiles via Fhenix encrypted types. |
| **`SponsorRegistry.sol`** | Sponsor Identity | KYC & verification gates using off-chain encryption hashes. |
| **`SponsorIncentiveVault.sol`** | Reward Governance | Escrows and locks reward pools for phased trial distribution. |
| **`TrialManager.sol`** | Trial Lifecycle | Handles trial creation and public metadata for discovery. |
| **`TrialMilestoneManager.sol`**| Phased Delivery | Automated milestone-based progress tracking. |
| **`MedVaultAutomation.sol`** | Chainlink Upkeeps | Automates trial checkUpkeep and performUpkeep on Arbitrum Sepolia. |
| **`ConsentManager.sol`** | Selective Decryption | Manages patient approvals for FHE visibility. |
| **`DataAccessLog.sol`** | Compliance Audit | Immutable, anonymized HIPAA/GDPR access tracking. |

---

## 🔐 3. Fhenix CoFHE Encryption / Decryption Lifecycle

Fully Homomorphic Encryption allows the blockchain to do math on numbers it cannot see. MedVault utilizes the **@cofhe/sdk** and **FHE.sol**.

```mermaid
sequenceDiagram
    participant P as Patient (Browser)
    participant RPC as Arbitrum Sepolia RPC
    participant SC as Smart Contract (Fhenix)
    participant CO as Fhenix Coprocessor
    
    Note over P: Patient enters: Age=35
    P->>P: sdk.encrypt8(35) -> Ciphertext
    P->>RPC: tx: applyForTrial(Ciphertext)
    RPC->>SC: execute transaction
    Note over SC: Contract loads Sponsor's Req: MinAge=18
    SC->>CO: FHE.gt(Ciphertext, 18)
    CO-->>SC: Result Ciphertext (ebool)
    Note over SC: Access Control (FHE.allow)
    P->>SC: getEncryptedResult()
    SC-->>P: Result Ciphertext
    P->>P: sdk.decryptForView(Ciphertext)
    Note over P: Decrypted boolean: TRUE
    Note over SC,P: The network knows they matched, but NOT their age
```

### The Cryptographic Guarantee:
1. **Client-side Encryption:** `@cofhe/sdk` handles secure encryption before data leaves the browser.
2. **On-Chain Computation:** The smart contract uses `FHE.add()`, `FHE.gt()`, etc., to manipulate ciphertexts via the Fhenix coprocessor.
3. **Access Control (Permits):** Only the intended recipient (e.g., the patient) can re-encrypt and view the final result using signed **Permits**.

---

## 💰 4. Private Staking & Yield

MedVault integrates with **Aave V3** to allow participants to earn yield on their confidential assets while they are locked in trials.

```mermaid
stateDiagram-v2
    direction LR
    classDef secret fill:#4c1d95,stroke:#8b5cf6,color:white;
    classDef public fill:#1e3a8a,stroke:#3b82f6,color:white;
    
    state "Public Wallet (ETH)" as Wallet ::: public
    state "ConfidentialETH (cETH)" as CETH ::: secret
    state "StakingManager" as SM ::: secret
    state "Aave V3 (aWETH)" as Aave ::: public
    
    Wallet --> CETH: 1. Deposit (Shielding)
    CETH --> SM: 2. Lock for Trial
    SM --> Aave: 3. Supply Public Liquidity
    Aave --> SM: 4. Accrue Yield
    SM --> CETH: 5. Unstake + Yield (Encrypted State)
    CETH --> Wallet: 6. Withdraw (Unshielding)
```

1. **Shielding:** Users deposit native ETH into `ConfidentialETH`, receiving an encrypted (`euint64`) balance.
2. **Staking:** The user commits encrypted funds to a trial. The `StakingManager` tracks the staked value privately.
3. **Yield Generation:** The `StakingManager` pools the underlying native ETH and supplies it to Aave V3 on Arbitrum.
4. **Unshielding:** Upon trial completion, the encrypted balance + yield is returned, and the user can unshield it back to their wallet.

---

## 🧬 5. Engine Trial Matching Workflow

The core value proposition of MedVault is the ability to evaluate a patient against a trial's criteria invisibly.

```mermaid
graph LR
    subgraph "Patient Profile (Encrypted)"
        A[Encrypted Age]
        B[Encrypted Gender]
        C[Encrypted Condition Status]
    end
    
    subgraph "FHE Evaluation Gates"
        A -->|FHE.gt| D{Age within Range?}
        B -->|FHE.eq| E{Gender Match?}
        C -->|FHE.eq| F{Condition Check?}
        
        D -->|FHE.and| G((Global AND Gate))
        E -->|FHE.and| G
        F -->|FHE.and| G
    end
    
    subgraph "Result"
        G --> H[Encrypted Result]
        H -->|Permit Reveal| I[Reveal Match]
    end
    
    classDef secret fill:#064e3b,stroke:#059669,stroke-width:2px,color:#ecfdf5;
    class A,B,C,D,E,F,G,H secret
```

---

## 🧰 6. Tech Stack

MedVault is built using a modern, fully decentralized Web3 stack tailored for Fhenix CoFHE.

```mermaid
graph TD
    classDef default fill:#1e293b,stroke:#334155,stroke-width:1px,color:#f8fafc
    classDef frontend fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#f8fafc
    classDef web3 fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f8fafc
    classDef contracts fill:#701a75,stroke:#d946ef,stroke-width:2px,color:#f8fafc
    classDef infra fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#f8fafc
 
    subgraph "Frontend Layer"
        R[React 19]:::frontend
        V[Vite]:::frontend
        T[Tailwind CSS]:::frontend
        F[Framer Motion]:::frontend
    end

    subgraph "Web3 & FHE"
        Z["@cofhe/sdk"]:::web3
        W["WAGMI / Viem"]:::web3
        E["Ethers.js v6"]:::web3
    end

    subgraph "Smart Contracts"
        S[Solidity 0.8.27]:::contracts
        TL[FHE.sol Library]:::contracts
        H[Hardhat]:::contracts
    end

    subgraph "Data & Infrastructure"
        TG[The Graph]:::infra
        A[Apollo]:::infra
        VH[Vercel]:::infra
        CA[Chainlink Automation]:::infra
    end
```

*   **Frontend UI:** React 19, Vite, Tailwind CSS, Lucide Icons, Framer Motion.
*   **Cryptography:** `@cofhe/sdk` for client-side encryption and permit management.
*   **Blockchain Dev:** `Hardhat` with `@cofhe/hardhat-plugin` for FHE-aware development.
*   **Smart Contracts:** Solidity `0.8.27` utilizing the `@fhenixprotocol/cofhe-contracts/FHE.sol` library.
*   **Data Indexing:** The Graph paired with Apollo Client for rapid UI rendering.
*   **Tooling:** TypeChain, Eslint, Prettier.

---

## ✅ Verification & Assurance

The system is verified by a **comprehensive stress test suite** that validates every edge case in the Fhenix CoFHE environment.

*   **Status**: All Tests Passing on Arbitrum Sepolia.
*   **Coverage**: Eligibility Engine, Staking Consistency, Reward Distribution, and Access Control (ACL).

```bash
# Run the verification suite
npx hardhat test test/comprehensive_medvault.test.js --network arbitrumSepolia
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20+)
*   Metamask with **Arbitrum Sepolia** Testnet configured.

### Local Installation
1.  **Clone & Install**:
    ```bash
    git clone https://github.com/your-repo/medvault.git
    cd medvault
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run dev
    ```

### Vercel Deployment
MedVault is configured with `vercel.json` to handle the security headers required for FHE SDK execution.

---

## 📄 Documentation
For deep technical dives, check out the following guides:
*   [Testing & Verification Guide](docs/TESTING_GUIDE.md)
*   [New Contract Development Guide](docs/NEW_CONTRACTS_GUIDE.md)
*   [Upgrade Roadmap V1.1](docs/UPGRADE_V1.1_PHASED_PAYOUTS_AND_AUDIT.md)

---

<div align="center">
Built with ❤️ for the future of Medical Privacy on Fhenix.
</div>
