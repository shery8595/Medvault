import { ethers } from "ethers";
import { getEligibilityEngine, getConfidentialETH, getSponsorIncentiveVault, getTrialMilestoneManager, getTrialManager } from "./index";
import { encryptUint64, ensureZamaConnected } from "../fhe";
import { signClaimAuthorization, signRegisterAuthorization } from "../semaphore";
import { resolveChainIdFrom } from "./index";
import type { Identity } from "@semaphore-protocol/identity";

export async function getPoolFundingAndRegistration(
  signer: ethers.Signer,
  trialId: string,
  account?: string,
  ephemeralAddress?: string
) {
  const vault = getSponsorIncentiveVault(signer);
  const funded = await vault.isPoolFunded(BigInt(trialId));
  
  // Use the ephemeralAddress if provided (for anonymous participants), otherwise fallback to EOA account
  const targetAddress = ephemeralAddress || account;
  const registered = targetAddress
    ? await vault.isParticipantRegistered(BigInt(trialId), targetAddress)
    : false;
  return { funded, registered };
}

export async function getEncryptedScoreHandle(
  signer: ethers.Signer,
  account: string,
  trialId: string,
  nullifier?: string | bigint | null
) {
  const engine = getEligibilityEngine(signer);
  if (nullifier) {
    return engine.getAnonymousScore(BigInt(nullifier), BigInt(trialId));
  }
  return engine.getEncryptedScore(account, BigInt(trialId));
}

export async function registerAnonymousParticipantByNullifier(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint,
  identity?: Identity
) {
  const vault = getSponsorIncentiveVault(signer);
  const engine = getEligibilityEngine(signer);
  const permitHolder = await engine.getDecryptPermitHolder(nullifier, BigInt(trialId));
  if (permitHolder && permitHolder !== ethers.ZeroAddress) {
    const alreadyRegistered = await vault.isParticipantRegistered(BigInt(trialId), permitHolder);
    if (alreadyRegistered) return;
  }
  const signerAddress = await signer.getAddress();
  const provider = signer.provider;
  if (!provider) throw new Error("Wallet provider not available");

  if (permitHolder && permitHolder.toLowerCase() !== signerAddress.toLowerCase()) {
    if (!identity) {
      throw new Error("Semaphore identity required for gasless ephemeral registration.");
    }
    const vaultAddress = await vault.getAddress();
    const chainId = await resolveChainIdFrom(signer);
    const nonce = BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const signature = await signRegisterAuthorization(identity, provider, {
      vaultAddress,
      chainId,
      trialId: BigInt(trialId),
      nullifier,
      permitHolder,
      nonce,
      deadline,
    });
    const tx = await vault.registerAnonymousParticipantFor(
      BigInt(trialId),
      nullifier,
      permitHolder,
      nonce,
      deadline,
      signature
    );
    await tx.wait();
    return;
  }

  const tx = await vault.registerAnonymousParticipant(BigInt(trialId), nullifier);
  await tx.wait();
}

export async function claimRewards(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint,
  destination: string,
  units: number,
  identity?: Identity
) {
  const vault = getSponsorIncentiveVault(signer);
  const cEth = getConfidentialETH(signer);
  const cEthAddress = await cEth.getAddress();
  const vaultAddress = await vault.getAddress();
  const engine = getEligibilityEngine(signer);
  const permitHolder = await engine.getDecryptPermitHolder(nullifier, BigInt(trialId));
  if (!permitHolder || permitHolder === ethers.ZeroAddress) {
    throw new Error("No reward permit holder found for this claim.");
  }
  const provider = signer.provider;
  if (!provider) throw new Error("Wallet provider not available");
  await ensureZamaConnected(provider, signer);
  const encrypted = await encryptUint64(cEthAddress, vaultAddress, units);

  const signerAddress = await signer.getAddress();
  if (permitHolder.toLowerCase() !== signerAddress.toLowerCase()) {
    if (!identity) {
      throw new Error("Semaphore identity required for gasless ephemeral reward claim.");
    }
    const chainId = await resolveChainIdFrom(signer);
    const nonce = BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const signature = await signClaimAuthorization(identity, provider, {
      vaultAddress,
      chainId,
      trialId: BigInt(trialId),
      nullifier,
      permitHolder,
      destination,
      units: BigInt(units),
      nonce,
      deadline,
    });
    const tx = await vault.claimParticipantRewardsFor(
      BigInt(trialId),
      nullifier,
      permitHolder,
      destination,
      BigInt(units),
      encrypted.handle,
      encrypted.inputProof,
      nonce,
      deadline,
      signature
    );
    await tx.wait();
    return;
  }

  const tx = await vault.claimParticipantRewards(
    BigInt(trialId),
    nullifier,
    destination,
    encrypted.handle,
    encrypted.inputProof
  );
  await tx.wait();
}

/** @deprecated v0.9 kick-off only — relayer completes via completeWithdrawTo */
export async function claimRewardsWithSignature(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint,
  destination: string,
  units: number,
  _balanceSig?: string,
  _balance?: bigint
) {
  return claimRewards(signer, trialId, nullifier, destination, units);
}

