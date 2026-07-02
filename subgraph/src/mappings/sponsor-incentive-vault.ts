import { IncentiveFunded, RewardsDistributed, MilestoneRewardsDistributed } from "../../generated/SponsorIncentiveVault/SponsorIncentiveVault"
import { IncentivePool, TrialMilestone } from "../../generated/schema"

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
