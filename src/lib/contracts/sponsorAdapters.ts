import { ethers } from "ethers";
import { getEligibilityEngine, getSponsorIncentiveVault, getTrialMilestoneManager } from "./index";

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
  nullifier: bigint
) {
  const vault = getSponsorIncentiveVault(signer);
  const engine = getEligibilityEngine(signer);
  const permitHolder = await engine.decryptPermitHolder(nullifier);
  if (permitHolder && permitHolder !== ethers.ZeroAddress) {
    const alreadyRegistered = await vault.isParticipantRegistered(BigInt(trialId), permitHolder);
    if (alreadyRegistered) return;
  }
  const tx = await vault.registerAnonymousParticipant(BigInt(trialId), nullifier);
  await tx.wait();
}

export async function claimRewardsWithSignature(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint,
  destination: string,
  units: number,
  balanceSig: string,
  balance: bigint
) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.claimParticipantRewards(
    BigInt(trialId),
    nullifier,
    destination,
    units,
    balanceSig,
    balance
  );
  await tx.wait();
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
  totalDepositedWei: bigint;
  totalFunded: string;
  participantCount: number;
  screeningDistributed: boolean;
  reclaimFinalized: boolean;
  trialEnded: boolean;
  canReclaim: boolean;
  /** Exact when no participants; otherwise use on-chain reclaim for the true remainder. */
  reclaimableWei: bigint;
  reclaimableEth: string;
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

  const [totalDepositedWei, participantCountBn, screeningDistributed, reclaimFinalized] =
    await Promise.all([
      vault.getTotalDeposited(tid),
      vault.getParticipantCount(tid),
      vault.isDistributed(tid),
      vault.reclaimFinalized(tid),
    ]);

  const participantCount = Number(participantCountBn);
  const noParticipants = participantCount === 0;
  const reclaimableWei =
    totalDepositedWei > 0n && !reclaimFinalized && noParticipants ? totalDepositedWei : 0n;

  const canReclaim =
    trialEnded &&
    !reclaimFinalized &&
    totalDepositedWei > 0n &&
    (screeningDistributed || noParticipants);

  return {
    totalDepositedWei,
    totalFunded: ethers.formatEther(totalDepositedWei),
    participantCount,
    screeningDistributed,
    reclaimFinalized,
    trialEnded,
    canReclaim,
    reclaimableWei,
    reclaimableEth: ethers.formatEther(reclaimableWei),
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

  const [funded, distributed, rawMilestones, reclaim] = await Promise.all([
    vault.getTotalDeposited(trialId),
    vault.isDistributed(trialId),
    mm.getMilestones(trialId),
    getTrialPoolReclaimStatus(signer, trialId, trialEndTimeSec),
  ]);

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
    totalFunded: ethers.formatEther(funded),
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
  const patientAddress = await engine.decryptPermitHolder(BigInt(nullifier));
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
  const participant = await engine.decryptPermitHolder(BigInt(nullifier));
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
