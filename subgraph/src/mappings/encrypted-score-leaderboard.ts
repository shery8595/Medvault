import { ApplicantAdded, ComparisonComputed } from "../../generated/EncryptedScoreLeaderboard/EncryptedScoreLeaderboard"
import { BlindRankingEvent } from "../../generated/schema"

export function handleApplicantAdded(event: ApplicantAdded): void {
  // Pool size tracked via contract reads; event indexed for observability
  const id = event.transaction.hash.toHexString() + "-add-" + event.logIndex.toString()
  const row = new BlindRankingEvent(id)
  row.trialId = event.params.trialId
  row.nullifierA = event.params.nullifier
  row.nullifierB = event.params.nullifier
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}

export function handleComparisonComputed(event: ComparisonComputed): void {
  const id = event.transaction.hash.toHexString() + "-cmp-" + event.logIndex.toString()
  const row = new BlindRankingEvent(id)
  row.trialId = event.params.trialId
  row.nullifierA = event.params.nullifierA
  row.nullifierB = event.params.nullifierB
  row.blockNumber = event.block.number
  row.txHash = event.transaction.hash
  row.save()
}
