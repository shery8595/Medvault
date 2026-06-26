import { ethers } from "ethers";
import {
  getEligibilityEngine,
  getSponsorIncentiveVault,
  getTrialMilestoneManager,
  getTrialManager,
} from "../contracts/index.js";

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

export async function distributePartialMilestone(
  signer: ethers.Signer,
  trialId: string,
  milestoneIndex: number
) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.distributePartialPaginated(trialId, milestoneIndex, 0, 50);
  await tx.wait();
}

export async function registerAnonymousParticipantByNullifier(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint
) {
  const vault = getSponsorIncentiveVault(signer);
  const engine = getEligibilityEngine(signer);
  const permitHolder = await engine.getDecryptPermitHolder(nullifier, BigInt(trialId));
  if (permitHolder && permitHolder !== ethers.ZeroAddress) {
    const alreadyRegistered = await vault.isParticipantRegistered(BigInt(trialId), permitHolder);
    if (alreadyRegistered) return;
  }
  const tx = await vault.registerAnonymousParticipant(BigInt(trialId), nullifier);
  await tx.wait();
}

export async function reclaimUndistributedPool(signer: ethers.Signer, trialId: string) {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.reclaimUndistributed(BigInt(trialId));
  await tx.wait();
}

export type TrialPoolReclaimStatus = {
  poolFunded: boolean;
  participantCount: number;
  screeningDistributed: boolean;
  reclaimFinalized: boolean;
  trialEnded: boolean;
  /** Coarse hint without sponsor authorization */
  canReclaimHint: boolean;
  sponsorAuthorized: boolean;
  trialSponsor: string | null;
  /** Sponsor-only; null when unauthorized */
  totalDepositedWei: string | null;
  totalFunded: string | null;
  canReclaim: boolean | null;
  reclaimableWei: string | null;
  reclaimableEth: string | null;
  amountsRestrictedReason: string | null;
  privacyNote: string;
};

async function resolveSignerAddress(
  signerOrProvider: ethers.Signer | ethers.Provider
): Promise<string | null> {
  if (!("getAddress" in signerOrProvider) || typeof signerOrProvider.getAddress !== "function") {
    return null;
  }
  try {
    return (await signerOrProvider.getAddress()).toLowerCase();
  } catch {
    return null;
  }
}

export async function getTrialPoolReclaimStatus(
  signerOrProvider: ethers.Signer | ethers.Provider,
  trialId: string,
  trialEndTimeSec?: string | number | null
): Promise<TrialPoolReclaimStatus> {
  const vault = getSponsorIncentiveVault(signerOrProvider);
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

  let trialSponsor: string | null = null;
  try {
    const tm = getTrialManager(signerOrProvider);
    const trial = await tm.getTrial(tid);
    trialSponsor = String(trial.sponsor).toLowerCase();
  } catch {
    /* trial may not exist */
  }

  const signerAddress = await resolveSignerAddress(signerOrProvider);
  const sponsorAuthorized =
    Boolean(signerAddress && trialSponsor && signerAddress === trialSponsor);

  const canReclaimHint =
    trialEnded && !reclaimFinalized && poolFunded && (screeningDistributed || noParticipants);

  const privacyNote =
    "Pool amounts are sponsor-private on-chain. Public callers only see whether a pool is funded.";

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
      amountsRestrictedReason: signerAddress
        ? "Connected signer is not the trial sponsor; exact amounts are withheld"
        : "MCP_PRIVATE_KEY not set or signer unavailable; exact amounts are withheld",
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

export async function deactivateTrial(signer: ethers.Signer, trialId: string) {
  const tm = getTrialManager(signer);
  const tx = await tm.deactivateTrial(BigInt(trialId));
  await tx.wait();
}
