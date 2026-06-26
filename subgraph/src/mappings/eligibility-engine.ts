import {
    EligibilityComputed,
    AppliedToTrial,
    ApplicationStatusUpdated,
    AnonymousApplicationStatusUpdated,
    AnonymousEncryptedPropensityCommitted,
    EligibilityProofVerified,
} from "../../generated/EligibilityEngine/EligibilityEngine"
import { EligibilityResult, Application, AnonymousSubmission, Trial, TrialPropensitySignals } from "../../generated/schema"

export function handleEligibilityComputed(event: EligibilityComputed): void {
    let id = event.params.patient.toHex() + "-" + event.params.trialId.toString()
    let result = new EligibilityResult(id)

    result.patient = event.params.patient
    result.trial = event.params.trialId.toString()
    result.computedAt = event.block.timestamp
    result.txHash = event.transaction.hash
    result.save()
}

export function handleAppliedToTrial(event: AppliedToTrial): void {
    let id = event.params.patient.toHex() + "-" + event.params.trialId.toString()
    let app = new Application(id)

    app.patient = event.params.patient
    app.trial = event.params.trialId.toString()
    app.status = "Pending"
    app.updatedAt = event.block.timestamp
    app.txHash = event.transaction.hash
    app.save()
}

export function handleApplicationStatusUpdated(event: ApplicationStatusUpdated): void {
    let id = event.params.patient.toHex() + "-" + event.params.trialId.toString()
    let app = Application.load(id)

    if (app) {
        if (event.params.status == 2) {
            app.status = "Accepted"
        } else if (event.params.status == 3) {
            app.status = "Rejected"
        }
        app.message = event.params.message
        app.updatedAt = event.block.timestamp
        app.save()
    }
}

export function handleAnonymousApplicationStatusUpdated(event: AnonymousApplicationStatusUpdated): void {
    let trialId = event.params.trialId.toString()
    let nullifier = event.params.nullifier.toString()
    let applicationId = nullifier + "-" + trialId

    let application = AnonymousSubmission.load(applicationId)

    if (application) {
        let status = event.params.status === 0 ? "None" :
                      event.params.status === 1 ? "Pending" :
                      event.params.status === 2 ? "Accepted" : "Rejected"
        application.status = status
        application.statusUpdatedAt = event.block.timestamp
        application.save()
    }
}

export function handleAnonymousEncryptedPropensityCommitted(event: AnonymousEncryptedPropensityCommitted): void {
    let trialId = event.params.trialId.toString()
    if (!Trial.load(trialId)) {
        return
    }

    let applicationId = event.params.nullifier.toString() + "-" + trialId
    let application = AnonymousSubmission.load(applicationId)
    if (application) {
        application.fhePropensityCommittedAt = event.block.timestamp
        application.save()
    }

    let id = trialId
    let agg = TrialPropensitySignals.load(id)
    if (!agg) {
        agg = new TrialPropensitySignals(id)
        agg.trial = trialId
        agg.signalCount = 0
    }
    agg.signalCount = agg.signalCount + 1
    agg.lastSignalAt = event.block.timestamp
    agg.save()
}

export function handleEligibilityProofVerified(event: EligibilityProofVerified): void {
    let trialId = event.params.trialId.toString()
    let applicationId = event.params.nullifier.toString() + "-" + trialId
    let application = AnonymousSubmission.load(applicationId)
    if (application) {
        application.noirCertified = true
        application.noirEligible = event.params.eligible
        application.noirCertifiedAt = event.block.timestamp
        application.attestationResultHash = event.params.resultHash
        application.attestationFheStageHash = event.params.fheStageHash
        application.attestationCriteriaSchemaHash = event.params.criteriaSchemaHash
        application.save()
    }
}
