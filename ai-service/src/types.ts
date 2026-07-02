/** Trial criteria aligned with `TrialManager.createTrialWithEncryptedCriteria` / sponsor form. */
export type TrialCriteriaFields = {
  minAge: number;
  maxAge: number;
  requiresDiabetes: boolean;
  minHb: number;
  genderRequirement: number;
  minHeight: number;
  maxWeight: number;
  requiresNonSmoker: boolean;
  requiresNormalBP: boolean;
};

export type RedactionEntityType =
  | "PATIENT_NAME"
  | "DOB"
  | "MRN"
  | "PHONE"
  | "EMAIL"
  | "SSN"
  | "ADDRESS"
  | "OTHER_PHI";

export interface RedactionEntity {
  type: RedactionEntityType;
  token: string;
}

export interface RedactionReport {
  tokensRedacted: number;
  entities: RedactionEntity[];
  fullyRedacted: boolean;
  nerUsed: boolean;
  regexOnly: boolean;
}

export interface ExtractCriteriaResponse {
  criteria: TrialCriteriaFields;
  redactionReport: RedactionReport;
}

export interface AuditLogInput {
  id: string;
  actionType: string;
  trialId: string;
  patientHash: string;
  timestamp: string;
  performer: string;
}

export interface AuditLogsSummary {
  matchRatePercent: number;
  totalEvents: number;
  eligibilityChecked: number;
  consentsGranted: number;
  applicationsChanged: number;
  bottleneckCriteria: string[];
  narrative: string;
}
