import { ethers } from "ethers";

import { getConfidentialETH, getEligibilityEngine, getSponsorIncentiveVault } from "./contracts";

import { fetchCompletionProof } from "./relayer";

import { encryptUint64, ensureZamaConnected, publicDecrypt } from "./fhe";

import { parseEventArg } from "./contractEvents";

import { txExplorerUrl } from "./network";

import { signClaimAuthorization } from "./semaphore";

import { resolveChainIdFrom } from "./contracts";

export type ClaimWizardStep =

  | "preview"

  | "destination"

  | "claiming"

  | "relayer"

  | "receipt"

  | "error";



export type ClaimProgress = {

  step: ClaimWizardStep;

  message: string;

  claimTxHash?: string;

  completeTxHash?: string;

};



function parseWithdrawToHandle(receipt: ethers.TransactionReceipt, cEthAddress: string): string | null {

  const iface = new ethers.Interface([

    "event WithdrawToRequested(address indexed user, bytes32 sufficientHandle)",

  ]);

  for (const log of receipt.logs) {

    if (log.address.toLowerCase() !== cEthAddress.toLowerCase()) continue;

    try {

      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });

      if (parsed?.name === "WithdrawToRequested") {

        return String(parsed.args.sufficientHandle);

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

 * claimParticipantRewards → relayer/watcher completeWithdrawTo → ETH at destination.

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



  onProgress?.({

    step: "claiming",

    message: gasless ? "Signing claim authorization with ephemeral key…" : "Submitting claimParticipantRewards…",

  });



  const beforeWei = await provider.getBalance(destination);

  await ensureZamaConnected(provider, signer);

  const encrypted = await encryptUint64(cEthAddress, vaultAddress, units);



  let claimTx: ethers.ContractTransactionResponse;

  if (gasless) {

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

    claimTx = await vault.claimParticipantRewardsFor(

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

  } else {

    claimTx = await vault.claimParticipantRewards(

      BigInt(trialId),

      nullifier,

      destination,

      encrypted.handle,

      encrypted.inputProof

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

      const proof = await fetchCompletionProof({

        kind: "withdrawTo",

        stageTxHash: claimTxHash,

        user: permitHolder,

        handle,

      });

      if (proof.eligible) {

        const revealTx = await cETH.revealWithdrawToAmount(

          permitHolder,

          proof.cleartexts,

          proof.decryptionProof

        );

        const revealRc = await revealTx.wait();

        if (revealRc) {

          const amountHandle = parseEventArg(

            revealRc,

            cETH.interface,

            cEthAddress,

            "WithdrawAmountRevealed",

            "amountHandle"

          );

          const amount = await publicDecrypt(amountHandle);

          const tx = await cETH.completeWithdrawTo(permitHolder, amount.cleartexts, amount.proof);

          const rc = await tx.wait();

          completeTxHash = rc?.hash;

        }

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

