export { MedVaultSDK } from "./sdk.js";
export type { MedVaultSDKConfig, RelayerSemaphoreProof, RelayerStageApplyParams, RelayerFinalizeApplyParams } from "./types.js";
export { NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE, serializeProofForRelay } from "./modules/relayer.js";
export {
  SilentFailureDetected,
  captureRecipientBalanceBefore,
  assertConfidentialTransferSucceeded,
  guardConfidentialTransfer,
} from "./modules/silentFailureGuard.js";
export type { SilentFailureGuardOptions, ZamaDecryptSdk } from "./modules/silentFailureGuard.js";
export type { CreateTrialParams, CreateTrialResult, RegisterAnonymousParticipantOptions } from "@medvault/core";
