import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkWiring,
  getSponsorVerification,
  loadConfigFromEnv,
  postSubgraph,
  PROTOCOL_CONTRACTS,
} from "@medvault/core";
import { ethers } from "ethers";
import type { MedVaultMcpContext } from "./context.js";
import { SERVER_VERSION } from "./context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.cwd();
const MCP_ENTRY = path.join(REPO_ROOT, "mcp-server", "dist", "index.js");

const CLIENT_HELP = {
  cursor: {
    file: ".cursor/mcp.json",
    envSyntax: "${env:VAR}",
    entry: "${workspaceFolder}/mcp-server/dist/index.js",
  },
  claude: {
    file: ".mcp.json",
    envSyntax: "${env:VAR}",
    entry: "${workspaceFolder}/mcp-server/dist/index.js",
  },
  codex: {
    file: "~/.codex/config.toml",
    envSyntax: "${VAR}",
    entry: "<REPO_ROOT>/mcp-server/dist/index.js",
  },
  chatgpt: {
    file: "OS-specific mcp.json (see config/mcp/README.md)",
    envSyntax: "${env:VAR}",
    entry: "${workspaceFolder}/mcp-server/dist/index.js",
  },
  antigravity: {
    file: "~/.gemini/antigravity/mcp_config.json",
    envSyntax: "${env:VAR} (stdio) or serverUrl (HTTP)",
    entry: "stdio or http://127.0.0.1:3100/mcp",
  },
  openclaw: {
    file: "~/.openclaw/openclaw.json",
    envSyntax: "${VAR}",
    entry: "<REPO_ROOT>/mcp-server/dist/index.js",
  },
} as const;

export const READ_TOOL_NAMES = [
  "medvault_get_config",
  "medvault_list_protocol_contracts",
  "medvault_check_wiring",
  "medvault_subgraph_query",
  "medvault_get_active_trials",
  "medvault_get_sponsor_trials",
  "medvault_get_sponsor_matches",
  "medvault_get_sponsor_stats",
  "medvault_get_audit_logs",
  "medvault_get_sponsor_verification",
  "medvault_get_trial_pool_status",
  "medvault_get_sponsor_trial_pool_details",
  "medvault_read_contract_view",
  "medvault_relayer_health",
  "medvault_doctor",
  "medvault_list_capabilities",
  "medvault_get_client_config_help",
  "medvault_get_protocol_health",
  "medvault_get_sponsor_overview",
  "medvault_preview_fund_trial_pool",
  "medvault_get_trial_operations_timeline",
  "medvault_ai_extract_criteria",
  "medvault_ai_audit_logs",
] as const;

export const WRITE_TOOL_NAMES = [
  "medvault_create_trial",
  "medvault_set_trial_milestones",
  "medvault_fund_trial_pool",
  "medvault_update_application_status",
  "medvault_deactivate_trial",
  "medvault_distribute_milestone",
  "medvault_register_anonymous_participant",
  "medvault_reclaim_trial_pool",
  "medvault_reclaim_abandoned_pool",
  "medvault_claim_reclaimed_pool",
] as const;

async function buildExists(): Promise<boolean> {
  try {
    await access(MCP_ENTRY);
    return true;
  } catch {
    return false;
  }
}

