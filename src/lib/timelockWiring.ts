import { ethers } from "ethers";

export const READER_ROLE_KEYS = {
  automation: ethers.id("automation"),
  authorizedRegistry: ethers.id("authorizedRegistry"),
  consentGate: ethers.id("consentGate"),
  scoreLeaderboard: ethers.id("scoreLeaderboard"),
  sponsorIncentiveVault: ethers.id("sponsorIncentiveVault"),
  eligibilityVerifier: ethers.id("eligibilityVerifier"),
} as const;

export type TimelockTargetKind =
  | "engineReader"
  | "address"
  | "contractAuth"
  | "loggerAuth";

export type TimelockTarget = {
  id: string;
  contract: string;
  label: string;
  kind: TimelockTargetKind;
  valueType: "address" | "bool";
  readArg?: "targetAddr";
  roleKey?: string;
  currentFn: string;
  pendingFn: string;
  etaFn: string;
  scheduleFn: string;
  applyFn: string;
  cancelFn?: string;
  authorizeDefault?: boolean;
  scheduleArgs?: (addr: string, authorize?: boolean) => unknown[];
};

const ENGINE_READER_CURRENT_FN: Record<string, string> = {
  automation: "automationContract",
  authorizedRegistry: "authorizedRegistry",
  consentGate: "consentGate",
  scoreLeaderboard: "scoreLeaderboard",
  sponsorIncentiveVault: "sponsorIncentiveVault",
  eligibilityVerifier: "eligibilityVerifier",
};

