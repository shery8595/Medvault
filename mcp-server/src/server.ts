import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  ALLOWED_SUBGRAPH_QUERY_NAMES,
  PROTOCOL_CONTRACTS,
  checkWiring,
  createTrialEncrypted,
  createTrialOnChainPlaintext,
  deactivateTrial,
  distributePartialMilestone,
  fetchAuditLogsFromChain,
  fundTrialPool,
  getContract,
  getSponsorVerification,
  getTrialPoolReclaimStatus,
  postSubgraph,
  reclaimUndistributedPool,
  reclaimAbandonedToOwnerPool,
  claimReclaimedPool,
  registerAnonymousParticipantByNullifier,
  setTrialMilestones,
  updateTrialApplicationStatus,
  computeMilestoneDeadlines,
  normalizeTxError,
  type ContractName,
} from "@medvault/core";
import { MedVaultSDK } from "@medvault/sdk";
import { appendMcpAudit } from "./audit.js";
import {
  getClientConfigHelp,
  getProtocolHealth,
  getSponsorOverview,
  getTrialOperationsTimeline,
  listCapabilities,
  previewFundTrialPool,
  runDoctor,
} from "./diagnostics.js";
import type { MedVaultMcpContext } from "./context.js";
import { SERVER_VERSION as MCP_VERSION } from "./context.js";
import { isBlockedContractView } from "./sensitiveViews.js";
import { postAiAuditLogs, postAiExtractCriteria } from "./aiService.js";

function jsonText(data: unknown): { content: { type: "text"; text: string }[] } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

async function auditWrite(
  tool: string,
  signer: string,
  ok: boolean,
  extra?: { trialId?: string; txHash?: string; detail?: string }
) {
  await appendMcpAudit({
    ts: new Date().toISOString(),
    tool,
    signer,
    ok,
    ...extra,
  });
}

