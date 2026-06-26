import { ConsentChanged, ConsentEpochRevoked } from "../../generated/ConsentManager/ConsentManager";

/** Privacy: consent wallet↔trial relationships are not indexed in the subgraph. */
export function handleConsentChanged(_event: ConsentChanged): void {
  return;
}

export function handleConsentEpochRevoked(_event: ConsentEpochRevoked): void {
  return;
}
