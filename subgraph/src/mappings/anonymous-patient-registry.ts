import {
  PatientRegistered,
} from '../../generated/AnonymousPatientRegistry/AnonymousPatientRegistry';
import { AnonymousPatient } from '../../generated/schema';

export function handleAnonymousPatientRegistered(event: PatientRegistered): void {
  let commitment = event.params.commitment;
  let commitmentId = commitment.toHexString();
  let patient = AnonymousPatient.load(commitmentId);
  
  if (patient == null) {
    patient = new AnonymousPatient(commitmentId);
    patient.commitment = commitment;
    patient.registeredAt = event.block.timestamp;
    patient.save();
  }
}
