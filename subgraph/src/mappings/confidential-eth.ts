import {
  WithdrawRequested,
  WithdrawToRequested,
  Withdrawal,
} from "../../generated/ConfidentialETH/ConfidentialETH"
import { WithdrawRequest } from "../../generated/schema"

export function handleWithdrawRequested(event: WithdrawRequested): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const row = new WithdrawRequest(id)
  row.user = event.params.user
  row.transferableHandle = event.params.transferableHandle
  row.kind = "withdraw"
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}

export function handleWithdrawToRequested(event: WithdrawToRequested): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  const row = new WithdrawRequest(id)
  row.user = event.params.user
  row.transferableHandle = event.params.transferableHandle
  row.kind = "withdrawTo"
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}

export function handleWithdrawal(_event: Withdrawal): void {
  // Completion tracked via WithdrawRequest + off-chain relayer; reserved for future enrichment.
}
