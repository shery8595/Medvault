import { ethers } from "ethers";
import {
  ETHEREUM_SEPOLIA_CHAIN_ID,
  loadConfigFromEnv,
  type MedVaultConfig,
  assertSponsorCanWrite,
} from "@medvault/core";

export const SERVER_VERSION = "0.1.0";

export class MedVaultMcpContext {
  readonly config: MedVaultConfig;
  readonly provider: ethers.JsonRpcProvider;
  readonly transport: "stdio" | "http";

  constructor(config?: MedVaultConfig, transport: "stdio" | "http" = "stdio") {
    this.config = config ?? loadConfigFromEnv();
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl, Number(ETHEREUM_SEPOLIA_CHAIN_ID));
    this.transport = transport;
  }

  get readOnly(): boolean {
    return this.config.readOnly === true;
  }

  tryGetSigner(): ethers.Wallet | null {
    try {
      return this.getSigner();
    } catch {
      return null;
    }
  }

  getSigner(): ethers.Wallet {
    const key = process.env.MCP_PRIVATE_KEY?.trim();
    if (!key) {
      throw new Error("MCP_PRIVATE_KEY is required for write tools");
    }
    return new ethers.Wallet(key, this.provider);
  }

  async assertWritesAllowed(): Promise<string> {
    if (this.readOnly) {
      throw new Error("MCP_READ_ONLY=true — write tools are disabled");
    }
    const signer = this.getSigner();
    const network = await this.provider.getNetwork();
    if (network.chainId !== ETHEREUM_SEPOLIA_CHAIN_ID) {
      throw new Error(`Expected Ethereum Sepolia (11155111), got chain ${network.chainId}`);
    }
    await assertSponsorCanWrite(signer, this.config.sponsorOpenAccess);
    return signer.getAddress();
  }

  assertFundAmount(amountEth: string): void {
    const max = this.config.maxEthPerTx;
    if (!max) return;
    const amount = parseFloat(amountEth);
    const cap = parseFloat(max);
    if (Number.isFinite(amount) && Number.isFinite(cap) && amount > cap) {
      throw new Error(`Funding amount ${amountEth} ETH exceeds MCP_MAX_ETH_PER_TX=${max}`);
    }
  }

  safetySummary(signerAddress: string | null) {
    return {
      transport: this.transport,
      readOnly: this.readOnly,
      writesEnabled: !this.readOnly && Boolean(process.env.MCP_PRIVATE_KEY?.trim()),
      sponsorOpenAccess: this.config.sponsorOpenAccess ?? false,
      maxEthPerTx: this.config.maxEthPerTx ?? null,
      signerAddress,
      privacyBoundaries: [
        "Pool amounts require trial sponsor authorization",
        "Patient FHE data and relayer finalize flows are not exposed via MCP",
      ],
    };
  }
}
