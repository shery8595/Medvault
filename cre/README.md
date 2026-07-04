# MedVault Chainlink CRE — trial finalization

Migrates `MedVaultAutomation` from sunset Chainlink Automation (CLA) to **Chainlink CRE**.

MedVault also supports an **owner cron** scheduler (same `checkUpkeep` / `performUpkeep` interface, owner as `msg.sender`). See [docs/AUTOMATION_CRON.md](../docs/AUTOMATION_CRON.md) and in-app `/docs/automation`.

## On-chain (Hardhat)

```bash
# 1. Deploy AutomationReceiver (Sepolia KeystoneForwarder in constructor)
npm run deploy:cre-receiver:sepolia

# 2. Allow performUpkeep, set gas limit, workflow identity, schedule MedVault forwarder
npm run wire:cre-receiver:sepolia

# 3. After ~6h timelock, apply forwarder on MedVaultAutomation
npx hardhat run scripts/finish-wiring.ts --network sepolia
```

Update `cre/my-workflow/config.*.json` `receiverAddress` with the deployed `AutomationReceiver` from `addresses.json`.

## CRE workflow

Install CRE CLI on `D:\cre-cli` and Bun on `D:\bun\bin` (both on PATH). Authenticate **once**:

```powershell
cre login
```

First-time workflow deps:

```bash
npm run cre:install
```

Or set `CRE_API_KEY` in `.env` (from https://app.chain.link → Account Settings).

```bash
# Optional: inject your Alchemy RPC into cre/project.local.yaml (not committed)
npm run cre:sync-rpc

npm run cre:simulate    # after cre login
npm run cre:deploy      # after forwarder timelock + cre login
```

**Timelock:** `MedVaultAutomation.chainlinkForwarder` → AutomationReceiver applies after ~6h:

```bash
npm run check:forwarder-timelock:sepolia
npx hardhat run scripts/finish-wiring.ts --network sepolia
npm run verify:cre-receiver:sepolia   # forwarder should be 0x9522…0C97
```

Workflow name must match `CRE_WORKFLOW_NAME` (default: `medvault-trial-finalizer`) set on the receiver.

## Architecture

```
CRE cron → checkUpkeep on MedVaultAutomation → AutomationReceiver → performUpkeep
```

`MedVaultAutomation.chainlinkForwarder` must point at **AutomationReceiver** (not the old CLA forwarder).