export async function getMilestonesAndProgress(
  signer: ethers.Signer,
  trialId: string,
  account?: string
) {
  const mm = getTrialMilestoneManager(signer);
  const rawMilestones = await mm.getMilestones(trialId);
  const progress = account ? await mm.getParticipantProgress(trialId, account) : null;
  return { rawMilestones, progress };
}

export type TrialPoolReclaimStatus = {
  poolFunded: boolean;
  participantCount: number;
  screeningDistributed: boolean;
  reclaimFinalized: boolean;
  trialEnded: boolean;
  canReclaimHint: boolean;
  sponsorAuthorized: boolean;
  trialSponsor: string | null;
  totalDepositedWei: string | null;
  totalFunded: string | null;
  canReclaim: boolean | null;
  reclaimableWei: string | null;
  reclaimableEth: string | null;
  amountsRestrictedReason: string | null;
  privacyNote: string;
};

export async function getTrialPoolReclaimStatus(
  signer: ethers.Signer,
  trialId: string,
  trialEndTimeSec?: string | number | null
): Promise<TrialPoolReclaimStatus> {
  const vault = getSponsorIncentiveVault(signer);
  const tid = BigInt(trialId);
  const endSec = trialEndTimeSec != null ? Number(trialEndTimeSec) : 0;
  const trialEnded = endSec > 0 && Math.floor(Date.now() / 1000) >= endSec;

  const [participantCountBn, screeningDistributed, reclaimFinalized, poolFunded] =
    await Promise.all([
      vault.getParticipantCount(tid),
      vault.isDistributed(tid),
      vault.reclaimFinalized(tid),
      vault.isPoolFunded(tid),
    ]);

  const participantCount = Number(participantCountBn);
  const noParticipants = participantCount === 0;
  const privacyNote =
    "Pool amounts are sponsor-private on-chain. Public callers only see whether a pool is funded.";

  let trialSponsor: string | null = null;
  try {
    const tm = getTrialManager(signer);
    const trial = await tm.getTrial(tid);
    trialSponsor = String(trial.sponsor).toLowerCase();
  } catch {
    /* trial may not exist */
  }

  let signerAddress: string | null = null;
  try {
    signerAddress = (await signer.getAddress()).toLowerCase();
  } catch {
    signerAddress = null;
  }

  const sponsorAuthorized = Boolean(
    signerAddress && trialSponsor && signerAddress === trialSponsor
  );

  const canReclaimHint =
    trialEnded && !reclaimFinalized && poolFunded && (screeningDistributed || noParticipants);

  if (!sponsorAuthorized) {
    return {
      poolFunded,
      participantCount,
      screeningDistributed,
      reclaimFinalized,
      trialEnded,
      canReclaimHint,
      sponsorAuthorized: false,
      trialSponsor,
      totalDepositedWei: null,
      totalFunded: null,
      canReclaim: null,
      reclaimableWei: null,
      reclaimableEth: null,
      amountsRestrictedReason: "Connected signer is not the trial sponsor",
      privacyNote,
    };
  }

  const totalDepositedWei = await vault.getTotalDeposited(tid);
  const reclaimableWei =
    totalDepositedWei > 0n && !reclaimFinalized && noParticipants ? totalDepositedWei : 0n;
  const canReclaim =
    trialEnded &&
    !reclaimFinalized &&
    totalDepositedWei > 0n &&
    (screeningDistributed || noParticipants);

  return {
    poolFunded,
    participantCount,
    screeningDistributed,
    reclaimFinalized,
    trialEnded,
    canReclaimHint,
    sponsorAuthorized: true,
    trialSponsor,
    totalDepositedWei: totalDepositedWei.toString(),
    totalFunded: ethers.formatEther(totalDepositedWei),
    canReclaim,
    reclaimableWei: reclaimableWei.toString(),
    reclaimableEth: ethers.formatEther(reclaimableWei),
    amountsRestrictedReason: null,
    privacyNote,
  };
}

export async function reclaimUndistributedPool(signer: ethers.Signer, trialId: string) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.reclaimUndistributed(BigInt(trialId));
  await tx.wait();
}

export async function getTrialPoolAndMilestones(
  signer: ethers.Signer,
  trialId: string,
  trialEndTimeSec?: string | number | null
) {
  const vault = getSponsorIncentiveVault(signer);
  const mm = getTrialMilestoneManager(signer);

  const [distributed, rawMilestones, reclaim] = await Promise.all([
    vault.isDistributed(trialId),
    mm.getMilestones(trialId),
    getTrialPoolReclaimStatus(signer, trialId, trialEndTimeSec),
  ]);

  let totalFunded = reclaim.totalFunded ?? "0";
  if (reclaim.sponsorAuthorized) {
    try {
      const fundedWei = await vault.getTotalDeposited(trialId);
      totalFunded = ethers.formatEther(fundedWei);
    } catch {
      totalFunded = reclaim.totalFunded ?? "0";
    }
  }

  const screeningDistributed = distributed;
  const milestonesWithDistribution = await Promise.all(
    rawMilestones.map(async (m: any, idx: number) => {
      const milestoneFlag = await vault.milestoneDistributed(trialId, idx);
      return {
        name: m.name,
        weightBps: Number(m.weightBps),
        deadline: Number(m.deadline),
        distributed: milestoneFlag || (idx === 0 && screeningDistributed),
      };
    })
  );

  return {
    totalFunded,
    distributed,
    milestones: milestonesWithDistribution,
    reclaim,
  };
}

