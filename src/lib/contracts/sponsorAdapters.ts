import { ethers } from "ethers";
import {
  getEligibilityEngine,
  getConfidentialETH,
  getSponsorIncentiveVault,
  getSponsorRegistry,
  getTrialMilestoneManager,
  getTrialManager,
} from "./index";
import { encryptUint64, ensureZamaConnected } from "../fhe";
import {
  generateEphemeralAddress,
  signClaimAuthorization,
  signRegisterAuthorization,
  getEphemeralSigner,
} from "../semaphore";
import { resolveChainIdFrom } from "./index";
import { buildWithdrawToAuthorization, computeEncryptedAmountCommitment } from "../withdrawFlow";
import {
  fetchPendingRegisterAuthFromRelayer,
  getPendingRegisterAuthLocal,
  submitVaultRegisterAuth,
  type PendingRegisterAuth,
} from "../pendingRegisterAuth";
import {
  createPendingMilestoneAuthorization,
  resolvePendingMilestoneAuth,
} from "../pendingMilestoneAuth";
import { completeMilestoneSigned } from "../milestoneAuth";
import {
  parseParticipantCreditFailures,
  type ParticipantCreditFailure,
} from "../vaultDistributionEvents";
import type { Identity } from "@semaphore-protocol/identity";

export type { ParticipantCreditFailure };

async function resolveDecryptPermitHolder(
  engine: ReturnType<typeof getEligibilityEngine>,
  provider: ethers.Provider,
  trialId: bigint,
  nullifier: bigint,
  identity?: Identity
): Promise<string> {
  if (identity) {
    const ephemeralSigner = getEphemeralSigner(identity, provider);
    return engine.connect(ephemeralSigner).getDecryptPermitHolder(nullifier, trialId);
  }
  return engine.getDecryptPermitHolder(nullifier, trialId);
}

/** Reward pool + payout keys are keyed by EligibilityEngine permit holder, not the main wallet. */
export async function resolveParticipantRewardAddress(
  signer: ethers.Signer | ethers.Provider,
  trialId: string,
  nullifier: bigint,
  identity?: Identity,
): Promise<string> {
  // Anonymous patients: permit holder is always the deterministic ephemeral address
  // from apply time. Avoid getDecryptPermitHolder here — it reverts unless msg.sender
  // is the holder or an authorized protocol contract.
  if (identity) {
    return ethers.getAddress(await generateEphemeralAddress(identity));
  }

  const provider = "provider" in signer ? signer.provider : signer;
  if (!provider) throw new Error("Wallet provider not available");
  const engine = getEligibilityEngine(signer);
  const addr = await resolveDecryptPermitHolder(engine, provider, BigInt(trialId), nullifier);
  if (!addr || addr === ethers.ZeroAddress) {
    throw new Error("No reward participant address found for this application.");
  }
  return ethers.getAddress(addr);
}

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

async function resolvePendingRegisterAuth(
  trialId: bigint,
  nullifier: bigint,
  relayerBaseUrl?: string
): Promise<PendingRegisterAuth | null> {
  const local = getPendingRegisterAuthLocal(trialId, nullifier);
  if (local) return local;
  try {
    return await fetchPendingRegisterAuthFromRelayer(trialId, nullifier, relayerBaseUrl);
  } catch {
    return null;
  }
}

/**
 * Anonymous permit holder for sponsor-side flows. Sponsors cannot call
 * `getDecryptPermitHolder` directly — use pre-signed register auth when available,
 * otherwise staticCall as SponsorIncentiveVault (an authorized reader).
 */
