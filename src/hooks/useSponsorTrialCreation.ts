import { useState } from "react";
import { ethers } from "ethers";
import { getSponsorIncentiveVault, getSponsorRegistry, getTrialManager, getTrialMilestoneManager } from "../lib/contracts";
import { friendlyTrialManagerRevert } from "../lib/trialManagerRevert";
import { useWeb3 } from "../lib/Web3Context";
import { buildSponsorCriteriaInputs } from "../lib/fhe";

export interface SponsorTrialFormData {
  name: string;
  phase: string;
  location: string;
  compensation: string;
  description: string;
  duration: number;
  durationUnit: "days" | "minutes";
  fundingAmount: string;
}

export interface SponsorTrialCriteria {
  minAge: number;
  maxAge: number;
  requiresDiabetes: boolean;
  minHb: number;
  genderRequirement: number;
  minHeight: number;
  maxWeight: number;
  requiresNonSmoker: boolean;
  requiresNormalBP: boolean;
}

export interface SponsorTrialMilestone {
  name: string;
  weight: number;
  deadline: number;
}

interface SubmitTrialInput {
  formData: SponsorTrialFormData;
  criteria: SponsorTrialCriteria;
  milestones: SponsorTrialMilestone[];
  usePhasedPayouts: boolean;
}

export function useSponsorTrialCreation() {
  const { signer, account } = useWeb3();
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitTrial = async ({
    formData,
    criteria,
    milestones,
    usePhasedPayouts,
  }: SubmitTrialInput): Promise<boolean> => {
    if (!signer || !account) {
      setStatus("Please connect your wallet first.");
      return false;
    }

    if (!formData.name) {
      setStatus("Error: Trial name is required.");
      return false;
    }

    setIsSubmitting(true);
    setStatus("Launching protocol on Sepolia...");

    try {
      const trialManager = getTrialManager(signer);
      const tmAddr = await trialManager.getAddress();
      setStatus("Encrypting sponsor criteria with Zama FHE...");
      const encryptedCriteria = await buildSponsorCriteriaInputs(tmAddr, account, {
        minAge: criteria.minAge,
        maxAge: criteria.maxAge,
        requiresDiabetes: criteria.requiresDiabetes,
        minHb: criteria.minHb,
        genderRequirement: criteria.genderRequirement,
        minHeight: criteria.minHeight,
        maxWeight: criteria.maxWeight > 0 ? criteria.maxWeight : 65535,
        requiresNonSmoker: criteria.requiresNonSmoker,
        requiresNormalBP: criteria.requiresNormalBP,
      });

      const tx = await trialManager.createTrialWithEncryptedCriteria(
        formData.name,
        formData.phase,
        formData.location,
        formData.compensation,
        encryptedCriteria.minAge.handle,
        encryptedCriteria.maxAge.handle,
        encryptedCriteria.requiresDiabetes.handle,
        encryptedCriteria.minHb.handle,
        encryptedCriteria.genderRequirement.handle,
        encryptedCriteria.minHeight.handle,
        encryptedCriteria.maxWeight.handle,
        encryptedCriteria.requiresNonSmoker.handle,
        encryptedCriteria.requiresNormalBP.handle,
        encryptedCriteria.inputProof,
        formData.durationUnit === "days" ? formData.duration * 86400 : formData.duration * 60
      );

      setStatus("Waiting for protocol confirmation...");
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((log: any) => {
          try {
            return trialManager.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e && e.name === "TrialCreated");

      if (!event || !event.args) {
        throw new Error("Could not find TrialCreated event in receipt.");
      }

      const trialId = event.args.trialId;

      if (usePhasedPayouts && milestones.length > 0) {
        setStatus("Defining phased payout milestones...");
        const milestoneManager = getTrialMilestoneManager(signer);

        const unitMultiplier = formData.durationUnit === "days" ? 86400 : 60;
        const trialDurationSeconds = formData.duration * unitMultiplier;
        const now = Math.floor(Date.now() / 1000) + 15;

        const absoluteDeadlines: number[] = [];
        for (let i = 0; i < milestones.length; i++) {
          let deadlineSeconds = milestones[i].deadline * unitMultiplier;
          let absolute = now + deadlineSeconds;

          if (i > 0 && absolute <= absoluteDeadlines[i - 1]) {
            absolute = absoluteDeadlines[i - 1] + 1;
          }

          const maxAllowed = now - 15 + trialDurationSeconds;
          if (absolute > maxAllowed) {
            absolute = maxAllowed;
          }

          if (i > 0 && absolute <= absoluteDeadlines[i - 1]) {
            throw new Error("Trial duration is too short for the number of milestones.");
          }

          absoluteDeadlines.push(absolute);
        }

        const milestoneTx = await milestoneManager.setMilestones(
          trialId,
          milestones.map((m) => m.name),
          milestones.map((m) => m.weight),
          absoluteDeadlines
        );
        await milestoneTx.wait();
      }

      if (formData.fundingAmount && parseFloat(formData.fundingAmount) > 0) {
        setStatus("Trial defined. Seeding incentive pool...");
        const vault = getSponsorIncentiveVault(signer);
        const fundingTx = await vault.fundTrial(trialId, {
          value: ethers.parseEther(formData.fundingAmount),
        });
        setStatus("Confirming incentive pool funding...");
        await fundingTx.wait();
      }

      setStatus("Success! Protocol and Incentive Pool initialized.");
      return true;
    } catch (err: any) {
      console.error(err);
      const decoded = friendlyTrialManagerRevert(err);
      setStatus(
        decoded
          ? `Error: ${decoded}`
          : `Error: ${err.reason || err.message || "Failed to create trial"}`
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    status,
    isSubmitting,
    setStatus,
    submitTrial,
  };
}
