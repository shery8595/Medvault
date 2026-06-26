import {
    Staked,
    Unstaked,
    PrivateUnstakeRequested,
    PublicUnstakeRequested,
} from "../../generated/StakingManager/StakingManager"
import { StakingUser, UnstakeRequest } from "../../generated/schema"

export function handleStaked(event: Staked): void {
    let userId = event.params.user.toHexString()
    let user = StakingUser.load(userId)

    if (!user) {
        user = new StakingUser(userId)
    }

    user.lastUpdatedAt = event.block.timestamp
    user.save()
}

export function handleUnstaked(event: Unstaked): void {
    let userId = event.params.user.toHexString()
    let user = StakingUser.load(userId)

    if (!user) {
        user = new StakingUser(userId)
    }

    user.lastUpdatedAt = event.block.timestamp
    user.save()
}

export function handlePrivateUnstakeRequested(event: PrivateUnstakeRequested): void {
    const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    const row = new UnstakeRequest(id)
    row.user = event.params.user
    row.sufficientHandle = event.params.sufficientHandle
    row.blockNumber = event.block.number
    row.txHash = event.transaction.hash
    row.save()
}

export function handlePublicUnstakeRequested(event: PublicUnstakeRequested): void {
    const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
    const row = new UnstakeRequest(id)
    row.user = event.params.user
    row.sufficientHandle = event.params.sufficientHandle
    row.blockNumber = event.block.number
    row.txHash = event.transaction.hash
    row.save()
}
