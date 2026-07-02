import {
  PatientRegistered,
} from '../../generated/AnonymousPatientRegistry/AnonymousPatientRegistry';
import { AnonymousPatient } from '../../generated/schema';
import { BigInt } from '@graphprotocol/graph-ts';

export function handleAnonymousPatientRegistered(event: PatientRegistered): void {
  let commitment = event.params.blindedCommitment;
  let commitmentId = commitment.toHexString();
  let patient = AnonymousPatient.load(commitmentId);
  
  if (patient == null) {
    patient = new AnonymousPatient(commitmentId);
    patient.commitment = BigInt.fromUnsignedBytes(commitment);
    patient.registeredAt = event.block.timestamp;
    patient.save();
  }
}
