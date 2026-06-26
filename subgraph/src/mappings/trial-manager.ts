import { TrialCreated, TrialDeactivated, TrialManager, SponsorNameUpdated } from "../../generated/TrialManager/TrialManager"
import { Trial, Sponsor } from "../../generated/schema"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleTrialCreated(event: TrialCreated): void {
    let trial = new Trial(event.params.trialId.toString())
    let contract = TrialManager.bind(event.address)
    let trialData = contract.getTrial(event.params.trialId)

    // Ensure sponsor exists
    let sponsor = Sponsor.load(event.params.sponsor)
    if (!sponsor) {
        sponsor = new Sponsor(event.params.sponsor)
        sponsor.name = event.params.sponsor.toHexString() // Default to address
        sponsor.verified = false
        sponsor.addedAt = event.block.timestamp
        sponsor.save()
    }

    trial.sponsor = sponsor.id
    trial.name = event.params.name
    trial.phase = trialData.phase
    trial.location = trialData.location
    trial.compensation = trialData.compensation
    trial.minAge = trialData.minAge
    trial.maxAge = trialData.maxAge
    trial.requiresDiabetes = trialData.requiresDiabetes
    trial.minHb = trialData.minHb

    // Expanded Criteria
    trial.genderRequirement = trialData.genderRequirement
    trial.minHeight = trialData.minHeight
    trial.maxWeight = trialData.maxWeight
    trial.requiresNonSmoker = trialData.requiresNonSmoker
    trial.requiresNormalBP = trialData.requiresNormalBP

    trial.encryptedCriteria = event.params.encryptedCriteria
    trial.active = true
    trial.endTime = event.params.endTime
    trial.createdAt = event.block.timestamp
    trial.save()
}

export function handleTrialDeactivated(event: TrialDeactivated): void {
    let trial = Trial.load(event.params.trialId.toString())
    if (trial) {
        trial.active = false
        trial.save()
    }
}

export function handleSponsorNameUpdated(event: SponsorNameUpdated): void {
    let sponsor = Sponsor.load(event.params.sponsor)
    if (!sponsor) {
        sponsor = new Sponsor(event.params.sponsor)
        sponsor.verified = false
        sponsor.addedAt = event.block.timestamp
    }
    sponsor.name = event.params.name
    sponsor.save()
}