export async function resolveAnonymousPermitHolder(
  signer: ethers.Signer | ethers.Provider,
  trialId: bigint,
  nullifier: bigint,
  options?: { relayerBaseUrl?: string }
): Promise<string> {
  const auth = await resolvePendingRegisterAuth(trialId, nullifier, options?.relayerBaseUrl);
  if (auth?.permitHolder) return ethers.getAddress(auth.permitHolder);

  const provider = "provider" in signer && signer.provider ? signer.provider : (signer as ethers.Provider);
  const vault = getSponsorIncentiveVault(provider);
  const engine = getEligibilityEngine(provider);
  const vaultAddress = await vault.getAddress();
  const holder = await engine.getDecryptPermitHolder.staticCall(nullifier, trialId, {
    from: vaultAddress,
  });
  if (!holder || holder === ethers.ZeroAddress) {
    throw new Error("No anonymous permit holder found for this application.");
  }
  return ethers.getAddress(holder);
}

/**
 * After sponsor accepts an anonymous applicant, enroll using the patient's pre-signed
 * register authorization from apply time (MED-3 consent preserved via EIP-712).
 * Best-effort: does not throw if pool unfunded or auth missing.
 */
export async function enrollAcceptedParticipantWithPreAuth(
  signer: ethers.Signer,
  trialId: string,
  nullifier: string | bigint,
  options?: { relayerBaseUrl?: string }
): Promise<{ enrolled: boolean; txHash?: string; reason?: string }> {
  const tid = BigInt(trialId);
  const nullifierBn = BigInt(nullifier);

  const vault = getSponsorIncentiveVault(signer);
  const auth = await resolvePendingRegisterAuth(tid, nullifierBn, options?.relayerBaseUrl);
  if (!auth) {
    return { enrolled: false, reason: "No pre-signed enrollment authorization found." };
  }

  const permitHolder = ethers.getAddress(auth.permitHolder);
  const alreadyRegistered = await vault.isParticipantRegistered(tid, permitHolder);
  if (alreadyRegistered) {
    return { enrolled: true, reason: "Already registered in incentive pool." };
  }

  try {
    const txHash = await submitVaultRegisterAuth(signer, auth);
    if (txHash == null) {
      return { enrolled: true, reason: "Already registered in incentive pool." };
    }
    return { enrolled: true, txHash };
  } catch (err: unknown) {
    const msg =
      (err as { reason?: string; message?: string })?.reason ||
      (err as Error)?.message ||
      "Enrollment failed";
    return { enrolled: false, reason: msg };
  }
}

/**
 * Gap-fill enrollment before staging: only enrolls participants who were accepted
 * but are not yet registered (e.g. pool was unfunded at accept time). Skips anyone
 * already enrolled at accept time — no duplicate registration txs.
 */
export async function enrollUnregisteredAcceptedParticipants(
  signer: ethers.Signer,
  trialId: string,
  nullifiers: Array<string | undefined | null>,
): Promise<{ enrolled: number; alreadyRegistered: number; failed: number }> {
  let enrolled = 0;
  let alreadyRegistered = 0;
  let failed = 0;

  for (const nullifier of nullifiers) {
    if (!nullifier) continue;
    const result = await enrollAcceptedParticipantWithPreAuth(signer, trialId, nullifier);
    if (result.enrolled) {
      if (result.txHash) enrolled += 1;
      else alreadyRegistered += 1;
    } else {
      failed += 1;
    }
  }

  return { enrolled, alreadyRegistered, failed };
}

/** @deprecated Use enrollUnregisteredAcceptedParticipants — same behavior, clearer name. */
export const enrollAllAcceptedParticipantsForTrial = enrollUnregisteredAcceptedParticipants;