export async function updateTrialApplicationStatus(
  signer: ethers.Signer,
  trialId: string,
  patientAddress: string,
  newStatus: number,
  decisionMessage: string
) {
  const engine = getEligibilityEngine(signer);
  const hexMessage = ethers.hexlify(ethers.toUtf8Bytes(decisionMessage || "No message provided"));
  const tx = await engine.updateApplicationStatus(trialId, patientAddress, newStatus, hexMessage);
  await tx.wait();

  if (newStatus === 2) {
    const vault = getSponsorIncentiveVault(signer);
    const regTx = await vault.registerParticipant(BigInt(trialId), patientAddress);
    await regTx.wait();
  }
}

export async function fundTrialPool(signer: ethers.Signer, trialId: string, amountEth: string) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.fundTrial(trialId, { value: ethers.parseEther(amountEth) });
  await tx.wait();
  const funded = await vault.getTotalDeposited(trialId);
  return ethers.formatEther(funded);
}

export async function setTrialMilestones(
  signer: ethers.Signer,
  trialId: string,
  milestones: { name: string; weight: number; deadline: number }[]
) {
  const mm = getTrialMilestoneManager(signer);
  const tx = await mm.setMilestones(
    trialId,
    milestones.map((m) => m.name),
    milestones.map((m) => m.weight),
    milestones.map((m) => m.deadline)
  );
  await tx.wait();
  const raw = await mm.getMilestones(trialId);
  return raw.map((r: any) => ({
    name: r.name,
    weightBps: Number(r.weightBps),
    deadline: Number(r.deadline),
    distributed: false,
  }));
}

export async function distributePartialMilestone(
  signer: ethers.Signer,
  trialId: string,
  milestoneIndex: number
) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.distributePartialPaginated(trialId, milestoneIndex, 0, 50);
  await tx.wait();
}

export async function resetMilestonePagination(
  signer: ethers.Signer,
  trialId: string,
  milestoneIndex: number
) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.resetPaginationState(trialId, milestoneIndex);
  await tx.wait();
}

export async function promoteParticipantAndDistribute(
  signer: ethers.Signer,
  trialId: string,
  patientAddress: string,
  milestoneIndex: number
) {
  const vault = getSponsorIncentiveVault(signer);
  const mm = getTrialMilestoneManager(signer);
  const currentProgress = Number(await mm.getParticipantProgress(trialId, patientAddress));
  const alreadyPaid = await vault.participantMilestonePaid(trialId, patientAddress, milestoneIndex);

  if (currentProgress <= milestoneIndex) {
    const tx1 = await mm.completeMilestone(trialId, patientAddress, milestoneIndex);
    await tx1.wait();
  }

  return {
    alreadyPaid,
    promoted: currentProgress <= milestoneIndex,
    progress: Math.max(currentProgress, milestoneIndex + 1),
  };
}

export async function promoteAnonymousParticipantAndDistribute(
  signer: ethers.Signer,
  trialId: string,
  nullifier: string | bigint,
  milestoneIndex: number
) {
  const engine = getEligibilityEngine(signer);
  const patientAddress = await engine.getDecryptPermitHolder(BigInt(nullifier), BigInt(trialId));
  if (!patientAddress || patientAddress === ethers.ZeroAddress) {
    throw new Error("No reward participant found for this anonymous nullifier.");
  }

  return promoteParticipantAndDistribute(signer, trialId, patientAddress, milestoneIndex);
}

export async function getAnonymousParticipantMilestoneState(
  signer: ethers.Signer,
  trialId: string,
  nullifier: string | bigint,
  milestoneCount: number
) {
  const engine = getEligibilityEngine(signer);
  const vault = getSponsorIncentiveVault(signer);
  const mm = getTrialMilestoneManager(signer);
  const participant = await engine.getDecryptPermitHolder(BigInt(nullifier), BigInt(trialId));
  if (!participant || participant === ethers.ZeroAddress) {
    return null;
  }

  const [registered, progress, paid] = await Promise.all([
    vault.isParticipantRegistered(BigInt(trialId), participant),
    mm.getParticipantProgress(trialId, participant),
    Promise.all(
      Array.from({ length: milestoneCount }, (_, index) =>
        vault.participantMilestonePaid(BigInt(trialId), participant, index)
      )
    ),
  ]);

  return {
    participant,
    registered: Boolean(registered),
    progress: Number(progress),
    paid: paid.map(Boolean),
  };
}
