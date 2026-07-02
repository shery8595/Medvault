import { ethers } from "ethers";

import { getSponsorIncentiveVault } from "./contracts";
import { ensureZamaConnected, publicDecrypt } from "./fhe";

export type ParticipantReceiptStatus = {
  entitlementStaged: boolean;
  confirmedPayout: boolean;
  stagedShareWei: bigint;
  challengeDeadline: bigint;
  challengeOpen: boolean;
};

export async function getParticipantReceiptStatus(
  signer: ethers.Signer | ethers.Provider,
  trialId: string,
  participantAddress: string,
  milestoneIndex: number
): Promise<ParticipantReceiptStatus> {
  const vault = getSponsorIncentiveVault(signer);
  const tid = BigInt(trialId);
  const idx = BigInt(milestoneIndex);
  const [entitlementStaged, confirmedPayout, stagedShareWei, challengeDeadline, challengeOpen] =
    await Promise.all([
      vault.entitlementStaged(tid, participantAddress, idx),
      vault.confirmedPayout(tid, participantAddress, idx),
      vault.getStagedShareWei(tid, participantAddress, idx),
      vault.challengeDeadline(tid, participantAddress),
      vault.challengeOpen(tid, participantAddress),
    ]);
  return {
    entitlementStaged: Boolean(entitlementStaged),
    confirmedPayout: Boolean(confirmedPayout),
    stagedShareWei: BigInt(stagedShareWei),
    challengeDeadline: BigInt(challengeDeadline),
    challengeOpen: Boolean(challengeOpen),
  };
}

/**
 * Confirm a staged milestone entitlement: prepareEntitlementProof → KMS public decrypt → confirmReceipt.
 * Vault txs are sent from the ephemeral permit holder; FHE public decrypt uses the connected main wallet SDK.
 */
export async function confirmStagedEntitlementReceipt(
  fheSigner: ethers.Signer,
  ephemeralSigner: ethers.Signer,
  trialId: string,
  milestoneIndex: number,
  onProgress?: (message: string) => void
): Promise<{ confirmTxHash: string; skipped: boolean }> {
  const provider = ephemeralSigner.provider ?? fheSigner.provider;
  if (!provider) throw new Error("Wallet provider not available");

  const vault = getSponsorIncentiveVault(ephemeralSigner);
  const tid = BigInt(trialId);
  const idx = BigInt(milestoneIndex);
  const participantAddr = await ephemeralSigner.getAddress();

  const already = await vault.confirmedPayout(tid, participantAddr, idx);
  if (already) {
    return { confirmTxHash: "", skipped: true };
  }

  const staged = await vault.entitlementStaged(tid, participantAddr, idx);
  if (!staged) {
    throw new Error(`No staged entitlement for milestone ${milestoneIndex}.`);
  }

  onProgress?.("Preparing entitlement proof on-chain…");
  const prepareTx = await vault.prepareEntitlementProof(tid, idx);
  const prepareRc = await prepareTx.wait();
  if (!prepareRc) throw new Error("prepareEntitlementProof failed");

  onProgress?.("Fetching KMS decryption proof…");
  await ensureZamaConnected(provider, fheSigner);

  const entitlement = await vault.getStagedEntitlement(tid, participantAddr, idx);
  const handle = BigInt(entitlement);
  if (handle === 0n) {
    throw new Error("Staged entitlement handle missing after prepareEntitlementProof.");
  }

  const { value, cleartexts, proof } = await publicDecrypt(handle);
  if (value === 0n) {
    throw new Error("Entitlement proof shows you are not eligible for this payout.");
  }

  onProgress?.("Submitting confirmReceipt…");
  const confirmTx = await vault.confirmReceipt(tid, idx, cleartexts, proof);
  const confirmRc = await confirmTx.wait();
  if (!confirmRc) throw new Error("confirmReceipt failed");

  return { confirmTxHash: confirmRc.hash, skipped: false };
}

/** Confirm every staged-but-unconfirmed milestone up to `maxMilestones`. */
export async function confirmAllPendingReceipts(
  fheSigner: ethers.Signer,
  ephemeralSigner: ethers.Signer,
  trialId: string,
  maxMilestones = 12,
  onProgress?: (message: string) => void
): Promise<string[]> {
  const vault = getSponsorIncentiveVault(fheSigner);
  const tid = BigInt(trialId);
  const participantAddr = await ephemeralSigner.getAddress();
  const txHashes: string[] = [];

  for (let i = 0; i < maxMilestones; i++) {
    const [staged, confirmed] = await Promise.all([
      vault.entitlementStaged(tid, participantAddr, i),
      vault.confirmedPayout(tid, participantAddr, i),
    ]);
    if (!staged || confirmed) continue;

    const { confirmTxHash } = await confirmStagedEntitlementReceipt(
      fheSigner,
      ephemeralSigner,
      trialId,
      i,
      onProgress
    );
    if (confirmTxHash) txHashes.push(confirmTxHash);
  }

  return txHashes;
}

export const CHALLENGE_WINDOW_SECS = 7 * 24 * 60 * 60;
