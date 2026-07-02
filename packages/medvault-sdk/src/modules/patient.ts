import {
  registerAnonymousParticipantByNullifier,
  type RegisterAnonymousParticipantOptions,
} from "@medvault/core";
import type { SdkRuntimeContext } from "../context.js";
import { requireSigner } from "../context.js";

export function createPatientModule(ctx: SdkRuntimeContext) {
  return {
    /**
     * Enroll an anonymous applicant in the trial reward pool after sponsor acceptance.
     * @remarks MED-3: when the patient EOA is not the decrypt permit holder, pass `identitySecret`
     * (`Semaphore identity.secretScalar`) for gasless `registerAnonymousParticipantFor`.
     */
    async enrollInRewardPool(
      trialId: string,
      nullifier: bigint | string,
      options?: RegisterAnonymousParticipantOptions
    ) {
      const signer = requireSigner(ctx);
      await registerAnonymousParticipantByNullifier(
        signer,
        trialId,
        BigInt(nullifier),
        options
      );
      return { trialId, nullifier: nullifier.toString() };
    },
  };
}

export type PatientModule = ReturnType<typeof createPatientModule>;
