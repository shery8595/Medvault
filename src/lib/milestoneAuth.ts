import { ethers } from "ethers";
import type { Identity } from "@semaphore-protocol/identity";
import { getEphemeralSigner } from "./semaphore";
import { getTrialMilestoneManager } from "./contracts";

export const MILESTONE_EIP712_DOMAIN = {
  name: "MedVault TrialMilestoneManager",
  version: "1",
} as const;

export async function signMilestoneCompletion(
  signer: ethers.Signer,
  milestoneManagerAddress: string,
  params: {
    trialId: bigint;
    patient: string;
    milestoneIndex: bigint;
    nonce: bigint;
    deadline: bigint;
  }
): Promise<string> {
  const chainId = await resolveSignerChainId(signer);
  const domain = {
    ...MILESTONE_EIP712_DOMAIN,
    chainId,
    verifyingContract: milestoneManagerAddress,
  };
  const types = {
    MilestoneCompletion: [
      { name: "trialId", type: "uint256" },
      { name: "patient", type: "address" },
      { name: "milestoneIndex", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  return signer.signTypedData(domain, types, {
    trialId: params.trialId,
    patient: ethers.getAddress(params.patient),
    milestoneIndex: params.milestoneIndex,
    nonce: params.nonce,
    deadline: params.deadline,
  });
}

export async function signMilestoneCompletionWithIdentity(
  identity: Identity,
  provider: ethers.Provider,
  milestoneManagerAddress: string,
  params: {
    trialId: bigint;
    patient: string;
    milestoneIndex: bigint;
    nonce: bigint;
    deadline: bigint;
  }
): Promise<string> {
  const signer = getEphemeralSigner(identity, provider);
  return signMilestoneCompletion(signer, milestoneManagerAddress, params);
}

async function resolveSignerChainId(signer: ethers.Signer): Promise<bigint> {
  const network = await signer.provider?.getNetwork();
  if (!network) throw new Error("Wallet provider unavailable.");
  return network.chainId;
}

/** Default EIP-712 deadline: milestone on-chain deadline or +1 year from now. */
export function milestoneAuthDeadline(milestoneDeadlineSec: number): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const fallback = now + 365n * 24n * 3600n;
  const onChain = BigInt(milestoneDeadlineSec);
  if (onChain > now) return onChain;
  return fallback;
}

export async function completeMilestoneSigned(
  sponsorSigner: ethers.Signer,
  trialId: string,
  patientAddress: string,
  milestoneIndex: number,
  patientSignature: string,
  deadline: bigint
) {
  const mm = getTrialMilestoneManager(sponsorSigner);
  const tx = await mm.completeMilestone(
    trialId,
    patientAddress,
    milestoneIndex,
    deadline,
    patientSignature
  );
  await tx.wait();
}
