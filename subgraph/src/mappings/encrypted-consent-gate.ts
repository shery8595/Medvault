import { GateComputed } from "../../generated/EncryptedConsentGate/EncryptedConsentGate"
import { ConsentGateCheck } from "../../generated/schema"

export function handleGateComputed(event: GateComputed): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const row = new ConsentGateCheck(id)
  row.trialId = event.params.trialId
  row.resultId = event.params.resultId
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}
