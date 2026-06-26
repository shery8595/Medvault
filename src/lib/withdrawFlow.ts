import { ethers } from "ethers";
import type { Signer } from "ethers";
import { getConfidentialETH } from "./contracts";
import { encryptUint64, ensureZamaConnected, publicDecrypt } from "./fhe";
import { parseEventArg } from "./contractEvents";

export type WithdrawExitMode = "fast" | "private_batch" | "wallet";

const EXIT_MODE_FAST = 0;
const EXIT_MODE_PRIVATE_BATCH = 1;

export async function requestEncryptedWithdraw(
  signer: Signer,
  units: number
): Promise<{ stageTxHash: string; sufficientHandle: string }> {
  const account = await signer.getAddress();
  const contract = getConfidentialETH(signer);
  const contractAddress = await contract.getAddress();
  const provider = signer.provider;
  if (!provider) throw new Error("Wallet provider not available");

  await ensureZamaConnected(provider, signer);
  const encrypted = await encryptUint64(contractAddress, account, units);

  const tx = await contract.requestWithdraw(encrypted.handle, encrypted.inputProof);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("Withdraw request receipt missing");

  const sufficientHandle = parseEventArg(
    receipt,
    contract.interface,
    contractAddress,
    "WithdrawRequested",
    "sufficientHandle"
  );

  return { stageTxHash: receipt.hash, sufficientHandle };
}

export async function completeEncryptedWithdraw(
  signer: Signer,
  sufficientHandle: string
): Promise<string> {
  const contract = getConfidentialETH(signer);
  const contractAddress = await contract.getAddress();

  const sufficient = await publicDecrypt(sufficientHandle);
  if (sufficient.value === 0n) {
    throw new Error("Insufficient confidential balance for this withdrawal");
  }

  const revealTx = await contract.revealWithdrawAmount(
    sufficient.cleartexts,
    sufficient.proof
  );
  const revealRc = await revealTx.wait();
  if (!revealRc) throw new Error("Reveal receipt missing");

  const amountHandle = parseEventArg(
    revealRc,
    contract.interface,
    contractAddress,
    "WithdrawAmountRevealed",
    "amountHandle"
  );

  const amount = await publicDecrypt(amountHandle);
  const completeTx = await contract.completeWithdraw(amount.cleartexts, amount.proof);
  const completeRc = await completeTx.wait();
  if (!completeRc) throw new Error("Complete withdraw receipt missing");
  return completeRc.hash;
}

export async function signPublicExitAuthorization(
  signer: Signer,
  params: {
    contractAddress: string;
    chainId: number;
    owner: string;
    stealthRecipient: string;
    sufficientHandle: string;
    exitMode: WithdrawExitMode;
    nonce: bigint;
    deadline: bigint;
  }
): Promise<string> {
  const exitMode =
    params.exitMode === "private_batch" ? EXIT_MODE_PRIVATE_BATCH : EXIT_MODE_FAST;

  const domain = {
    name: "MedVault ConfidentialETH",
    version: "1",
    chainId: params.chainId,
    verifyingContract: params.contractAddress,
  };

  const types = {
    WithdrawAuthorization: [
      { name: "owner", type: "address" },
      { name: "stealthRecipient", type: "address" },
      { name: "sufficientHandle", type: "bytes32" },
      { name: "exitMode", type: "uint8" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const value = {
    owner: params.owner,
    stealthRecipient: params.stealthRecipient,
    sufficientHandle: params.sufficientHandle,
    exitMode,
    nonce: params.nonce,
    deadline: params.deadline,
  };

  return signer.signTypedData(domain, types, value);
}

export async function completePublicExitViaRelayer(
  relayerUrl: string,
  body: Record<string, unknown>
): Promise<{ txHash: string }> {
  const response = await fetch(`${relayerUrl.replace(/\/$/, "")}/relay/public-exit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  });
  const data = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok || !data.success || !data.txHash) {
    throw new Error(typeof data.error === "string" ? data.error : "Public exit relay failed");
  }
  return { txHash: data.txHash as string };
}

export { EXIT_MODE_FAST, EXIT_MODE_PRIVATE_BATCH };