export function createMedVaultMcpServer(ctx: MedVaultMcpContext): McpServer {
  const server = new McpServer({
    name: "medvault",
    version: MCP_VERSION,
  });

  async function signerAddressOrNull(): Promise<string | null> {
    const s = ctx.tryGetSigner();
    if (!s) return null;
    try {
      return await s.getAddress();
    } catch {
      return null;
    }
  }

  server.tool(
    "medvault_get_config",
    "Deployed addresses, env URLs, server version, safety summary, and optional signer address.",
    {},
    async () => {
      const signerAddress = await signerAddressOrNull();
      let signer = null;
      try {
        signer = ctx.tryGetSigner();
      } catch {
        /* no key */
      }
      const sdk = MedVaultSDK.create({
        ...ctx.config,
        provider: ctx.provider,
        signer: signer ?? undefined,
      });
      return jsonText({
        serverVersion: MCP_VERSION,
        sdkPackage: "@medvault/sdk",
        networkKey: ctx.config.networkKey,
        chainId: Number(sdk.chainId),
        rpcUrl: ctx.config.rpcUrl,
        subgraphUrl: ctx.config.subgraphUrl || null,
        relayerUrl: ctx.config.relayerUrl || null,
        safety: ctx.safetySummary(signerAddress),
        signerAddress,
        addresses: sdk.protocol.getAddresses(),
      });
    }
  );

  server.tool(
    "medvault_list_protocol_contracts",
    "Canonical MedVault protocol contract catalog (roles, key functions).",
    {},
    async () => jsonText({ contracts: PROTOCOL_CONTRACTS })
  );

  server.tool(
    "medvault_check_wiring",
    "Verify SponsorIncentiveVault, MedVaultAutomation, TrialMilestoneManager, and TrialManager cross-references.",
    {},
    async () => jsonText(await checkWiring(ctx.provider, ctx.config.networkKey))
  );

  server.tool(
    "medvault_subgraph_query",
    "Run an allowlisted GraphQL query against MEDVAULT_SUBGRAPH_URL.",
    {
      queryName: z.enum(ALLOWED_SUBGRAPH_QUERY_NAMES as [string, ...string[]]),
      variables: z.record(z.unknown()).optional(),
    },
    async ({ queryName, variables }) =>
      jsonText(await postSubgraph(ctx.config.subgraphUrl, queryName, variables))
  );

  server.tool(
    "medvault_get_active_trials",
    "List active trials from the subgraph.",
    {
      first: z.number().int().min(1).max(100).optional().default(50),
      skip: z.number().int().min(0).optional().default(0),
    },
    async ({ first, skip }) =>
      jsonText(await postSubgraph(ctx.config.subgraphUrl, "GetActiveTrials", { first, skip }))
  );

  server.tool(
    "medvault_get_sponsor_trials",
    "Trials owned by a sponsor address.",
    { sponsor: z.string().describe("Sponsor wallet address (0x...)") },
    async ({ sponsor }) =>
      jsonText(
        await postSubgraph(ctx.config.subgraphUrl, "GetTrialsBySponsor", {
          sponsor: sponsor.toLowerCase(),
        })
      )
  );

  server.tool(
    "medvault_get_sponsor_matches",
    "Sponsor trial matches: applications, eligibility, consents, anonymous submissions.",
    { sponsor: z.string() },
    async ({ sponsor }) =>
      jsonText(
        await postSubgraph(ctx.config.subgraphUrl, "GetSponsorData", {
          sponsor: sponsor.toLowerCase(),
        })
      )
  );

  server.tool(
    "medvault_get_sponsor_stats",
    "Sponsor entity with trial/application aggregates from subgraph.",
    { sponsor: z.string() },
    async ({ sponsor }) =>
      jsonText(
        await postSubgraph(ctx.config.subgraphUrl, "GetSponsorStats", {
          sponsor: sponsor.toLowerCase(),
        })
      )
  );

  server.tool(
    "medvault_get_audit_logs",
    "Audit logs for a sponsor's trials (subgraph + optional chain fallback).",
    {
      sponsor: z.string(),
      first: z.number().int().min(1).max(500).optional().default(200),
    },
    async ({ sponsor, first }) => {
      const sponsorLower = sponsor.toLowerCase();
      const trialData = await postSubgraph<{ trials: { id: string }[] }>(
        ctx.config.subgraphUrl,
        "GetSponsorTrialIds",
        { sponsor: sponsorLower }
      );
      const trialIds = (trialData.trials ?? []).map((t) => t.id);
      const trialIdSet = new Set(trialIds);

      let subgraphLogs: unknown[] = [];
      if (trialIds.length > 0) {
        const sg = await postSubgraph<{ auditLogs: unknown[] }>(
          ctx.config.subgraphUrl,
          "GetSubgraphAuditLogs",
          { trialIds: trialIds.map((id) => id), first }
        );
        subgraphLogs = sg.auditLogs ?? [];
      }

      const chainLogs = await fetchAuditLogsFromChain(ctx.provider, trialIdSet);
      return jsonText({
        trialIds,
        subgraph: subgraphLogs,
        chain: chainLogs.slice(0, first),
      });
    }
  );

  server.tool(
    "medvault_get_sponsor_verification",
    "Check SponsorRegistry verification and admin status for an address.",
    { sponsor: z.string() },
    async ({ sponsor }) =>
      jsonText(
        await getSponsorVerification(ctx.provider, sponsor, ctx.config.sponsorOpenAccess)
      )
  );

  server.tool(
    "medvault_get_trial_pool_status",
    "Public/coarse trial pool status: funded flag, participant count, distribution/reclaim flags. Does NOT return pool amounts.",
    {
      trialId: z.string(),
      trialEndTimeSec: z.union([z.string(), z.number()]).optional(),
    },
    async ({ trialId, trialEndTimeSec }) => {
      const status = await getTrialPoolReclaimStatus(ctx.provider, trialId, trialEndTimeSec);
      return jsonText({
        trialId,
        poolFunded: status.poolFunded,
        participantCount: status.participantCount,
        screeningDistributed: status.screeningDistributed,
        reclaimFinalized: status.reclaimFinalized,
        trialEnded: status.trialEnded,
        canReclaimHint: status.canReclaimHint,
        trialSponsor: status.trialSponsor,
        privacyNote: status.privacyNote,
        amountsAvailableVia: "medvault_get_sponsor_trial_pool_details with trial sponsor MCP_PRIVATE_KEY",
      });
    }
  );

  server.tool(
    "medvault_get_sponsor_trial_pool_details",
    "Sponsor-authorized pool details including deposited/reclaimable amounts. Requires MCP_PRIVATE_KEY for the trial sponsor.",
    {
      trialId: z.string(),
      trialEndTimeSec: z.union([z.string(), z.number()]).optional(),
    },
    async ({ trialId, trialEndTimeSec }) => {
      const signer = ctx.tryGetSigner();
      if (!signer) {
        throw new Error(
          "MCP_PRIVATE_KEY required for sponsor pool amounts. Use medvault_get_trial_pool_status for public coarse status."
        );
      }
      const status = await getTrialPoolReclaimStatus(signer, trialId, trialEndTimeSec);
      if (!status.sponsorAuthorized) {
        throw new Error(
          status.amountsRestrictedReason ??
            "Connected signer is not authorized to view pool amounts for this trial"
        );
      }
      return jsonText({ trialId, ...status });
    }
  );

  server.tool(
    "medvault_read_contract_view",
    "Call a read-only contract function (dev escape hatch). Sensitive vault amount views are blocklisted.",
    {
      contract: z.string(),
      functionName: z.string(),
      args: z.array(z.union([z.string(), z.number(), z.boolean()])).optional().default([]),
    },
    async ({ contract, functionName, args }) => {
      if (isBlockedContractView(contract, functionName)) {
        throw new Error(
          `${contract}.${functionName} is blocklisted. Use medvault_get_sponsor_trial_pool_details when authorized.`
        );
      }
      const c = getContract(contract as ContractName, ctx.provider, ctx.config.networkKey);
      const fn = (c as ethers.Contract)[functionName];
      if (typeof fn !== "function") {
        throw new Error(`Function ${functionName} not found on ${contract}`);
      }
      const result = await fn(...args);
      return jsonText({ result: serializeContractResult(result) });
    }
  );

  server.tool(
    "medvault_relayer_health",
    "GET /health from MEDVAULT_RELAYER_URL or MEDVAULT_RELAYER_URLS if configured.",
    {
      url: z.string().optional().describe("Optional single relayer base URL override"),
    },
    async ({ url }) => {
      const urls = url
        ? [url.replace(/\/$/, "")]
        : ctx.config.relayerUrls?.length
          ? ctx.config.relayerUrls
          : ctx.config.relayerUrl
            ? [ctx.config.relayerUrl.replace(/\/$/, "")]
            : [];
      if (urls.length === 0) throw new Error("MEDVAULT_RELAYER_URL or MEDVAULT_RELAYER_URLS is not set");
      const results = await Promise.all(
        urls.map(async (base) => {
          const res = await fetch(`${base}/health`);
          const body = await res.text();
          return { url: base, status: res.status, body: tryParseJson(body) };
        })
      );
      return jsonText(urls.length === 1 ? results[0] : { relayers: results });
    }
  );

  server.tool("medvault_doctor", "Diagnose MCP env, build output, RPC, subgraph, and sponsor setup.", {}, async () =>
    jsonText(await runDoctor(ctx))
  );

  server.tool(
    "medvault_list_capabilities",
    "Server version, transports, read/write tools, safety limits, and privacy boundaries.",
    {},
    async () => jsonText(listCapabilities(ctx, await signerAddressOrNull()))
  );

  server.tool(
    "medvault_get_client_config_help",
    "Per-client MCP config file paths and env interpolation syntax.",
    { client: z.string().optional() },
    async ({ client }) => jsonText(getClientConfigHelp(client))
  );

  server.tool(
    "medvault_get_protocol_health",
    "Combined wiring, subgraph, and relayer health check.",
    {},
    async () => jsonText(await getProtocolHealth(ctx))
  );

  server.tool(
    "medvault_get_sponsor_overview",
    "Aggregate sponsor trials, matches, stats, and coarse pool flags. Amounts only when signer is the sponsor.",
    { sponsor: z.string() },
    async ({ sponsor }) =>
      jsonText(await getSponsorOverview(ctx, sponsor, await signerAddressOrNull()))
  );

  server.tool(
    "medvault_preview_fund_trial_pool",
    "Dry-run fundTrial: validate amount and return tx preview without submitting.",
    { trialId: z.string(), amountEth: z.string() },
    async ({ trialId, amountEth }) => jsonText(previewFundTrialPool(trialId, amountEth, ctx))
  );

  server.tool(
    "medvault_get_trial_operations_timeline",
    "Trial pool status plus subgraph application context for operations review.",
    { trialId: z.string() },
    async ({ trialId }) => jsonText(await getTrialOperationsTimeline(ctx, trialId))
  );

  server.tool(
    "medvault_ai_extract_criteria",
    "Read-only: extract trial eligibility criteria from protocol text or base64 PDF via @medvault/ai (PHI redacted before LLM). Does not submit on-chain.",
    {
      text: z.string().optional().describe("Plain protocol text (mutually exclusive with pdfBase64)"),
      pdfBase64: z.string().optional().describe("Base64-encoded protocol PDF"),
      blocklist: z.array(z.string()).optional().describe("Optional sponsor PHI name blocklist"),
    },
    async ({ text, pdfBase64, blocklist }) => {
      if (!text?.trim() && !pdfBase64?.trim()) {
        throw new Error("Provide text or pdfBase64");
      }
      if (text?.trim() && pdfBase64?.trim()) {
        throw new Error("Provide only one of text or pdfBase64");
      }
      return jsonText(
        await postAiExtractCriteria({
          text: text?.trim() || undefined,
          pdfBase64: pdfBase64?.trim() || undefined,
          blocklist,
        })
      );
    }
  );

  server.tool(
    "medvault_ai_audit_logs",
    "Read-only: AI summary of anonymized DataAccessLog events (match rate, bottlenecks). Fetches from chain when logs omitted.",
    {
      trialIds: z.array(z.string()).optional(),
      logs: z
        .array(
          z.object({
            id: z.string(),
            actionType: z.string(),
            trialId: z.string(),
            patientHash: z.string(),
            timestamp: z.string(),
            performer: z.string(),
          })
        )
        .optional(),
    },
    async ({ trialIds, logs }) => {
      if ((!trialIds || trialIds.length === 0) && (!logs || logs.length === 0)) {
        throw new Error("Provide trialIds and/or logs");
      }
      return jsonText(await postAiAuditLogs({ trialIds, logs }));
    }
  );

  if (!ctx.readOnly) {
    registerWriteTools(server, ctx);
  }

  return server;
}

