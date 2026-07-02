import type { MedVaultConfig } from "@medvault/core";
import type {
  RelayerClaimParams,
  RelayerFinalizeApplyParams,
  RelayerHealthResponse,
  RelayerSemaphoreProof,
  RelayerStageApplyParams,
  RelayerTxResponse,
} from "../types.js";
import { requireRelayerUrl } from "../context.js";

export const NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE =
  "You don't meet this trial's eligibility requirements. Your profile was evaluated privately on-chain—you won't be able to submit this application. Try another trial, or update your encrypted health profile if your situation changes.";

export function serializeProofForRelay(proof: RelayerSemaphoreProof) {
  return {
    merkleTreeDepth: Number(proof.merkleTreeDepth),
    merkleTreeRoot: proof.merkleTreeRoot.toString(),
    nullifier: proof.nullifier.toString(),
    message: proof.message.toString(),
    scope: proof.scope.toString(),
    points: proof.points.map((p) => p.toString()),
  };
}

async function postRelay(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>
): Promise<string> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body, (_key, val) => (typeof val === "bigint" ? val.toString() : val)),
  });

  if (!response.ok) {
    let errorMsg = "Relayer request failed";
    try {
      const text = await response.text();
      let data: { error?: string; code?: string } = {};
      try {
        data = JSON.parse(text) as { error?: string; code?: string };
      } catch {
        if (text) errorMsg = text;
      }
      if (data.error) errorMsg = data.error;
      if (data.code === "NOT_ELIGIBLE") {
        throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
      }
    } catch (e) {
      if (e instanceof Error && e.message === NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE) throw e;
    }
    throw new Error(errorMsg);
  }

  const data = (await response.json()) as RelayerTxResponse;
  if (!data.success || !data.txHash) {
    throw new Error(data.error || "Relayer returned invalid response");
  }
  return data.txHash;
}

export function createRelayerModule(config: MedVaultConfig) {
  const getBase = () => requireRelayerUrl(config);

  return {
    async health(): Promise<RelayerHealthResponse> {
      const base = getBase();
      const res = await fetch(`${base}/health`);
      if (!res.ok) {
        throw new Error(`Relayer health check failed: HTTP ${res.status}`);
      }
      return (await res.json()) as RelayerHealthResponse;
    },

    async stageApply(params: RelayerStageApplyParams): Promise<string> {
      const base = getBase();
      return postRelay(base, "/relay/apply-stage", {
        trialId: Number(params.trialId),
        proof: serializeProofForRelay(params.proof),
        commitment: params.commitment.toString(),
        permitRecipient: params.permitRecipient,
        deadline: params.deadline.toString(),
        permitSignature: params.permitSignature,
      });
    },

    async finalizeApply(params: RelayerFinalizeApplyParams): Promise<string> {
      const base = getBase();
      return postRelay(base, "/relay/apply-finalize", {
        trialId: Number(params.trialId),
        proof: serializeProofForRelay(params.proof),
        commitment: params.commitment.toString(),
        permitRecipient: params.permitRecipient,
        consentWallet: params.consentWallet,
        deadline: params.deadline.toString(),
        permitSignature: params.permitSignature,
        consentWalletSignature: params.consentWalletSignature,
        noirProof: params.noirProof,
        publicInputs: params.publicInputs,
        eligible: params.eligible,
        stageTxHash: params.stageTxHash,
      });
    },

    async relayClaim(params: RelayerClaimParams): Promise<string> {
      const base = getBase();
      return postRelay(base, "/relay/claim", {
        trialId: params.trialId.toString(),
        nullifier: params.nullifier.toString(),
        permitHolder: params.permitHolder,
        destination: params.destination,
        units: params.units.toString(),
        encryptedAmountCommitment: params.encryptedAmountCommitment,
        encryptedUnitsHandle: params.encryptedUnitsHandle,
        inputProof: params.inputProof,
        nonce: params.nonce.toString(),
        deadline: params.deadline.toString(),
        signature: params.signature,
        withdrawToNonce: params.withdrawToNonce.toString(),
        withdrawToDeadline: params.withdrawToDeadline.toString(),
        withdrawToSignature: params.withdrawToSignature,
        vaultAddress: params.vaultAddress,
      });
    },
  };
}

export type RelayerModule = ReturnType<typeof createRelayerModule>;
