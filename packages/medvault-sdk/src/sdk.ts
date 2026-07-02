import { ethers } from "ethers";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "@medvault/core";
import { resolveSdkContext, type SdkRuntimeContext } from "./context.js";
import { createPatientModule } from "./modules/patient.js";
import { createProtocolModule } from "./modules/protocol.js";
import { createRelayerModule } from "./modules/relayer.js";
import { createSponsorModule } from "./modules/sponsor.js";
import { createTrialsModule } from "./modules/trials.js";
import type { MedVaultSDKConfig } from "./types.js";

export class MedVaultSDK {
  readonly config: SdkRuntimeContext["config"];
  readonly provider: ethers.Provider;
  readonly signer: ethers.Signer | null;
  readonly trials: ReturnType<typeof createTrialsModule>;
  readonly sponsor: ReturnType<typeof createSponsorModule>;
  readonly patient: ReturnType<typeof createPatientModule>;
  readonly protocol: ReturnType<typeof createProtocolModule>;
  readonly relayer: ReturnType<typeof createRelayerModule>;

  private constructor(ctx: SdkRuntimeContext) {
    this.config = ctx.config;
    this.provider = ctx.provider;
    this.signer = ctx.signer;
    this.trials = createTrialsModule(ctx);
    this.sponsor = createSponsorModule(ctx);
    this.patient = createPatientModule(ctx);
    this.protocol = createProtocolModule(ctx);
    this.relayer = createRelayerModule(ctx.config);
  }

  static create(input: MedVaultSDKConfig = {}): MedVaultSDK {
    return new MedVaultSDK(resolveSdkContext(input));
  }

  get chainId(): bigint {
    return ETHEREUM_SEPOLIA_CHAIN_ID;
  }

  async getSignerAddress(): Promise<string | null> {
    if (!this.signer) return null;
    return this.signer.getAddress();
  }
}
