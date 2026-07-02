import { ethers } from "ethers";

import { getConfidentialETH, getEligibilityEngine, getSponsorIncentiveVault } from "./contracts";

import { fetchCompletionProof, signCompletionProofRequest } from "./relayer";

import { encryptUint64, ensureZamaConnected, reencryptUint64WithEphemeral } from "./fhe";

import { parseEventArg } from "./contractEvents";

import { txExplorerUrl } from "./network";

import { signClaimAuthorization, getEphemeralSigner } from "./semaphore";

import { resolveChainIdFrom } from "./contracts";

import { buildWithdrawToAuthorization, computeEncryptedAmountCommitment } from "./withdrawFlow";
import { confirmAllPendingReceipts } from "./confirmReceiptFlow";

export type ClaimWizardStep =
  | "preview"
  | "destination"
  | "confirming"
  | "claiming"
  | "relayer"
  | "receipt"
  | "error";

export type ClaimProgress = {
  step: ClaimWizardStep;
  message: string;
  confirmTxHash?: string;
  claimTxHash?: string;
  completeTxHash?: string;
};



function parseWithdrawToHandle(receipt: ethers.TransactionReceipt, cEthAddress: string): string | null {

  const iface = new ethers.Interface([

    "event WithdrawToRequested(address indexed user, bytes32 transferableHandle)",

  ]);

  for (const log of receipt.logs) {

    if (log.address.toLowerCase() !== cEthAddress.toLowerCase()) continue;

    try {

      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });

      if (parsed?.name === "WithdrawToRequested") {

        return String(parsed.args.transferableHandle);

      }

    } catch {

      /* skip */

    }

  }

  return null;

}



async function waitForDestinationCredit(

  provider: ethers.Provider,

  destination: string,

  beforeWei: bigint,

  timeoutMs = 90_000

): Promise<boolean> {

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {

    const after = await provider.getBalance(destination);

    if (after > beforeWei) return true;

    await new Promise((r) => setTimeout(r, 3_000));

  }

  return false;

}



/**
 * confirmReceipt (pull) → claimParticipantRewards → relayer/watcher completeWithdrawTo → ETH at destination.
 */

export async function claimRewardsWithCompletion(

  signer: ethers.Signer,

  trialId: string,

  nullifier: bigint,

  destination: string,

  units: number,

  onProgress?: (p: ClaimProgress) => void,

  identity?: import("@semaphore-protocol/identity").Identity

): Promise<{ claimTxHash: string; completeTxHash?: string; credited: boolean }> {

  const provider = signer.provider;

  if (!provider) throw new Error("Wallet provider not available");

  let claimUnits = units;



  const vault = getSponsorIncentiveVault(signer);

  const cETH = getConfidentialETH(signer);

  const cEthAddress = await cETH.getAddress();

  const vaultAddress = await vault.getAddress();

  const engine = getEligibilityEngine(signer);

  const permitHolder = await engine.getDecryptPermitHolder(nullifier, BigInt(trialId));

  if (!permitHolder || permitHolder === ethers.ZeroAddress) {

    throw new Error("No reward permit holder found for this anonymous application.");

  }



  const signerAddress = await signer.getAddress();

  const gasless = permitHolder.toLowerCase() !== signerAddress.toLowerCase();

  if (identity) {
    const ephemeralSigner = getEphemeralSigner(identity, provider);
    onProgress?.({
      step: "confirming",
      message: "Confirming staged entitlements before claim…",
    });
    const confirmTxHashes = await confirmAllPendingReceipts(
      signer,
      ephemeralSigner,
      trialId,
      12,
      (message) => onProgress?.({ step: "confirming", message })
    );
    if (confirmTxHashes.length > 0) {
      onProgress?.({
        step: "confirming",
        message: `Receipt confirmed (${confirmTxHashes.length} milestone${confirmTxHashes.length > 1 ? "s" : ""}).`,
        confirmTxHash: confirmTxHashes[confirmTxHashes.length - 1],
      });
    }

    const ephemeralAddress = await ephemeralSigner.getAddress();
    const balanceHandle = await cETH.getBalance(ephemeralAddress);
    const balanceStr = balanceHandle.toString();
    if (balanceStr && BigInt(balanceStr) !== 0n) {
      const decrypted = await reencryptUint64WithEphemeral(
        ephemeralSigner,
        cEthAddress,
        balanceStr
      );
      claimUnits = Number(decrypted);
    }
  }

  if (claimUnits <= 0) {
    throw new Error("No confidential balance to claim after receipt confirmation.");
  }

  onProgress?.({
    step: "claiming",
    message: gasless
      ? "Signing claim + withdraw-to authorizations with ephemeral key…"
      : "Signing withdraw-to authorization and submitting claim…",
  });



  const beforeWei = await provider.getBalance(destination);

  await ensureZamaConnected(provider, signer);

  const encrypted = await encryptUint64(cEthAddress, vaultAddress, claimUnits);

  const encryptedAmountCommitment = computeEncryptedAmountCommitment(
    encrypted.handle,
    encrypted.inputProof
  );



  let claimTx: ethers.ContractTransactionResponse;

  if (gasless) {

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

      units: BigInt(claimUnits),

      encryptedAmountCommitment,

      nonce,

      deadline,

    });

    claimTx = await vault.claimParticipantRewardsFor(

      BigInt(trialId),

      nullifier,

      permitHolder,

      destination,

      BigInt(claimUnits),

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

  } else {

    const withdrawTo = await buildWithdrawToAuthorization(signer, destination, encrypted);

    claimTx = await vault.claimParticipantRewards(

      BigInt(trialId),

      nullifier,

      destination,

      encrypted.handle,

      encrypted.inputProof,

      withdrawTo.nonce,

      withdrawTo.deadline,

      withdrawTo.signature

    );

  }



  const claimReceipt = await claimTx.wait();

  if (!claimReceipt) throw new Error("Claim transaction failed");



  const claimTxHash = claimReceipt.hash;

  onProgress?.({

    step: "relayer",

    message: "Waiting for relayer to complete confidential withdraw…",

    claimTxHash,

  });



  const handle = parseWithdrawToHandle(claimReceipt, cEthAddress);

  let completeTxHash: string | undefined;



  if (handle) {

    try {

      const callerSignature = await signCompletionProofRequest(signer, {

        kind: "withdrawTo",

        stageTxHash: claimTxHash,

        user: permitHolder,

        handle,

      });

      const proof = await fetchCompletionProof({

        kind: "withdrawTo",

        stageTxHash: claimTxHash,

        user: permitHolder,

        handle,

        callerSignature,

      });

      if (proof.transferable ?? proof.eligible) {

        const tx = await cETH.completeWithdrawTo(permitHolder, proof.cleartexts, proof.decryptionProof);

        const rc = await tx.wait();

        completeTxHash = rc?.hash;

      }

    } catch {

      /* relayer watcher may complete asynchronously */

    }

  }



  const credited = await waitForDestinationCredit(provider, destination, beforeWei);

  onProgress?.({

    step: credited ? "receipt" : "relayer",

    message: credited

      ? `ETH received at ${destination.slice(0, 8)}… · claim ${claimTxHash.slice(0, 10)}…`

      : "Claim initiated — relayer may still be completing withdraw. Check your wallet shortly.",

    claimTxHash,

    completeTxHash,

  });



  return { claimTxHash, completeTxHash, credited };

}



export { txExplorerUrl };

