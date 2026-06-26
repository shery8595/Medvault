import { IncentiveFunded, AnonymousParticipantRegistered, RewardsDistributed, MilestoneRewardsDistributed, ClaimInitiated } from "../../generated/SponsorIncentiveVault/SponsorIncentiveVault"
import { IncentivePool, IncentiveParticipant, TrialMilestone, ClaimLifecycle } from "../../generated/schema"

export function handleIncentiveFunded(event: IncentiveFunded): void {
    let poolId = event.params.trialId.toString()
    let pool = IncentivePool.load(poolId)

    if (!pool) {
        pool = new IncentivePool(poolId)
        pool.trial = poolId
        pool.participantCount = 0
        pool.distributed = false
    }

    pool.lastFundedAt = event.block.timestamp
    pool.save()
}

export function handleAnonymousParticipantRegistered(event: AnonymousParticipantRegistered): void {
    let poolId = event.params.trialId.toString()
    let participantId = poolId + "-" + event.params.nullifier.toString()

    let participant = new IncentiveParticipant(participantId)
    participant.pool = poolId
    participant.nullifier = event.params.nullifier
    participant.registeredAt = event.block.timestamp
    participant.save()

    let pool = IncentivePool.load(poolId)
    if (pool) {
        pool.participantCount = pool.participantCount + 1
        pool.save()
    }
}

export function handleRewardsDistributed(event: RewardsDistributed): void {
    let poolId = event.params.trialId.toString()
    let pool = IncentivePool.load(poolId)

    if (pool) {
        pool.distributed = true
        pool.distributedAt = event.block.timestamp
        pool.save()
    }

    let screeningMilestoneId = poolId + "-0"
    let screeningMilestone = TrialMilestone.load(screeningMilestoneId)
    if (screeningMilestone) {
        screeningMilestone.distributed = true
        screeningMilestone.save()
    }
}

export function handleMilestoneRewardsDistributed(event: MilestoneRewardsDistributed): void {
    let trialId = event.params.trialId.toString()
    let milestoneIndex = event.params.milestoneIndex.toString()
    let milestoneId = trialId + "-" + milestoneIndex

    let milestone = TrialMilestone.load(milestoneId)
    if (milestone) {
        milestone.distributed = true
        milestone.save()
    }
}

export function handleClaimInitiated(event: ClaimInitiated): void {
    let id = event.params.trialId.toString() + "-" + event.params.permitHolder.toHexString()
    let claim = ClaimLifecycle.load(id)
    if (!claim) {
        claim = new ClaimLifecycle(id)
        claim.trialId = event.params.trialId
        claim.permitHolder = event.params.permitHolder
        claim.completed = false
    }
    claim.sufficientHandle = event.params.sufficientHandle
    claim.initiatedAt = event.block.timestamp
    claim.initiatedTxHash = event.transaction.hash
    claim.save()
}