export async function runDoctor(ctx: MedVaultMcpContext) {
  const env = process.env;
  const config = ctx.config;
  const issues: string[] = [];
  const checks: Record<string, unknown> = {};

  checks.buildOutput = await buildExists();
  if (!checks.buildOutput) issues.push("Run npm run mcp:build — dist/index.js missing");

  checks.sepoliaRpcUrl = Boolean(config.rpcUrl);
  if (!config.rpcUrl) issues.push("SEPOLIA_RPC_URL is not set");

  checks.subgraphUrl = Boolean(config.subgraphUrl);
  if (!config.subgraphUrl) issues.push("MEDVAULT_SUBGRAPH_URL / VITE_SUBGRAPH_URL is not set");

  let signerAddress: string | null = null;
  try {
    signerAddress = await ctx.tryGetSigner()?.getAddress() ?? null;
    checks.signerConfigured = true;
  } catch {
    checks.signerConfigured = false;
  }

  if (config.readOnly && env.MCP_PRIVATE_KEY?.trim()) {
    issues.push("MCP_READ_ONLY=true — write tools disabled despite MCP_PRIVATE_KEY");
  }

  try {
    const network = await ctx.provider.getNetwork();
    checks.chainId = Number(network.chainId);
    if (network.chainId !== 11155111n) {
      issues.push(`RPC chain id ${network.chainId} is not Sepolia (11155111)`);
    }
  } catch (e) {
    issues.push(`RPC unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (config.subgraphUrl) {
    try {
      const trials = await postSubgraph(config.subgraphUrl, "GetActiveTrials", { first: 1, skip: 0 });
      checks.subgraphReachable = true;
      checks.subgraphTrialSample = (trials?.trials ?? []).length;
    } catch (e) {
      checks.subgraphReachable = false;
      issues.push(`Subgraph error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (signerAddress) {
    try {
      checks.sponsorVerification = await getSponsorVerification(
        ctx.provider,
        signerAddress,
        config.sponsorOpenAccess
      );
    } catch (e) {
      issues.push(`Sponsor verification check failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    ok: issues.length === 0,
    serverVersion: SERVER_VERSION,
    issues,
    checks,
    safety: ctx.safetySummary(signerAddress),
  };
}

export function listCapabilities(ctx: MedVaultMcpContext, signerAddress: string | null) {
  return {
    serverVersion: SERVER_VERSION,
  ...ctx.safetySummary(signerAddress),
    readTools: [...READ_TOOL_NAMES],
    writeTools: ctx.readOnly ? [] : [...WRITE_TOOL_NAMES],
    optionalEnvVars: [
      "MEDVAULT_SPONSOR_OPEN_ACCESS",
      "MCP_MAX_ETH_PER_TX",
      "MEDVAULT_RELAYER_URL",
      "MCP_READ_ONLY",
      "MCP_AUDIT_LOG",
      "MCP_HTTP_PORT",
      "MCP_HTTP_HOST",
      "AI_SERVICE_URL",
      "VITE_AI_SERVICE_URL",
    ],
  };
}

export function getClientConfigHelp(client?: string) {
  if (client && client in CLIENT_HELP) {
    return { client, ...CLIENT_HELP[client as keyof typeof CLIENT_HELP] };
  }
  return { clients: CLIENT_HELP };
}

export async function getProtocolHealth(ctx: MedVaultMcpContext) {
  const out: Record<string, unknown> = { ok: true, checks: {} as Record<string, unknown> };
  const checks = out.checks as Record<string, unknown>;

  try {
    checks.wiring = await checkWiring(ctx.provider, ctx.config.networkKey);
  } catch (e) {
    out.ok = false;
    checks.wiringError = e instanceof Error ? e.message : String(e);
  }

  checks.protocolContracts = PROTOCOL_CONTRACTS.length;

  if (ctx.config.subgraphUrl) {
    try {
      const trials = await postSubgraph(ctx.config.subgraphUrl, "GetActiveTrials", { first: 3, skip: 0 });
      checks.subgraph = { ok: true, activeTrialsSample: (trials?.trials ?? []).length };
    } catch (e) {
      out.ok = false;
      checks.subgraph = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.subgraph = { ok: false, error: "MEDVAULT_SUBGRAPH_URL not set" };
    out.ok = false;
  }

  if (ctx.config.relayerUrl) {
    try {
      const base = ctx.config.relayerUrl.replace(/\/$/, "");
      const res = await fetch(`${base}/health`);
      checks.relayer = { ok: res.ok, status: res.status };
      if (!res.ok) out.ok = false;
    } catch (e) {
      out.ok = false;
      checks.relayer = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.relayer = { ok: null, note: "MEDVAULT_RELAYER_URL not set" };
  }

  return out;
}

export async function getSponsorOverview(
  ctx: MedVaultMcpContext,
  sponsor: string,
  signerAddress: string | null
) {
  const sponsorLower = sponsor.toLowerCase();
  const isSelf = signerAddress?.toLowerCase() === sponsorLower;

  const [trials, matches, stats, verification] = await Promise.all([
    postSubgraph(ctx.config.subgraphUrl, "GetTrialsBySponsor", { sponsor: sponsorLower }),
    postSubgraph(ctx.config.subgraphUrl, "GetSponsorData", { sponsor: sponsorLower }),
    postSubgraph(ctx.config.subgraphUrl, "GetSponsorStats", { sponsor: sponsorLower }),
    getSponsorVerification(ctx.provider, sponsorLower, ctx.config.sponsorOpenAccess),
  ]);

  const trialList = (trials as { trials?: { id: string; endTime?: string }[] })?.trials ?? [];
  const poolFlags = await Promise.all(
    trialList.slice(0, 20).map(async (t) => {
      const { getTrialPoolReclaimStatus } = await import("@medvault/core");
      const status = await getTrialPoolReclaimStatus(
        ctx.tryGetSigner() ?? ctx.provider,
        t.id,
        t.endTime
      );
      return {
        trialId: t.id,
        poolFunded: status.poolFunded,
        participantCount: status.participantCount,
        totalFunded: isSelf && status.sponsorAuthorized ? status.totalFunded : null,
      };
    })
  );

  return {
    sponsor: sponsorLower,
    signerIsSponsor: isSelf,
    verification,
    trials,
    matches,
    stats,
    poolSummary: poolFlags,
    privacyNote: "Exact pool amounts appear only when the connected signer is the sponsor.",
  };
}

export function previewFundTrialPool(trialId: string, amountEth: string, ctx: MedVaultMcpContext) {
  ctx.assertFundAmount(amountEth);
  let valueWei: string;
  try {
    valueWei = ethers.parseEther(amountEth).toString();
  } catch (e) {
    throw new Error(`Invalid amountEth: ${e instanceof Error ? e.message : String(e)}`);
  }
  return {
    dryRun: true,
    trialId,
    amountEth,
    valueWei,
    contract: "SponsorIncentiveVault",
    functionName: "fundTrial",
    network: "ethereum-sepolia",
    chainId: 11155111,
    note: "No transaction submitted. Sponsor must be trial owner and trial must be active.",
  };
}

export async function getTrialOperationsTimeline(ctx: MedVaultMcpContext, trialId: string) {
  const sponsorLower = ctx.tryGetSigner() ? await ctx.tryGetSigner()!.getAddress() : null;
  const trialData = await postSubgraph<{ trials?: { id: string; sponsor?: string; createdAt?: string; endTime?: string }[] }>(
    ctx.config.subgraphUrl,
    "GetTrialsBySponsor",
    { sponsor: sponsorLower?.toLowerCase() ?? "0x0000000000000000000000000000000000000000" }
  );

  const { getTrialPoolReclaimStatus } = await import("@medvault/core");
  const pool = await getTrialPoolReclaimStatus(ctx.tryGetSigner() ?? ctx.provider, trialId);

  let applications: unknown = null;
  try {
    applications = await postSubgraph(ctx.config.subgraphUrl, "GetSponsorData", {
      sponsor: pool.trialSponsor ?? sponsorLower,
    });
  } catch {
    /* optional */
  }

  return {
    trialId,
    pool,
    applications,
    milestonesNote: "Use medvault_read_contract_view on TrialMilestoneManager for on-chain milestone state.",
    subgraphTrialsSample: trialData,
  };
}
