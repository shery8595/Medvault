export interface Trial {
  id: string;
  name: string;
  sponsor: {
    id: string;
    name: string;
  };
  phase: string;
  location: string;
  compensation: string;
  minAge: number;
  maxAge: number;
  requiresDiabetes: boolean;
  minHb: number;
  active: boolean;
  endTime?: string;
  isExpired?: boolean;
  createdAt?: string;
  eligibilityScore?: number;
  matchCount?: number;
  applicantCount?: number;
  acceptedCount?: number;
  pendingApplicationCount?: number;
  screenedCount?: number;
  updatedAtSec?: number;
  poolFundedWei?: string;
  paidToParticipantsEth?: number;
  payoutPct?: number;
  enrollmentPct?: number;
  milestoneProgressPct?: number;
  isNew?: boolean;
  hasConsent?: boolean;
  hasComputed?: boolean;
  applicationStatus?: "Pending" | "Accepted" | "Rejected";
  applicationMessage?: string;
  nullifier?: string;
  criteria?: {
    ageRange: [number, number];
    labThresholds: { labName: string; operator: string; value: number }[];
    diagnosis: string[];
    exclusions: string[];
  };
  breakdown?: {
    met: string[];
    missing: string[];
    borderline: string[];
  };
  incentivePool?: {
    id: string;
    distributed: boolean;
    distributedAt?: string;
    participantCount?: number;
    lastFundedAt?: string;
    participants?: { nullifier: string }[];
  };
  rewardPoolFunded?: boolean;
  rewardParticipantRegistered?: boolean;
  milestones?: { index: number; weightBps: number; distributed: boolean }[];
}

export interface MedicalReport {
  id: string;
  patientAddress: string;
  age: number;
  hasDiabetes: boolean;
  hbLevel: number;
  timestamp: string;
  txHash: string;
  name?: string; // For mock data compatibility
  date?: string; // For mock data compatibility
  status?: string; // For mock data compatibility
  features?: any; // For mock data compatibility
}

export interface ConsentLog {
  id: string;
  trialId?: string;
  trialName: string;
  patientAddress?: string;
  granted?: boolean;
  timestamp: string;
  txHash?: string;
  sponsorName?: string; // For mock data compatibility
  dataShared?: string[]; // For mock data compatibility
  status?: string; // For mock data compatibility
  message?: string; // For mock data compatibility
  rawTimestamp?: number; // For sorting
  expiresAt?: number; // Consent window deadline (unix seconds)
}

export interface Match {
  id: string;
  trialId: string;
  trialName: string;
  patientAddress: string;
  status: string;
  timestamp: string;
  patientId?: string; // For UI display
  matchScore?: number; // For UI display
  applicationStatus?: "Pending" | "Accepted" | "Rejected" | "None";
  applicationMessage?: string;
  rawTimestamp?: number; // For sorting
  expiresAt?: number; // Consent window deadline (unix seconds)
  currentMilestone?: number; // 0 = none, 1-4 for milestones
  isAnonymous?: boolean; // For anonymous applications
  nullifier?: string; // For anonymous applications
  /** Unix seconds when AnonymousEncryptedPropensityCommitted indexed (anonymous only) */
  fhePropensityCommittedAt?: string | null;
  noirCertified?: boolean;
  noirEligible?: boolean | null;
  /** Zama-bound attestation metadata (no PHI) */
  attestationResultHash?: string | null;
  attestationFheStageHash?: string | null;
  attestationCriteriaSchemaHash?: string | null;
}

export interface AnalyticsData {
  ageDistribution: { name: string; value: number }[];
  enrollmentProgress: number;
}

// Subgraph specific types
export interface SubgraphPatient {
  id: string;
  profileUpdatedAt: string;
  profileTxHash: string;
}

export interface SubgraphTrial {
  id: string;
  sponsor: {
    id: string;
    name: string;
  };
  name: string;
  phase: string;
  location: string;
  compensation: string;
  minAge: number;
  maxAge: number;
  requiresDiabetes: boolean;
  minHb: number;
  active: boolean;
  endTime: string;
  createdAt: string;
}

export interface SubgraphConsent {
  id: string;
  patient: string;
  trial: {
    id: string;
    name: string;
  };
  granted: boolean;
  validEpoch?: string;
  expiresAt?: string;
  lastUpdatedAt: string;
  txHash: string;
}

export interface SubgraphEligibilityResult {
  id: string;
  patient: string;
  trial: {
    id: string;
    name: string;
  };
  computedAt: string;
  txHash: string;
}

export interface Application {
  id: string;
  patient: string;
  trialId: string;
  status: "Pending" | "Accepted" | "Rejected";
  message?: string;
  updatedAt: string;
  txHash: string;
}

export interface SubgraphApplication {
  id: string;
  patient: string;
  trial: {
    id: string;
    name: string;
  };
  status: string;
  message: string | null;
  updatedAt: string;
  txHash: string;
}



