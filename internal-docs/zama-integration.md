# Zama Integration Guide

## Stack (pinned versions)

| Layer | Package / service | Version (repo root `package.json`) |
|-------|-------------------|-------------------------------------|
| Solidity FHE | `@fhevm/solidity` | `^0.11.1` |
| Confidential token | `@openzeppelin/confidential-contracts` | `^0.5.1` (IERC7984 / `ERC7984`) |
| Browser encrypt | `@zama-fhe/sdk`, `@zama-fhe/react-sdk` | `^3.2.0` |
| Relayer helpers | `@zama-fhe/relayer-sdk` | `0.4.1` (overrides) |
| Hardhat tests | `@fhevm/hardhat-plugin`, `@fhevm/mock-utils` | `^0.4.2` |
| Live relayer | `https://relayer.testnet.zama.org` | Proxied in Vite dev as `/api/relayer/11155111` |

Peer: `@openzeppelin/contracts ^5.6.1` for standard OZ imports alongside confidential contracts.

## Chain configuration

- Network: Ethereum Sepolia (`11155111`)
- Config: [`src/lib/zamaChain.ts`](../src/lib/zamaChain.ts) — `buildZamaFheChain()`, relayer URL
- Vite proxy: `/api/relayer/11155111` → Zama testnet relayer

## Proof accounts (encrypted input binding)

Client encryption uses **contract-specific proof accounts** — the `(contractAddress, userAddress)` pair passed to `sdk.encrypt()` or `createEncryptedInput()` must match the on-chain `FHE.fromExternal` verification site.

| Flow | Proof account (`userAddress`) | Contract |
|------|------------------------------|----------|
| Patient profile register/update | Patient EOA | `AnonymousPatientRegistry` / `MedVaultRegistry` |
| Sponsor encrypted criteria | Sponsor EOA | `TrialManager` |
| `requestWithdraw` | Patient EOA | `ConfidentialETH7984` |
| `requestWithdrawTo` (vault claim) | `SponsorIncentiveVault` address | `ConfidentialETH7984` |
| Private stake / unstake | Patient EOA | `StakingManager` |
| Hybrid document AES key (4×`euint64`) | Patient EOA | `PatientDocumentStore` |

See [`src/lib/fhe.ts`](../src/lib/fhe.ts), [`src/lib/EncryptionService.ts`](../src/lib/EncryptionService.ts) (`wrapKeyForFhe`), and [`test-support/fhe.ts`](../test-support/fhe.ts).

Wrong proof account → `InvalidSigner()` revert at ingress.

## ERC-7984 (ConfidentialETH7984)

Native ETH wrapper implementing OpenZeppelin `ERC7984`:

- **Standard:** `confidentialBalanceOf`, `confidentialTransfer`, `setOperator`, `confidentialTotalSupply`
- **MedVault extensions:** `deposit`, `depositFor`, `receive()` (auto-deposit), `requestWithdraw`, `requestWithdrawTo`, `completePublicExit`, `lockBalance`, `transferEncrypted`
- **Callbacks:** `onConfidentialTransferReceived` — `SponsorIncentiveVault`, `StakingManager`

Deploy: `ConfidentialETH7984` (alias `ConfidentialETH` for backward compatibility).

Full reference: [docs/ERC7984_CONFIDENTIAL_TOKEN.md](../docs/ERC7984_CONFIDENTIAL_TOKEN.md).

## KMS withdraw flow

1. `requestWithdraw` / `requestWithdrawTo` — stage encrypted amount; emit public **sufficiency handle** only
2. Relayer `revealWithdrawAmount(For)` — KMS verifies sufficiency against staged ciphertext
3. `completeWithdraw` / `completeWithdrawTo` — KMS amount proof, burn cETH, send ETH to authorized destination

Documented in [docs/PRIVATE_WITHDRAWALS.md](../docs/PRIVATE_WITHDRAWALS.md).

## Trial criteria paths

| Function | Criteria storage | Recommended |
|----------|------------------|-------------|
| `createTrialWithEncryptedCriteria` | FHE handles | **Yes** — production sponsor UI |
| `createTrial` | Plaintext bounds | Tests, SDK/MCP only |

See [SECURITY.md](../SECURITY.md).

## Integrator checklist (new encrypted field)

1. Choose type (`euint8`, `euint16`, `ebool`, …) and encrypt in browser with correct proof account
2. Accept `externalEuint*` + `inputProof` in contract; call `FHE.fromExternal`
3. After every FHE mutation: `FHE.allowThis` + `FHE.allow` for authorized readers
4. Add Hardhat test with `createEncryptedUint*` helpers in `test-support/fhe.ts`
5. Update [docs/FHE_AUDIT_README.md](../docs/FHE_AUDIT_README.md) primitive map
6. If adding attestation binding, extend Noir public inputs and run `npm run build:circuit`

## Local development

- Docker: [docs/DOCKER.md](../docs/DOCKER.md) — `docker compose up --build`
- Legacy npm: [docs/LOCAL_DEVELOPMENT.md](../docs/LOCAL_DEVELOPMENT.md)
