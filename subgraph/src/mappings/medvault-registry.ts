import {
  PatientRegistered,
  AnonymousApplication,
  AnonymousApplyStaged,
} from "../../generated/MedVaultRegistry/MedVaultRegistry";
import { AnonymousPatient, AnonymousSubmission, Trial } from "../../generated/schema";

export function handlePatientRegistered(event: PatientRegistered): void {
  let commitment = event.params.commitment;
  let commitmentId = commitment.toString();

  let anonPatient = AnonymousPatient.load(commitmentId);
  if (anonPatient == null) {
    anonPatient = new AnonymousPatient(commitmentId);
    anonPatient.commitment = commitment;
    anonPatient.registeredAt = event.block.timestamp;
    anonPatient.save();
  }
}

export function handleAnonymousApplyStaged(_event: AnonymousApplyStaged): void {
  return;
}

export function handleAnonymousApplication(event: AnonymousApplication): void {
  let trialId = event.params.trialId.toString();
  let nullifier = event.params.nullifierHash.toString();
  let applicationId = nullifier + "-" + trialId;

  let trial = Trial.load(trialId);
  if (trial == null) {
    return;
  }

  let application = AnonymousSubmission.load(applicationId);

  if (!application) {
    application = new AnonymousSubmission(applicationId);
    application.trial = trialId;
    application.trialId = event.params.trialId;
    application.nullifier = event.params.nullifierHash;
    application.submittedAt = event.block.timestamp;
    application.status = "Pending";
    application.statusUpdatedAt = event.block.timestamp;
    application.noirCertified = false;
    application.save();
    return;
  }

  application.submittedAt = event.block.timestamp;
  application.status = "Pending";
  application.statusUpdatedAt = event.block.timestamp;
  application.save();
}
