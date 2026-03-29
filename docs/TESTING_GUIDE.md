# Testing Guide — MedVault Comprehensive Stress Test

MedVault uses a comprehensive stress test suite to verify the integrity, privacy, and state consistency of its Fhenix-powered smart contracts.

## Overview

The test suite, located at `test/comprehensive_medvault.test.js`, consists of **100 test cases** targeting the core business logic of the ecosystem:

| Component | Cases | Focus |
|-----------|-------|-------|
| **Eligibility Engine** | 30 | Verifies complex conditional logic (Age, Diabetes, Hb levels) using Fhenix FHE operations. |
| **Staking Manager** | 30 | Ensures consistent state updates for encrypted balances during ETH staking. |
| **Reward Distribution** | 30 | Simulates multi-phase milestone rewards across multiple participants. |
| **System Integrity** | 10 | Validates cross-contract authorization and Fhenix ACL performance. |

## Environment Requirements

To ensure these tests run correctly, your environment must be configured with specific dependency versions:

- **Node.js**: v20+ recommended.
- **@cofhe/hardhat-plugin**: `^0.4.0`
- **Hardhat**: Configured with `@cofhe/hardhat-plugin`.

## Running the Tests

The tests are designed to run on the Fhenix Local Testnet or Arbitrum Sepolia.

```bash
npx hardhat test test/comprehensive_medvault.test.js --network arbitrumSepolia
```

### Interpretation of Results

A successful run should output:
```text
  MedVault Comprehensive Stress Test (90+ cases)
    ...
  100 passing (186ms)
```

## Troubleshooting

### ESM Import Errors
The tests are written in Javascript (`.js`) instead of TypeScript to bypass common `ts-node` and ESM/CJS resolution issues within the Hardhat ecosystem. Always use the `.js` version for the comprehensive suite.

### Silent Failures
If the tests fail silently or crash during setup, ensure your `.env` file is present (even with mock keys) as the Hardhat config expects it.

### Fhenix SDK Version
If you see `Invalid @cofhe/sdk version`, verify your `package.json` matches:
`"@cofhe/sdk": "^0.4.0"`
