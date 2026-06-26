import { BigInt } from "@graphprotocol/graph-ts"
import { TrialFinalized } from "../../generated/MedVaultAutomation/MedVaultAutomation"
import { AutomationFinalization } from "../../generated/schema"

export function handleTrialFinalized(event: TrialFinalized): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const row = new AutomationFinalization(id)
  row.trialId = event.params.trialId
  row.distributed = event.params.distributed
  row.deactivated = event.params.deactivated
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}
