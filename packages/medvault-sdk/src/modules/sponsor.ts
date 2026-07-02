import {
  assertSponsorCanWrite,
  computeMilestoneDeadlines,
  createTrialEncrypted as createTrialEncryptedOnChain,
  createTrialOnChainPlaintext,
  deactivateTrial,
  distributePartialMilestone,
  fetchAuditLogsFromChain,
  fundTrialPool,
  getSponsorVerification,
  getTrialPoolReclaimStatus,
  postSubgraph,
  reclaimUndistributedPool,
  reclaimAbandonedToOwnerPool,
  claimReclaimedPool as claimReclaimedPoolOnChain,
  setTrialMilestones,
  updateTrialApplicationStatus,
  type CreateTrialParams,
} from "@medvault/core";
import type { SdkRuntimeContext } from "../context.js";
import { requireSigner, requireSubgraphUrl } from "../context.js";

export function createSponsorModule(ctx: SdkRuntimeContext) {
  const subgraphUrl = () => requireSubgraphUrl(ctx.config);
  const openAccess = () => ctx.config.sponsorOpenAccess ?? false;

  return {
    async getVerification(sponsor: string) {
      return getSponsorVerification(ctx.provider, sponsor, openAccess());
    },

    async getStats(sponsor: string) {
      return postSubgraph(subgraphUrl(), "GetSponsorStats", {
        sponsor: sponsor.toLowerCase(),
      });
    },

    async getMatches(sponsor: string) {
      return postSubgraph(subgraphUrl(), "GetSponsorData", {
        sponsor: sponsor.toLowerCase(),
      });
    },

    async getAuditLogs(sponsor: string, options?: { first?: number }) {
      const first = options?.first ?? 200;
      const sponsorLower = sponsor.toLowerCase();
      const trialData = await postSubgraph<{ trials: { id: string }[] }>(
        subgraphUrl(),
        "GetSponsorTrialIds",
        { sponsor: sponsorLower }
      );
      const trialIds = (trialData.trials ?? []).map((t) => t.id);
      const trialIdSet = new Set(trialIds);

      let subgraphLogs: unknown[] = [];
      if (trialIds.length > 0) {
        const sg = await postSubgraph<{ auditLogs: unknown[] }>(
          subgraphUrl(),
          "GetSubgraphAuditLogs",
          { trialIds, first }
        );
        subgraphLogs = sg.auditLogs ?? [];
      }

      const chainLogs = await fetchAuditLogsFromChain(ctx.provider, trialIdSet);
      return {
        trialIds,
        subgraph: subgraphLogs,
        chain: chainLogs.slice(0, first),
      };
    },

    async getTrialPoolStatus(trialId: string, trialEndTimeSec?: string | number | null) {
      const reader = ctx.signer ?? ctx.provider;
      return getTrialPoolReclaimStatus(reader, trialId, trialEndTimeSec);
    },

    async createTrial(params: CreateTrialParams) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      const network = await ctx.provider.getNetwork();
      if (network.chainId === 31337n) {
        return createTrialOnChainPlaintext(signer, params);
      }
      return createTrialEncryptedOnChain(signer, params, { rpcUrl: ctx.config.rpcUrl });
    },

    /** Always uses FHE-encrypted criteria (Sepolia / production). */
    async createTrialEncrypted(params: CreateTrialParams) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      return createTrialEncryptedOnChain(signer, params, { rpcUrl: ctx.config.rpcUrl });
    },

    async setMilestones(
      trialId: string,
      durationSeconds: number,
      milestones: { name: string; weight: number; deadlineOffsetSec: number }[]
    ) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      const deadlines = computeMilestoneDeadlines(milestones, durationSeconds);
      const mapped = milestones.map((m, i) => ({
        name: m.name,
        weight: m.weight,
        deadline: deadlines[i],
      }));
      await setTrialMilestones(signer, trialId, mapped);
      return { trialId, deadlines };
    },

    async fundPool(trialId: string, amountEth: string) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      const totalFunded = await fundTrialPool(signer, trialId, amountEth);
      return { trialId, totalFunded };
    },

    async updateApplicationStatus(
      trialId: string,
      patientAddress: string,
      newStatus: number,
      decisionMessage = "Updated via SDK"
    ) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      await updateTrialApplicationStatus(signer, trialId, patientAddress, newStatus, decisionMessage);
      return { trialId, patientAddress, newStatus };
    },

    async deactivate(trialId: string) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      await deactivateTrial(signer, trialId);
      return { trialId };
    },

    async distributeMilestone(trialId: string, milestoneIndex: number) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      const result = await distributePartialMilestone(signer, trialId, milestoneIndex);
      return {
        trialId,
        milestoneIndex,
        txHash: result.txHash,
        creditFailures: result.creditFailures.map((f) => ({
          participant: f.participant,
          reason: f.reason,
        })),
      };
    },

    async reclaimPool(trialId: string) {
      const signer = requireSigner(ctx);
      await assertSponsorCanWrite(signer, openAccess());
      await reclaimUndistributedPool(signer, trialId);
      return { trialId };
    },

    async reclaimAbandonedPool(trialId: string) {
      const signer = requireSigner(ctx);
      await reclaimAbandonedToOwnerPool(signer, trialId);
      return { trialId, scheduled: true as const };
    },

    async claimReclaimedPool(trialId: string) {
      const signer = requireSigner(ctx);
      await claimReclaimedPoolOnChain(signer, trialId);
      return { trialId };
    },
  };
}

export type SponsorModule = ReturnType<typeof createSponsorModule>;
