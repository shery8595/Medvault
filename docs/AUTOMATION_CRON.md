# Trial automation — owner cron (alternative to CRE)

`MedVaultAutomation` exposes the standard Chainlink `checkUpkeep` / `performUpkeep` interface. MedVault supports **two production-style drivers** for trial expiry finalization:

| Driver | Who calls `performUpkeep` | Typical hosting |
|--------|---------------------------|-----------------|
| **Chainlink CRE** | `AutomationReceiver` (`chainlinkForwarder`) | Chainlink workflow (`cre/my-workflow`) |
| **Owner cron** | Contract **owner** EOA | Railway Cron, VM crontab, CI schedule |

Both paths run the same on-chain logic: screening distribution (milestone 0) and trial deactivation when `endTime` has passed.

In-app overview: **Docs → Chainlink CRE** (`/docs/automation`) also covers CRE setup. This page documents the **owner cron** ops pattern.

## When to use owner cron

- Sepolia / demo when CRE deploy access or workflow hosting is not available
- Lower ops overhead (no `AutomationReceiver` forwarder path required for txs — owner calls directly)
- Railway Cron every **5 minutes** (`*/5 * * * *`) is sufficient for trial expiry

CRE remains the recommended path for decentralized, Chainlink-native production ops. See [cre/README.md](../cre/README.md) and [TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md).

## Permission model

`performUpkeep` accepts `msg.sender == chainlinkForwarder || msg.sender == owner` (`MedVaultAutomation.onlyForwarder`).

- **CRE path:** `chainlinkForwarder` → deployed `AutomationReceiver`
- **Cron path:** scheduled script uses the **owner** private key (same deployer that owns `MedVaultAutomation`)

No contract changes are required to switch drivers.

## Standalone deploy package

Ops use a small **standalone Node service** (separate repo), typically named `medvault-automation-cron`:

```
*/5 * * * *  (Railway Cron, UTC)
  → eth_call checkUpkeep("0x")
  → if needed: owner.performUpkeep(performData)
  → exit (required for Railway Cron)
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVATE_KEY` | yes | Must be `MedVaultAutomation.owner()` |
| `MEDVAULT_AUTOMATION_ADDRESS` | yes | From `src/lib/contracts/addresses.json` (`sepolia`) |
| `SEPOLIA_RPC_URL` | recommended | Alchemy / Infura JSON-RPC |
| `MAX_UPKEEPS_PER_RUN` | no | Default `10` — pagination across cron ticks |
| `CHAIN_ID` | no | Default `11155111` (Sepolia) |

Current Sepolia automation: `0x8310cF1984A591a19d06819730bf92666B622D2f`

### Railway deploy

1. Push the cron package to a **private** GitHub repo.
2. Railway → deploy repo → set variables above.
3. **Settings → Cron Schedule:** `*/5 * * * *`
4. **Start command:** `npm start` (one cycle per tick; process must exit).

Railway cron minimum interval is **5 minutes**. Gas is spent only when `performUpkeep` runs, not on idle `checkUpkeep` polls.

## Debugging (main repo)

```bash
npx hardhat run scripts/diagnose-automation-upkeep.ts --network sepolia
npm run verify:cre-receiver:sepolia   # CRE forwarder path only
```

## Related

- [TIMELOCK_WIRING.md](./TIMELOCK_WIRING.md) — CRE receiver + forwarder timelock
- [cre/README.md](../cre/README.md) — CRE workflow simulate/deploy
- `/docs/automation` — in-app CRE + automation overview