export const TIMELOCK_TARGETS: TimelockTarget[] = [
  ...Object.entries(READER_ROLE_KEYS).map(([name, roleKey]) => ({
    id: `engine-${name}`,
    contract: "EligibilityEngine",
    label: `EligibilityEngine.${name}`,
    kind: "engineReader" as const,
    valueType: "address" as const,
    roleKey,
    currentFn: ENGINE_READER_CURRENT_FN[name] ?? name,
    pendingFn: "pendingReaderChanges",
    etaFn: "readerChangeEta",
    scheduleFn: "scheduleAuthorizedReader",
    applyFn: "applyAuthorizedReader",
    cancelFn: "cancelAuthorizedReaderSchedule",
    scheduleArgs: (addr: string) => [roleKey, addr],
  })),
  {
    id: "trial-automation",
    contract: "TrialManager",
    label: "TrialManager.automationContract",
    kind: "address",
    valueType: "address",
    currentFn: "automationContract",
    pendingFn: "pendingAutomationContract",
    etaFn: "automationContractChangeEta",
    scheduleFn: "scheduleAutomationContract",
    applyFn: "applyAutomationContract",
  },
  {
    id: "trial-sponsorRegistry",
    contract: "TrialManager",
    label: "TrialManager.sponsorRegistry",
    kind: "address",
    valueType: "address",
    currentFn: "sponsorRegistry",
    pendingFn: "pendingSponsorRegistry",
    etaFn: "sponsorRegistryChangeEta",
    scheduleFn: "scheduleSponsorRegistry",
    applyFn: "applySponsorRegistry",
  },
  {
    id: "trial-eligibilityEngine",
    contract: "TrialManager",
    label: "TrialManager.eligibilityEngine",
    kind: "address",
    valueType: "address",
    currentFn: "eligibilityEngine",
    pendingFn: "pendingEligibilityEngine",
    etaFn: "eligibilityEngineChangeEta",
    scheduleFn: "scheduleEligibilityEngine",
    applyFn: "applyEligibilityEngine",
  },
  {
    id: "vault-automation",
    contract: "SponsorIncentiveVault",
    label: "SponsorIncentiveVault.automationContract",
    kind: "address",
    valueType: "address",
    currentFn: "automationContract",
    pendingFn: "pendingAutomationContract",
    etaFn: "automationContractChangeEta",
    scheduleFn: "scheduleAutomationContract",
    applyFn: "applyAutomationContract",
  },
  {
    id: "vault-milestoneManager",
    contract: "SponsorIncentiveVault",
    label: "SponsorIncentiveVault.milestoneManager",
    kind: "address",
    valueType: "address",
    currentFn: "milestoneManager",
    pendingFn: "pendingMilestoneManager",
    etaFn: "milestoneManagerChangeEta",
    scheduleFn: "scheduleMilestoneManager",
    applyFn: "applyMilestoneManager",
  },
  {
    id: "vault-sponsorRegistry",
    contract: "SponsorIncentiveVault",
    label: "SponsorIncentiveVault.sponsorRegistry",
    kind: "address",
    valueType: "address",
    currentFn: "sponsorRegistry",
    pendingFn: "pendingSponsorRegistry",
    etaFn: "sponsorRegistryChangeEta",
    scheduleFn: "scheduleSponsorRegistry",
    applyFn: "applySponsorRegistry",
  },
  {
    id: "automation-vault",
    contract: "MedVaultAutomation",
    label: "MedVaultAutomation.vault",
    kind: "address",
    valueType: "address",
    currentFn: "vault",
    pendingFn: "pendingVault",
    etaFn: "vaultChangeEta",
    scheduleFn: "scheduleVault",
    applyFn: "applyVault",
  },
  {
    id: "automation-forwarder",
    contract: "MedVaultAutomation",
    label: "MedVaultAutomation.chainlinkForwarder",
    kind: "address",
    valueType: "address",
    currentFn: "chainlinkForwarder",
    pendingFn: "pendingChainlinkForwarder",
    etaFn: "forwarderChangeEta",
    scheduleFn: "scheduleChainlinkForwarder",
    applyFn: "applyChainlinkForwarder",
  },
  {
    id: "milestone-vault",
    contract: "TrialMilestoneManager",
    label: "TrialMilestoneManager.vault",
    kind: "address",
    valueType: "address",
    currentFn: "vault",
    pendingFn: "pendingVault",
    etaFn: "vaultChangeEta",
    scheduleFn: "scheduleVault",
    applyFn: "applyVault",
  },
  {
    id: "milestone-trialManager",
    contract: "TrialMilestoneManager",
    label: "TrialMilestoneManager.trialManager",
    kind: "address",
    valueType: "address",
    currentFn: "trialManager",
    pendingFn: "pendingTrialManager",
    etaFn: "trialManagerChangeEta",
    scheduleFn: "scheduleTrialManager",
    applyFn: "applyTrialManager",
  },
  {
    id: "consent-gate",
    contract: "ConsentManager",
    label: "ConsentManager.consentGate",
    kind: "address",
    valueType: "address",
    currentFn: "consentGate",
    pendingFn: "pendingConsentGate",
    etaFn: "consentGateChangeEta",
    scheduleFn: "scheduleConsentGate",
    applyFn: "applyConsentGate",
  },
  {
    id: "ceth-contract-auth",
    contract: "ConfidentialETH",
    label: "ConfidentialETH.authorizedContracts",
    kind: "contractAuth",
    valueType: "bool",
    readArg: "targetAddr",
    currentFn: "authorizedContracts",
    pendingFn: "pendingContractAuth",
    etaFn: "contractAuthChangeEta",
    scheduleFn: "scheduleContractAuth",
    applyFn: "applyContractAuth",
    authorizeDefault: true,
    scheduleArgs: (addr: string, authorize = true) => [addr, authorize],
  },
  {
    id: "data-access-logger",
    contract: "DataAccessLog",
    label: "DataAccessLog.isAuthorizedLogger",
    kind: "loggerAuth",
    valueType: "bool",
    readArg: "targetAddr",
    currentFn: "isAuthorizedLogger",
    pendingFn: "pendingLoggerChanges",
    etaFn: "loggerChangeEta",
    scheduleFn: "scheduleAuthorizedLogger",
    applyFn: "applyAuthorizedLogger",
    cancelFn: "cancelAuthorizedLoggerSchedule",
    authorizeDefault: true,
    scheduleArgs: (addr: string, authorize = true) => [addr, authorize],
  },
];

export function formatEtaCountdown(etaSec: bigint | number): string {
  const eta = Number(etaSec);
  if (!eta) return "—";
  const now = Math.floor(Date.now() / 1000);
  if (now >= eta) return "Ready to apply";
  const diff = eta - now;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  return `${days}d ${hours}h`;
}

export function formatTimelockValue(value: string, valueType: "address" | "bool"): string {
  if (valueType === "bool") {
    if (value === "true") return "true";
    if (value === "false") return "false";
    return "—";
  }
  if (!value || value === ethers.ZeroAddress) return "—";
  return `${value.slice(0, 10)}…`;
}

export function isBoolAuthKind(kind: TimelockTargetKind): boolean {
  return kind === "contractAuth" || kind === "loggerAuth";
}
