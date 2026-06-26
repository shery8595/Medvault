/** Sensitive SponsorIncentiveVault views that must not be called without sponsor context. */
export const BLOCKED_CONTRACT_VIEWS: Record<string, string[]> = {
  SponsorIncentiveVault: [
    "getTotalDeposited",
    "getEncryptedPoolSize",
    "requestEncryptedPoolAccess",
  ],
};

export function isBlockedContractView(contract: string, functionName: string): boolean {
  const blocked = BLOCKED_CONTRACT_VIEWS[contract];
  return Boolean(blocked?.includes(functionName));
}