export async function registerAnonymousParticipantByNullifier(
  signer: ethers.Signer,
  trialId: string,
  nullifier: bigint,
  identity?: Identity
) {
  const vault = getSponsorIncentiveVault(signer);
  const engine = getEligibilityEngine(signer);
  const provider = signer.provider;
  if (!provider) throw new Error("Wallet provider not available");
  const permitHolder = await resolveDecryptPermitHolder(
    engine,
    provider,
    BigInt(trialId),
    nullifier,
    identity
  );
  if (permitHolder && permitHolder !== ethers.ZeroAddress) {
    const alreadyRegistered = await vault.isParticipantRegistered(BigInt(trialId), permitHolder);
    if (alreadyRegistered) return;
  }
  const signerAddress = await signer.getAddress();

  if (permitHolder && permitHolder.toLowerCase() !== signerAddress.toLowerCase()) {
    const pending = getPendingRegisterAuthLocal(BigInt(trialId), nullifier);
    if (pending) {
      await submitVaultRegisterAuth(signer, pending);
      return;
    }
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
  const provider = signer.provider;
  if (!provider) throw new Error("Wallet provider not available");
  const permitHolder = await resolveDecryptPermitHolder(
    engine,
    provider,
    BigInt(trialId),
    nullifier,
    identity
  );
  if (!permitHolder || permitHolder === ethers.ZeroAddress) {
    throw new Error("No reward permit holder found for this claim.");
  }
  await ensureZamaConnected(provider, signer);
  const encrypted = await encryptUint64(cEthAddress, vaultAddress, units);
  const encryptedAmountCommitment = computeEncryptedAmountCommitment(
    encrypted.handle,
    encrypted.inputProof
  );

  const signerAddress = await signer.getAddress();
  if (permitHolder.toLowerCase() !== signerAddress.toLowerCase()) {
    if (!identity) {
      throw new Error("Semaphore identity required for gasless ephemeral reward claim.");
    }
    const chainId = await resolveChainIdFrom(signer);
    const nonce = BigInt(Date.now());
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const ephemeralSigner = getEphemeralSigner(identity, provider);
    const withdrawTo = await buildWithdrawToAuthorization(
      ephemeralSigner,
      destination,
      encrypted
    );
    const signature = await signClaimAuthorization(identity, provider, {
      vaultAddress,
      chainId,
      trialId: BigInt(trialId),
      nullifier,
      permitHolder,
      destination,
      units: BigInt(units),
      encryptedAmountCommitment,
      nonce,
      deadline,
    });
    const tx = await vault.claimParticipantRewardsFor(
      BigInt(trialId),
      nullifier,
      permitHolder,
      destination,
      BigInt(units),
      encryptedAmountCommitment,
      encrypted.handle,
      encrypted.inputProof,
      nonce,
      deadline,
      signature,
      withdrawTo.nonce,
      withdrawTo.deadline,
      withdrawTo.signature
    );
    await tx.wait();
    return;
  }

  const withdrawTo = await buildWithdrawToAuthorization(signer, destination, encrypted);
  const tx = await vault.claimParticipantRewards(
    BigInt(trialId),
    nullifier,
    destination,
    encrypted.handle,
    encrypted.inputProof,
    withdrawTo.nonce,
    withdrawTo.deadline,
    withdrawTo.signature
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
  gracePeriodElapsed: boolean;
  sponsorVerified: boolean;
  canReclaimHint: boolean;
  sponsorAuthorized: boolean;
  vaultOwnerAuthorized: boolean;
  canAbandonedReclaim: boolean;
  trialSponsor: string | null;
  totalDepositedWei: string | null;
  totalFunded: string | null;
  canReclaim: boolean | null;
  reclaimableWei: string | null;
  reclaimableEth: string | null;
  pendingReclaimWei: string | null;
  pendingReclaimEth: string | null;
  pendingReclaimRecipient: string | null;
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

  const [participantCountBn, screeningDistributed, reclaimFinalized, poolFunded, pendingReclaimWeiBn, pendingRecipient] =
    await Promise.all([
      vault.getParticipantCount(tid),
      vault.isDistributed(tid),
      vault.reclaimFinalized(tid),
      vault.isPoolFunded(tid),
      vault.pendingReclaimWei(tid),
      vault.pendingReclaimRecipient(tid),
    ]);

  const participantCount = Number(participantCountBn);
  const noParticipants = participantCount === 0;
  const nowSec = Math.floor(Date.now() / 1000);
  let gracePeriodSec = 90 * 24 * 60 * 60;
  try {
    gracePeriodSec = Number(await vault.RECLAIM_GRACE_PERIOD());
  } catch {
    /* use default */
  }
  const gracePeriodElapsed =
    noParticipants || (endSec > 0 && nowSec >= endSec + gracePeriodSec);
  const privacyNote =
    "Pool amounts are sponsor-private on-chain. Public callers only see whether a pool is funded.";

  const pendingReclaimWei =
    pendingReclaimWeiBn > 0n ? pendingReclaimWeiBn.toString() : null;
  const pendingReclaimEth =
    pendingReclaimWeiBn > 0n ? ethers.formatEther(pendingReclaimWeiBn) : null;
  const pendingReclaimRecipient =
    pendingRecipient !== ethers.ZeroAddress ? pendingRecipient : null;

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

  let sponsorVerified = true;
  if (trialSponsor) {
    try {
      const registry = getSponsorRegistry(signer);
      sponsorVerified = await registry.isVerifiedSponsor(trialSponsor);
    } catch {
      sponsorVerified = true;
    }
  }

  let vaultOwnerAuthorized = false;
  if (signerAddress) {
    try {
      const vaultOwner = String(await vault.owner()).toLowerCase();
      vaultOwnerAuthorized = signerAddress === vaultOwner;
    } catch {
      vaultOwnerAuthorized = false;
    }
  }

  const sponsorAuthorized = Boolean(
    signerAddress && trialSponsor && signerAddress === trialSponsor
  );

  const canReclaimHint =
    trialEnded && !reclaimFinalized && poolFunded && (screeningDistributed || noParticipants);

  const canAbandonedReclaim =
    vaultOwnerAuthorized &&
    trialEnded &&
    gracePeriodElapsed &&
    poolFunded &&
    !reclaimFinalized &&
    trialSponsor != null &&
    !sponsorVerified &&
    pendingReclaimWeiBn === 0n;

  const shared = {
    poolFunded,
    participantCount,
    screeningDistributed,
    reclaimFinalized,
    trialEnded,
    gracePeriodElapsed,
    sponsorVerified,
    canReclaimHint,
    vaultOwnerAuthorized,
    canAbandonedReclaim,
    trialSponsor,
    pendingReclaimWei,
    pendingReclaimEth,
    pendingReclaimRecipient,
    privacyNote,
  };

  if (!sponsorAuthorized) {
    return {
      ...shared,
      sponsorAuthorized: false,
      totalDepositedWei: null,
      totalFunded: null,
      canReclaim: null,
      reclaimableWei: null,
      reclaimableEth: null,
      amountsRestrictedReason: "Connected signer is not the trial sponsor",
    };
  }

  const totalDepositedWei = await vault.getTotalDeposited(tid);
  const reclaimableWei =
    totalDepositedWei > 0n && !reclaimFinalized && noParticipants ? totalDepositedWei : 0n;
  const canReclaim =
    sponsorVerified &&
    trialEnded &&
    !reclaimFinalized &&
    totalDepositedWei > 0n &&
    (screeningDistributed || noParticipants);

  return {
    ...shared,
    sponsorAuthorized: true,
    totalDepositedWei: totalDepositedWei.toString(),
    totalFunded: ethers.formatEther(totalDepositedWei),
    canReclaim,
    reclaimableWei: reclaimableWei.toString(),
    reclaimableEth: ethers.formatEther(reclaimableWei),
    amountsRestrictedReason: null,
  };
}

/**
 * Sponsor-only pool size via eth_call with `from: sponsor` (no wallet signer required in UI).
 * Returns wei string, or null when the caller is not the trial sponsor / call reverts.
 */
export async function fetchSponsorPoolDepositedWei(
  provider: ethers.Provider,
  trialId: string | number | bigint,
  sponsorAddress: string
): Promise<string | null> {
  if (!sponsorAddress || !ethers.isAddress(sponsorAddress)) return null;
  try {
    const vault = getSponsorIncentiveVault(provider);
    const wei = await vault.getTotalDeposited.staticCall(BigInt(trialId), {
      from: ethers.getAddress(sponsorAddress),
    });
    return wei.toString();
  } catch {
    return null;
  }
}

export async function reclaimUndistributedPool(
  signer: ethers.Signer,
  trialId: string
): Promise<{ scheduled: true; txHash: string }> {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.reclaimUndistributed(BigInt(trialId));
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Reclaim schedule transaction failed");
  return { scheduled: true, txHash: receipt.hash };
}

/** Owner-only: recover pool when trial sponsor was removed from SponsorRegistry (HIGH-1 / P2). */
export async function reclaimAbandonedToOwnerPool(
  signer: ethers.Signer,
  trialId: string
): Promise<{ scheduled: true; txHash: string }> {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.reclaimAbandonedToOwner(BigInt(trialId));
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Abandoned reclaim schedule transaction failed");
  return { scheduled: true, txHash: receipt.hash };
}

export async function claimReclaimedPool(
  signer: ethers.Signer,
  trialId: string
): Promise<{ txHash: string }> {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.claimReclaimed(BigInt(trialId));
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Claim reclaimed transaction failed");
  return { txHash: receipt.hash };
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
  decisionMessage: string,
  nullifier?: string | bigint
) {
  const engine = getEligibilityEngine(signer);
  const hexMessage = ethers.hexlify(ethers.toUtf8Bytes(decisionMessage || "No message provided"));
  const tx = await engine.updateApplicationStatus(trialId, patientAddress, newStatus, hexMessage);
  await tx.wait();

  if (newStatus === 2 && nullifier) {
    await enrollAcceptedParticipantWithPreAuth(signer, trialId, nullifier);
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
): Promise<{ txHash: string; creditFailures: ParticipantCreditFailure[] }> {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.distributePartialPaginated(trialId, milestoneIndex, 0, 50);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Distribution transaction failed");
  const creditFailures = parseParticipantCreditFailures(receipt, await vault.getAddress());
  return { txHash: receipt.hash, creditFailures };
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

async function resolveMilestonePatientSignature(
  sponsorSigner: ethers.Signer,
  trialId: string,
  patientAddress: string,
  milestoneIndex: number,
  options?: { nullifier?: string | bigint; relayerBaseUrl?: string }
): Promise<{ signature: string; deadline: bigint }> {
  const mm = getTrialMilestoneManager(sponsorSigner);
  const milestones = await mm.getMilestones(trialId);
  if (milestoneIndex >= milestones.length) {
    throw new Error(`Milestone ${milestoneIndex + 1} is not configured for this trial.`);
  }

  if (options?.nullifier !== undefined) {
    const auth = await resolvePendingMilestoneAuth(
      BigInt(trialId),
      BigInt(options.nullifier),
      milestoneIndex,
      options.relayerBaseUrl
    );
    if (auth) {
      return {
        signature: auth.signature,
        deadline: BigInt(auth.deadline),
      };
    }
    throw new Error(
      "No milestone promotion authorization found for this anonymous participant. " +
        "Ask the patient to open My Applications on the same browser profile used to apply and sync milestone authorization."
    );
  }

  const sponsorAddress = await sponsorSigner.getAddress();
  if (sponsorAddress.toLowerCase() === patientAddress.toLowerCase()) {
    const auth = await createPendingMilestoneAuthorization(
      sponsorSigner,
      BigInt(trialId),
      0n,
      patientAddress,
      milestoneIndex
    );
    return {
      signature: auth.signature,
      deadline: BigInt(auth.deadline),
    };
  }

  throw new Error(
    "Patient signature required to promote this participant. " +
      "The patient must authorize milestone completion from their wallet or anonymous profile."
  );
}

export async function promoteParticipantAndDistribute(
  signer: ethers.Signer,
  trialId: string,
  patientAddress: string,
  milestoneIndex: number,
  options?: { nullifier?: string | bigint; relayerBaseUrl?: string }
) {
  const vault = getSponsorIncentiveVault(signer);
  const mm = getTrialMilestoneManager(signer);
  let currentProgress = Number(await mm.getParticipantProgress(trialId, patientAddress));
  const alreadyPaid = await vault.participantMilestonePaid(trialId, patientAddress, milestoneIndex);

  if (currentProgress <= milestoneIndex) {
    for (let idx = currentProgress; idx <= milestoneIndex; idx++) {
      const { signature, deadline } = await resolveMilestonePatientSignature(
        signer,
        trialId,
        patientAddress,
        idx,
        options
      );
      await completeMilestoneSigned(signer, trialId, patientAddress, idx, signature, deadline);
      currentProgress = idx + 1;
    }
  }

  return {
    alreadyPaid,
    promoted: true,
    progress: Math.max(currentProgress, milestoneIndex + 1),
  };
}

export async function promoteAnonymousParticipantAndDistribute(
  signer: ethers.Signer,
  trialId: string,
  nullifier: string | bigint,
  milestoneIndex: number,
  options?: { relayerBaseUrl?: string }
) {
  const patientAddress = await resolveAnonymousPermitHolder(
    signer,
    BigInt(trialId),
    BigInt(nullifier),
    options
  );

  return promoteParticipantAndDistribute(signer, trialId, patientAddress, milestoneIndex, {
    nullifier,
    relayerBaseUrl: options?.relayerBaseUrl,
  });
}

export async function pruneUnconfirmedSlots(
  signer: ethers.Signer,
  trialId: string,
  milestoneIndex: number
): Promise<{ txHash: string }> {
  const vault = getSponsorIncentiveVault(signer);
  const tx = await vault.pruneUnconfirmedSlots(BigInt(trialId), milestoneIndex);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("pruneUnconfirmedSlots transaction failed");
  return { txHash: receipt.hash };
}

export async function getParticipantPayoutStatus(
  signer: ethers.Signer | ethers.Provider,
  trialId: string,
  participantAddress: string,
  milestoneIndex: number
) {
  const vault = getSponsorIncentiveVault(signer);
  const tid = BigInt(trialId);
  const idx = BigInt(milestoneIndex);
  const [entitlementStaged, confirmedPayout, stagedShareWei] = await Promise.all([
    vault.entitlementStaged(tid, participantAddress, idx),
    vault.confirmedPayout(tid, participantAddress, idx),
    vault.getStagedShareWei(tid, participantAddress, idx),
  ]);
  return {
    entitlementStaged: Boolean(entitlementStaged),
    confirmedPayout: Boolean(confirmedPayout),
    stagedShareWei: BigInt(stagedShareWei),
  };
}

export async function getAnonymousParticipantMilestoneState(
  signer: ethers.Signer,
  trialId: string,
  nullifier: string | bigint,
  milestoneCount: number,
  options?: { relayerBaseUrl?: string }
) {
  const vault = getSponsorIncentiveVault(signer);
  const mm = getTrialMilestoneManager(signer);
  const participant = await resolveAnonymousPermitHolder(
    signer,
    BigInt(trialId),
    BigInt(nullifier),
    options
  );

  const [registered, progress, staged, confirmed] = await Promise.all([
    vault.isParticipantRegistered(BigInt(trialId), participant),
    mm.getParticipantProgress(trialId, participant),
    Promise.all(
      Array.from({ length: milestoneCount }, (_, index) =>
        vault.entitlementStaged(BigInt(trialId), participant, index)
      )
    ),
    Promise.all(
      Array.from({ length: milestoneCount }, (_, index) =>
        vault.confirmedPayout(BigInt(trialId), participant, index)
      )
    ),
  ]);

  const stagedFlags = staged.map(Boolean);
  const confirmedFlags = confirmed.map(Boolean);

  return {
    participant,
    registered: Boolean(registered),
    progress: Number(progress),
    staged: stagedFlags,
    confirmed: confirmedFlags,
    paid: confirmedFlags,
  };
}
