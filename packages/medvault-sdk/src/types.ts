import type { ethers } from "ethers";
import type { MedVaultConfig, NetworkKey } from "@medvault/core";
import type { CreateTrialParams, CreateTrialResult } from "@medvault/core";

export type { CreateTrialParams, CreateTrialResult, MedVaultConfig, NetworkKey };

export interface MedVaultSDKConfig {
  rpcUrl?: string;
  subgraphUrl?: string;
  relayerUrl?: string;
  networkKey?: NetworkKey;
  sponsorOpenAccess?: boolean;
  maxEthPerTx?: string;
  /** Provider for reads; built from rpcUrl if omitted. */
  provider?: ethers.Provider;
  /** Signer for sponsor writes; must share provider with reads. */
  signer?: ethers.Signer;
}

export interface RelayerSemaphoreProof {
  merkleTreeDepth: number | string;
  merkleTreeRoot: number | string;
  nullifier: number | string;
  message: number | string;
  scope: number | string;
  points: (number | string)[];
}

export interface RelayerStageApplyParams {
  trialId: number | string;
  proof: RelayerSemaphoreProof;
  commitment: number | string;
  permitRecipient: string;
  deadline: number | string | bigint;
  permitSignature: string;
}

export interface RelayerFinalizeApplyParams extends RelayerStageApplyParams {
  consentWallet: string;
  consentWalletSignature: string;
  noirProof: string;
  publicInputs: string[];
  eligible: boolean;
  stageTxHash?: string;
}

export interface RelayerHealthResponse {
  status: string;
  registry?: string;
}

export interface RelayerTxResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

export interface RelayerClaimParams {
  trialId: number | string;
  nullifier: number | string;
  permitHolder: string;
  destination: string;
  units: number | string;
  encryptedAmountCommitment: string;
  encryptedUnitsHandle: string;
  inputProof: string;
  nonce: number | string;
  deadline: number | string;
  signature: string;
  withdrawToNonce: number | string;
  withdrawToDeadline: number | string;
  withdrawToSignature: string;
  vaultAddress?: string;
}
