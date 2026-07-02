import { useCallback, useState } from "react";
import { ethers } from "ethers";
import { getEligibilityEngine, getSponsorIncentiveVault } from "../lib/contracts";
import { useWeb3 } from "../lib/Web3Context";

interface UseSponsorApplicationActionsResult {
  updatingId: string | null;
  error: string | null;
  updateApplicationStatus: (
    trialId: string,
    patientAddress: string,
    status: number,
    message?: string
  ) => Promise<boolean>;
  updateAnonymousApplicationStatus: (
    trialId: string,
    nullifier: string,
    status: number
  ) => Promise<boolean>;
}

export function useSponsorApplicationActions(): UseSponsorApplicationActionsResult {
  const { signer } = useWeb3();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateApplicationStatus = useCallback(
    async (trialId: string, patientAddress: string, status: number, message?: string) => {
      if (!signer) return false;

      const actionId = `${trialId}-${patientAddress}`;
      setUpdatingId(actionId);
      setError(null);
      try {
        const engine = getEligibilityEngine(signer);
        const messageBytes = ethers.hexlify(
          ethers.toUtf8Bytes(message || (status === 2 ? "Accepted" : "Rejected"))
        );

        const tx = await engine.updateApplicationStatus(
          BigInt(trialId),
          patientAddress,
          status,
          messageBytes
        );
        await tx.wait();

        if (status === 2) {
          const vault = getSponsorIncentiveVault(signer);
          const regTx = await vault.registerParticipant(BigInt(trialId), patientAddress);
          await regTx.wait();
        }

        return true;
      } catch (err: any) {
        console.error("Failed to update status:", err);
        setError(err?.message ?? "Failed to update application status");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [signer]
  );

  /**
   * Updates anonymous application status on EligibilityEngine.
   * On Accepted (status 2), does **not** vault-register — MED-3 requires the permit holder
   * to call `registerAnonymousParticipant` (patient UI: Applied Trials / `registerAnonymousParticipantByNullifier`).
   */
  const updateAnonymousApplicationStatus = useCallback(
    async (trialId: string, nullifier: string, status: number) => {
      if (!signer) return false;

      const actionId = `${trialId}-${nullifier}`;
      setUpdatingId(actionId);
      setError(null);
      try {
        const engine = getEligibilityEngine(signer);
        const tx = await engine.updateAnonymousApplicationStatus(BigInt(trialId), BigInt(nullifier), status);
        await tx.wait();

        return true;
      } catch (err: any) {
        console.error("Failed to update anonymous status:", err);
        setError(err?.message ?? "Failed to update anonymous application status");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [signer]
  );

  return { updatingId, error, updateApplicationStatus, updateAnonymousApplicationStatus };
}