function registerWriteTools(server: McpServer, ctx: MedVaultMcpContext) {
  server.tool(
    "medvault_create_trial",
    "Create a trial on TrialManager; optional milestones and initial pool funding.",
    {
      name: z.string(),
      phase: z.string().default("Phase 1"),
      location: z.string(),
      compensation: z.string(),
      minAge: z.number().int(),
      maxAge: z.number().int(),
      requiresDiabetes: z.boolean(),
      minHb: z.number().int(),
      genderRequirement: z.number().int().min(0).max(2),
      minHeight: z.number().int(),
      maxWeight: z.number().int(),
      requiresNonSmoker: z.boolean(),
      requiresNormalBP: z.boolean(),
      durationSeconds: z.number().int().positive(),
      milestones: z
        .array(
          z.object({
            name: z.string(),
            weight: z.number().int().describe("Basis points; total should be 10000"),
            deadlineOffsetSec: z.number().int().positive(),
          })
        )
        .optional(),
      fundingAmountEth: z.string().optional(),
    },
    async (params) => {
      const signerAddr = await ctx.assertWritesAllowed();
      if (params.fundingAmountEth) ctx.assertFundAmount(params.fundingAmountEth);
      const signer = ctx.getSigner();
      try {
        const network = await ctx.provider.getNetwork();
        const createFn =
          network.chainId === 31337n
            ? createTrialOnChainPlaintext
            : (s: typeof signer, p: Parameters<typeof createTrialEncrypted>[1]) =>
                createTrialEncrypted(s, p, { rpcUrl: ctx.config.rpcUrl });
        const result = await createFn(signer, {
          name: params.name,
          phase: params.phase,
          location: params.location,
          compensation: params.compensation,
          minAge: params.minAge,
          maxAge: params.maxAge,
          requiresDiabetes: params.requiresDiabetes,
          minHb: params.minHb,
          genderRequirement: params.genderRequirement,
          minHeight: params.minHeight,
          maxWeight: params.maxWeight,
          requiresNonSmoker: params.requiresNonSmoker,
          requiresNormalBP: params.requiresNormalBP,
          durationSeconds: params.durationSeconds,
          milestones: params.milestones,
          fundingAmountEth: params.fundingAmountEth,
        });
        await auditWrite("medvault_create_trial", signerAddr, true, {
          trialId: result.trialId,
          detail: JSON.stringify(result.txHashes ?? []),
        });
        return jsonText({ ok: true, ...result });
      } catch (err) {
        await auditWrite("medvault_create_trial", signerAddr, false, {
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_set_trial_milestones",
    "Set phased payout milestones for an existing trial.",
    {
      trialId: z.string(),
      durationSeconds: z.number().int().positive(),
      milestones: z.array(
        z.object({
          name: z.string(),
          weight: z.number().int(),
          deadlineOffsetSec: z.number().int().positive(),
        })
      ),
    },
    async ({ trialId, durationSeconds, milestones }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const deadlines = computeMilestoneDeadlines(milestones, durationSeconds);
      const mapped = milestones.map((m, i) => ({
        name: m.name,
        weight: m.weight,
        deadline: deadlines[i],
      }));
      const signer = ctx.getSigner();
      try {
        await setTrialMilestones(signer, trialId, mapped);
        await auditWrite("medvault_set_trial_milestones", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId, deadlines });
      } catch (err) {
        await auditWrite("medvault_set_trial_milestones", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_fund_trial_pool",
    "Fund a trial incentive pool with ETH (sponsor only).",
    { trialId: z.string(), amountEth: z.string() },
    async ({ trialId, amountEth }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      ctx.assertFundAmount(amountEth);
      const signer = ctx.getSigner();
      try {
        const preview = previewFundTrialPool(trialId, amountEth, ctx);
        const totalFunded = await fundTrialPool(signer, trialId, amountEth);
        await auditWrite("medvault_fund_trial_pool", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId, totalFunded, preview });
      } catch (err) {
        await auditWrite("medvault_fund_trial_pool", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_update_application_status",
    "Update patient application status on EligibilityEngine (status 2 registers participant in vault).",
    {
      trialId: z.string(),
      patientAddress: z.string(),
      newStatus: z.number().int(),
      decisionMessage: z.string().optional().default("Updated via MCP"),
    },
    async ({ trialId, patientAddress, newStatus, decisionMessage }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await updateTrialApplicationStatus(
          signer,
          trialId,
          patientAddress,
          newStatus,
          decisionMessage
        );
        await auditWrite("medvault_update_application_status", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId, patientAddress, newStatus });
      } catch (err) {
        await auditWrite("medvault_update_application_status", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_deactivate_trial",
    "Deactivate (halt) a trial via TrialManager.deactivateTrial.",
    { trialId: z.string() },
    async ({ trialId }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await deactivateTrial(signer, trialId);
        await auditWrite("medvault_deactivate_trial", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId });
      } catch (err) {
        await auditWrite("medvault_deactivate_trial", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_distribute_milestone",
    "Distribute a milestone payout tranche for a trial.",
    { trialId: z.string(), milestoneIndex: z.number().int().min(0) },
    async ({ trialId, milestoneIndex }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        const result = await distributePartialMilestone(signer, trialId, milestoneIndex);
        await auditWrite("medvault_distribute_milestone", signerAddr, true, { trialId });
        return jsonText({
          ok: true,
          trialId,
          milestoneIndex,
          txHash: result.txHash,
          creditFailures: result.creditFailures.map((f) => ({
            participant: f.participant,
            reason: f.reason,
          })),
        });
      } catch (err) {
        await auditWrite("medvault_distribute_milestone", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_register_anonymous_participant",
    "Register anonymous participant in incentive vault by nullifier. MED-3: when MCP signer is not the decrypt permit holder, pass identitySecret (Semaphore identity.secretScalar) for gasless registerAnonymousParticipantFor.",
    { trialId: z.string(), nullifier: z.string(), identitySecret: z.string().optional() },
    async ({ trialId, nullifier, identitySecret }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await registerAnonymousParticipantByNullifier(signer, trialId, BigInt(nullifier), {
          identitySecret: identitySecret ? BigInt(identitySecret) : undefined,
        });
        await auditWrite("medvault_register_anonymous_participant", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId, nullifier });
      } catch (err) {
        await auditWrite("medvault_register_anonymous_participant", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_reclaim_trial_pool",
    "Reclaim undistributed incentive pool funds when rules allow.",
    { trialId: z.string() },
    async ({ trialId }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await reclaimUndistributedPool(signer, trialId);
        await auditWrite("medvault_reclaim_trial_pool", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId });
      } catch (err) {
        await auditWrite("medvault_reclaim_trial_pool", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_reclaim_abandoned_pool",
    "Vault owner: schedule reclaim to protocol owner when trial sponsor was removed from SponsorRegistry.",
    { trialId: z.string() },
    async ({ trialId }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await reclaimAbandonedToOwnerPool(signer, trialId);
        await auditWrite("medvault_reclaim_abandoned_pool", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId, scheduled: true });
      } catch (err) {
        await auditWrite("medvault_reclaim_abandoned_pool", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );

  server.tool(
    "medvault_claim_reclaimed_pool",
    "Claim ETH after reclaimUndistributed or reclaimAbandonedToOwner scheduled a payout.",
    { trialId: z.string() },
    async ({ trialId }) => {
      const signerAddr = await ctx.assertWritesAllowed();
      const signer = ctx.getSigner();
      try {
        await claimReclaimedPool(signer, trialId);
        await auditWrite("medvault_claim_reclaimed_pool", signerAddr, true, { trialId });
        return jsonText({ ok: true, trialId });
      } catch (err) {
        await auditWrite("medvault_claim_reclaimed_pool", signerAddr, false, {
          trialId,
          detail: normalizeTxError(err),
        });
        return jsonText({ ok: false, error: normalizeTxError(err) });
      }
    }
  );
}

function serializeContractResult(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serializeContractResult);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeContractResult(v);
    }
    return out;
  }
  return value;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
