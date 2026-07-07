import { storageKey } from "./pendingRegisterAuthCore";

export type PendingMilestoneAuth = {
  trialId: string;
  nullifier: string;
  patient: string;
  milestoneIndex: string;
  nonce: string;
  deadline: string;
  signature: string;
  milestoneManagerAddress: string;
};

const PENDING_MILESTONE_AUTH_KEY = "medvault_pending_milestone_auth";

export function milestoneAuthStorageKey(trialId: bigint, nullifier: bigint, milestoneIndex: number): string {
  return `${storageKey(trialId, nullifier)}:${milestoneIndex}`;
}

export function storePendingMilestoneAuthLocal(auth: PendingMilestoneAuth): void {
  try {
    const key = milestoneAuthStorageKey(
      BigInt(auth.trialId),
      BigInt(auth.nullifier),
      Number(auth.milestoneIndex)
    );
    const raw = localStorage.getItem(PENDING_MILESTONE_AUTH_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, PendingMilestoneAuth>) : {};
    map[key] = auth;
    localStorage.setItem(PENDING_MILESTONE_AUTH_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function getPendingMilestoneAuthLocal(
  trialId: bigint,
  nullifier: bigint,
  milestoneIndex: number
): PendingMilestoneAuth | null {
  try {
    const key = milestoneAuthStorageKey(trialId, nullifier, milestoneIndex);
    const raw = localStorage.getItem(PENDING_MILESTONE_AUTH_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, PendingMilestoneAuth>;
    return map[key] ?? null;
  } catch {
    return null;
  }
}
