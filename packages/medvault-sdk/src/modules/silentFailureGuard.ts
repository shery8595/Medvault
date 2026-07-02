import { ethers } from "ethers";

const BALANCE_ABI = [
  "function confidentialBalanceOf(address account) external view returns (bytes32)",
  "event ConfidentialTransfer(address indexed from, address indexed to, bytes32 encryptedAmount)",
] as const;

export class SilentFailureDetected extends Error {
  readonly code = "SILENT_FAILURE_DETECTED";
  constructor(
    message: string,
    readonly plaintextDelta: bigint,
    readonly intendedAmount: bigint
  ) {
    super(message);
    this.name = "SilentFailureDetected";
  }
}

export type ZamaDecryptSdk = {
  permits: {
    grantPermit: (contracts: string[]) => Promise<unknown>;
  };
  decryption: {
    decryptValues: (
      items: Array<{ encryptedValue: `0x${string}`; contractAddress: string }>
    ) => Promise<Record<string, bigint | number | boolean>>;
  };
};

export type SilentFailureGuardOptions = {
  tokenAddress: string;
  recipient: string;
  intendedAmount: bigint;
  provider: ethers.Provider;
  sdk: ZamaDecryptSdk;
  /** Secondary: optional tx receipt for ConfidentialTransfer event handle (not used for detection). */
  receipt?: ethers.TransactionReceipt | null;
};

async function decryptBalance(
  sdk: ZamaDecryptSdk,
  tokenAddress: string,
  recipient: string,
  provider: ethers.Provider
): Promise<bigint> {
  const token = new ethers.Contract(tokenAddress, BALANCE_ABI, provider);
  const handle = (await token.confidentialBalanceOf(recipient)) as `0x${string}`;
  await sdk.permits.grantPermit([tokenAddress]);
  const values = await sdk.decryption.decryptValues([
    { encryptedValue: handle, contractAddress: tokenAddress },
  ]);
  const raw = values[handle];
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return BigInt(raw);
  return 0n;
}

/**
 * Plan 03: detect silent confidential-transfer failures via plaintext balance delta
 * (EIP-712 grantPermit + decryptValues). Does NOT compare raw ciphertext handles.
 */
export async function captureRecipientBalanceBefore(
  sdk: ZamaDecryptSdk,
  tokenAddress: string,
  recipient: string,
  provider: ethers.Provider
): Promise<bigint> {
  return decryptBalance(sdk, tokenAddress, recipient, provider);
}

export async function assertConfidentialTransferSucceeded(
  options: SilentFailureGuardOptions & { balanceBefore: bigint }
): Promise<bigint> {
  const { tokenAddress, recipient, intendedAmount, provider, sdk, balanceBefore, receipt } = options;

  const balanceAfter = await decryptBalance(sdk, tokenAddress, recipient, provider);
  const plaintextDelta = balanceAfter - balanceBefore;

  if (intendedAmount > 0n && plaintextDelta === 0n) {
    if (receipt) {
      const token = new ethers.Contract(tokenAddress, BALANCE_ABI, provider);
      for (const log of receipt.logs) {
        try {
          const parsed = token.interface.parseLog(log);
          if (parsed?.name === "ConfidentialTransfer") {
            /* secondary observability only */
          }
        } catch {
          /* ignore non-matching logs */
        }
      }
    }
    throw new SilentFailureDetected(
      "Confidential transfer likely failed silently: intendedAmount > 0 but plaintext balance delta is 0",
      plaintextDelta,
      intendedAmount
    );
  }

  return plaintextDelta;
}

export async function guardConfidentialTransfer(
  options: Omit<SilentFailureGuardOptions, "receipt"> & {
    balanceBefore: bigint;
    receipt?: ethers.TransactionReceipt | null;
  }
): Promise<bigint> {
  return assertConfidentialTransferSucceeded(options);
}
