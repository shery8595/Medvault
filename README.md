# MedVault — Private, FHE-Powered Clinical Trials

[![FHEVM](https://img.shields.io/badge/Powered%20By-FHEVM-teal?style=for-the-badge)](https://zama.ai/fhevm)
[![License](https://img.shields.io/badge/License-BSD--3--Clause-blue?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-100%20Passing-emerald?style=for-the-badge)](docs/TESTING_GUIDE.md)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge)](https://vercel.com)

**MedVault** is the first decentralized clinical trial platform leveraging **Fully Homomorphic Encryption (FHE)** to bridge the gap between medical privacy and decentralized research. Built on the Zama fhEVM, it allows patients to match with life-saving trials while keeping their medical data mathematically encrypted at all times.

</div>

---

## 🏗️ 1. Architecture Overview

MedVault uses a multi-layered approach to synchronize browser-level encryption with on-chain computation. The system ensures that patient data never exists in plaintext outside of the user's localized memory.

```mermaid
graph TD
    subgraph "Frontend Layer (React + Vite)"
        A[MedVault DApp] --> B[fhevmjs Client]
        B -->|AES-256 + FHE Key Gen| C[EIP-712 Signing]
        C -->|Encrypted Payloads| D[RPC Provider]
    end
    
    subgraph "Execution Layer (Zama FHEVM)"
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

    classDef default fill:#0f172a,stroke:#334155,stroke-width:1px,color:#f1f5f9;
    classDef zama fill:#064e3b,stroke:#059669,stroke-width:2px,color:#ecfdf5;
    class E,F,G,H zama
```

---

## 📜 2. Smart Contract Ecosystem

MedVault's core logic is distributed across a modular set of FHE-aware smart contracts. Each contract is designed to handle encrypted types (`euint32`, `ebool`) securely.

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
        euint32 encryptedAge
        euint32 encryptedBloodPressure
        ebool trialMatchStatus
    }
```

| Contract | Purpose | Key Feature |
|-----------|---------|-------------|
| **`EligibilityEngine.sol`** | Core Matching Logic | Homomorphic (CMUX) boundary checks on `euint32`. |
| **`ConfidentialETH.sol`** | Privacy Wrapper | 1e12 scaled `euint32` encrypted balances to prevent tracking. |
| **`StakingManager.sol`** | De-Fi Integration | Native Aave V3 yield generation on private assets. |
| **`SponsorRegistry.sol`** | Identity & Access | Strict KYC gates before trials can be published. |
| **`DataAccessLog.sol`** | Compliance Audit | Immutable, anonymized HIPAA/GDPR access tracking. |
| **`TrialMilestoneManager`** | Lifecycle Management | Automated milestone-based phased payouts. |

---

## 🔐 3. Zama FHEVM Encryption / Decryption Lifecycle

Fully Homomorphic Encryption allows the blockchain to do math on numbers it cannot see. Here is how MedVault utilizes Zama's `fhevmjs` and `TFHE.sol`.

```mermaid
sequenceDiagram
    participant P as Patient (Browser)
    participant RPC as Zama RPC
    participant SC as Smart Contract (FHEVM)
    participant KMS as Zama KMS (Threshold)
    
    Note over P: Patient enters: Age=35
    P->>P: fhevmjs.encrypt(35) -> 0xabc...
    P->>RPC: tx: applyForTrial(0xabc...)
    RPC->>SC: execute transaction
    Note over SC: Contract loads Sponsor's Encrypted Req: MinAge=18
    SC->>SC: TFHE.ge(0xabc..., Encrypted_18)
    Note over SC: Result is a new ciphertext (ebool)
    SC->>KMS: Request Decryption of result
    KMS-->>SC: Decrypted boolean: TRUE
    SC->>SC: Emit MatchEvent(PatientAddress)
    Note over SC,P: The network knows they matched, but NOT their age
```

### The Cryptographic Guarantee:
1. **Client-side Encryption:** `fhevmjs` generates a single-use public key derived from the network.
2. **On-Chain Computation:** The smart contract uses `TFHE.add()`, `TFHE.ge()`, etc., to manipulate the ciphertexts.
3. **Threshold Decryption (ACL):** Only the final binary result (e.g., "Matched? Yes/No") is allowed to be decrypted by the ACL. The raw inputs remain encrypted forever.

---

## 💰 4. Private Staking & Yield

MedVault integrates with **Aave V3** to allow sponsors and patients to earn yield on their confidential assets while they are locked in trials.

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

1. **Shielding:** Users deposit native ETH into `ConfidentialETH`, receiving an encrypted (`euint32`) balance.
2. **Staking:** The user commits encrypted funds to a trial. The `StakingManager` deducts the encrypted balance.
3. **Yield Generation:** The `StakingManager` pools the actual underlying native ETH and supplies it to Aave V3.
4. **Unshielding:** When the trial finishes, the encrypted balance + yield is returned, and the user can unshield it back to their public wallet.

---

## 🧬 5. Engine Trial Matching Workflow

The core value proposition of MedVault is the ability to evaluate a patient against a trial's criteria invisibly.

```mermaid
graph LR
    subgraph "Patient Profile (Encrypted)"
        A[Encrypted Age]
        B[Encrypted BloodType]
        C[Encrypted Condition Status]
    end
    
    subgraph "TFHE Evaluation Gates"
        A -->|TFHE.ge| D{Age >= MinAge?}
        B -->|TFHE.eq| E{BloodType == Req?}
        C -->|TFHE.eq| F{Condition == True?}
        
        D -->|TFHE.and| G((Global AND Gate))
        E -->|TFHE.and| G
        F -->|TFHE.and| G
    end
    
    subgraph "Result"
        G --> H[Encrypted Boolean]
        H -->|Decryption Request| I[Match / Reject]
    end
    
    classDef secret fill:#064e3b,stroke:#059669,stroke-width:2px,color:#ecfdf5;
    class A,B,C,D,E,F,G,H secret
```

---

## 🧰 6. Tech Stack

MedVault is built using a modern, fully decentralized Web3 stack tailored for Homomorphic Encryption.

```mermaid
graph TD
    classDef default fill:#1e293b,stroke:#334155,stroke-width:1px,color:#f8fafc
    classDef frontend fill:#312e81,stroke:#6366f1,stroke-width:2px,color:#f8fafc
    classDef web3 fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f8fafc
    classDef contracts fill:#701a75,stroke:#d946ef,stroke-width:2px,color:#f8fafc
    classDef infra fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#f8fafc

    subgraph "Frontend Layer"
        R[React 18]:::frontend
        V[Vite]:::frontend
        T[Tailwind CSS]:::frontend
        F[Framer Motion]:::frontend
    end

    subgraph "Web3 & FHE"
        Z[fhevmjs]:::web3
        W[WAGMI / Viem]:::web3
        E[Ethers.js]:::web3
    end

    subgraph "Smart Contracts"
        S[Solidity 0.8.24]:::contracts
        TL[Zama TFHE Library]:::contracts
        H[Hardhat]:::contracts
    end

    subgraph "Data & Infrastructure"
        TG[The Graph]:::infra
        A[Apollo]:::infra
        VH[Vercel]:::infra
    end
```

*   **Frontend UI:** React 18, Vite, Tailwind CSS, Shadcn (Lucide Icons), Framer Motion for highly optimized animations.
*   **Cryptography:** `@zama-ai/fhevmjs` for client-side encryption and EIP-712 credential signing.
*   **Blockchain Dev:** `Hardhat` with `@fhevm/hardhat-plugin` for testing mocked FHE operations locally.
*   **Smart Contracts:** Solidity `0.8.24` utilizing the core `TFHE.sol` library.
*   **Data Indexing:** The Graph (AssemblyScript mappings) paired with Apollo Client for rapid UI rendering without heavy RPC polling.
*   **Tooling:** TypeChain, Eslint, Prettier, PostCSS.

---

## ✅ Verification & Assurance

We maintain a rigorous quality standard. The system is verified by a **100-case comprehensive stress test suite** that validates every edge case in the FHE environment.

*   **Success Rate**: 100/100 Tests Passing.
*   **Coverage**: Eligibility Engine, Staking Consistency, Reward Distribution, and Access Control.
*   **Environment**: Standardized for local Hardhat and Zama Mock FHE.

```bash
# Run the verification suite
npx hardhat test test/comprehensive_medvault.test.js --network hardhat
```

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v20+)
*   Metamask with Zama Sepolia Testnet configured.

### Local Installation
1.  **Clone & Install**:
    ```bash
    git clone https://github.com/your-repo/medvault.git
    cd medvault
    npm install
    ```
2.  **Environment Setup**: Create a `.env.local` file:
    ```bash
    GEMINI_API_KEY=your_key_here
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

### Vercel Deployment
MedVault is pre-configured with a `vercel.json` to handle the critical security headers (**COOP/COEP**) required for FHEVM WASM execution. Just import the repo into Vercel and it works out of the box.

---

## 📄 Documentation
For deep technical dives, check out our internal documentation portal or the following guides:
*   [Testing & Verification Guide](docs/TESTING_GUIDE.md)
*   [New Contract Development Guide](docs/NEW_CONTRACTS_GUIDE.md)
*   [Upgrade Roadmap V1.1](docs/UPGRADE_V1.1_PHASED_PAYOUTS_AND_AUDIT.md)

---

<div align="center">
Built with ❤️ for the future of Medical Privacy.
</div>
