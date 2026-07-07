import { ethers, type Provider } from "ethers";
import type { Identity } from "@semaphore-protocol/identity";
import { getTrialMilestoneManager, resolveChainIdFrom } from "./contracts";
import { getMedVaultRelayerUrl } from "./mobile";
import { getRelayersInFailoverOrder } from "./relayerRegistry";
import {
  getPendingMilestoneAuthLocal,
  storePendingMilestoneAuthLocal,
  type PendingMilestoneAuth,
} from "./pendingMilestoneAuthCore";
import {
  milestoneAuthDeadline,
  signMilestoneCompletion,
  signMilestoneCompletionWithIdentity,
} from "./milestoneAuth";

export type { PendingMilestoneAuth };
export {
  getPendingMilestoneAuthLocal,
  storePendingMilestoneAuthLocal,
} from "./pendingMilestoneAuthCore";

async function postRelayer(path: string, body: Record<string, unknown>, baseUrl?: string): Promise<void> {
  const urls = baseUrl
    ? [baseUrl.replace(/\/$/, "")]
    : getRelayersInFailoverOrder();

  let lastError = "Failed to store pending milestone auth";
  for (let i = 0; i < urls.length; i++) {
    const relayerUrl = urls[i]!.replace(/\/$/, "");
    try {
      const response = await fetch(`${relayerUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok || !data.success) {
        const msg = typeof data.error === "string" ? data.error : lastError;
        throw new Error(msg);
      }
      return;
    } catch (err) {
      lastError = (err as Error)?.message || lastError;
      if (i === urls.length - 1) throw new Error(lastError);
      console.warn(`[pendingMilestoneAuth] ${relayerUrl} upload failed — trying next relayer…`);
    }
  }
}

export async function createPendingMilestoneAuthorization(
  signer: ethers.Signer,
  trialId: bigint,
  nullifier: bigint,
  patientAddress: string,
  milestoneIndex: number
): Promise<PendingMilestoneAuth> {
  const mm = getTrialMilestoneManager(signer);
  const milestoneManagerAddress = await mm.getAddress();
  const milestones = await mm.getMilestones(trialId);
  if (milestoneIndex >= milestones.length) {
    throw new Error(`Milestone ${milestoneIndex + 1} is not configured for this trial.`);
  }
  const deadline = milestoneAuthDeadline(Number(milestones[milestoneIndex]!.deadline));
  const nonce = await mm.milestoneCompletionNonce(patientAddress);
  const signature = await signMilestoneCompletion(signer, milestoneManagerAddress, {
    trialId,
    patient: patientAddress,
    milestoneIndex: BigInt(milestoneIndex),
    nonce,
    deadline,
  });

  return {
    trialId: trialId.toString(),
    nullifier: nullifier.toString(),
    patient: ethers.getAddress(patientAddress),
    milestoneIndex: milestoneIndex.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
    milestoneManagerAddress,
  };
}

export async function createPendingMilestoneAuthorizationWithIdentity(
  identity: Identity,
  provider: Provider,
  trialId: bigint,
  nullifier: bigint,
  patientAddress: string,
  milestoneIndex: number
): Promise<PendingMilestoneAuth> {
  const chainId = await resolveChainIdFrom(provider);
  const mm = getTrialMilestoneManager(provider, chainId);
  const milestoneManagerAddress = await mm.getAddress();
  const milestones = await mm.getMilestones(trialId);
  if (milestoneIndex >= milestones.length) {
    throw new Error(`Milestone ${milestoneIndex + 1} is not configured for this trial.`);
  }
  const deadline = milestoneAuthDeadline(Number(milestones[milestoneIndex]!.deadline));
  const nonce = await mm.milestoneCompletionNonce(patientAddress);
  const signature = await signMilestoneCompletionWithIdentity(identity, provider, milestoneManagerAddress, {
    trialId,
    patient: patientAddress,
    milestoneIndex: BigInt(milestoneIndex),
    nonce,
    deadline,
  });

  return {
    trialId: trialId.toString(),
    nullifier: nullifier.toString(),
    patient: ethers.getAddress(patientAddress),
    milestoneIndex: milestoneIndex.toString(),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
    signature,
    milestoneManagerAddress,
  };
}

export async function publishPendingMilestoneAuth(
  auth: PendingMilestoneAuth,
  relayerBaseUrl?: string
): Promise<void> {
  await postRelayer("/relay/store-milestone-auth", auth, relayerBaseUrl);
}

export async function fetchPendingMilestoneAuthFromRelayer(
  trialId: bigint,
  nullifier: bigint,
  milestoneIndex: number,
  relayerBaseUrl?: string
): Promise<PendingMilestoneAuth | null> {
  const relayerUrl = (relayerBaseUrl ?? getMedVaultRelayerUrl()).replace(/\/$/, "");
  const qs = new URLSearchParams({
    trialId: trialId.toString(),
    nullifier: nullifier.toString(),
    milestoneIndex: milestoneIndex.toString(),
  });
  const response = await fetch(`${relayerUrl}/relay/pending-milestone-auth?${qs}`);
  if (response.status === 404) return null;
  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok || !data.success || !data.auth) return null;
  return data.auth as PendingMilestoneAuth;
}

export async function resolvePendingMilestoneAuth(
  trialId: bigint,
  nullifier: bigint,
  milestoneIndex: number,
  relayerBaseUrl?: string
): Promise<PendingMilestoneAuth | null> {
  const local = getPendingMilestoneAuthLocal(trialId, nullifier, milestoneIndex);
  if (local) return local;
  try {
    return await fetchPendingMilestoneAuthFromRelayer(trialId, nullifier, milestoneIndex, relayerBaseUrl);
  } catch {
    return null;
  }
}

/** Sign all configured milestones with sequential nonces and publish for sponsor promotion. */
export async function createAndPublishPendingMilestoneAuths(params: {
  identity: Identity;
  provider: Provider;
  trialId: bigint;
  nullifier: bigint;
  permitHolder: string;
  relayerBaseUrl?: string;
}): Promise<PendingMilestoneAuth[]> {
  const chainId = await resolveChainIdFrom(params.provider);
  const mm = getTrialMilestoneManager(params.provider, chainId);
  const milestones = await mm.getMilestones(params.trialId);
  if (milestones.length === 0) return [];

  const progress = Number(await mm.getParticipantProgress(params.trialId, params.permitHolder));
  const milestoneManagerAddress = await mm.getAddress();
  let nonce = await mm.milestoneCompletionNonce(params.permitHolder);
  const auths: PendingMilestoneAuth[] = [];
  for (let i = progress; i < milestones.length; i++) {
    const deadline = milestoneAuthDeadline(Number(milestones[i]!.deadline));
    const signature = await signMilestoneCompletionWithIdentity(
      params.identity,
      params.provider,
      milestoneManagerAddress,
      {
        trialId: params.trialId,
        patient: params.permitHolder,
        milestoneIndex: BigInt(i),
        nonce,
        deadline,
      }
    );
    const auth: PendingMilestoneAuth = {
      trialId: params.trialId.toString(),
      nullifier: params.nullifier.toString(),
      patient: ethers.getAddress(params.permitHolder),
      milestoneIndex: i.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
      milestoneManagerAddress,
    };
    nonce += 1n;
    storePendingMilestoneAuthLocal(auth);
    auths.push(auth);
    try {
      await publishPendingMilestoneAuth(auth, params.relayerBaseUrl);
    } catch (err) {
      console.warn(`[pendingMilestoneAuth] relayer upload failed for milestone ${i}:`, err);
    }
  }
  return auths;
}
