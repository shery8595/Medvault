import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const READ_TOOLS = [
    { name: "medvault_get_config", desc: "Addresses, URLs, safety summary, optional signer" },
    { name: "medvault_list_protocol_contracts", desc: "Protocol contract catalog" },
    { name: "medvault_check_wiring", desc: "Vault / automation / milestone cross-checks" },
    { name: "medvault_subgraph_query", desc: "Allowlisted GraphQL only (no arbitrary queries)" },
    { name: "medvault_get_active_trials", desc: "Active trials from subgraph" },
    { name: "medvault_get_sponsor_trials", desc: "Trials for a sponsor address" },
    { name: "medvault_get_sponsor_matches", desc: "Matches, applications, anonymous submissions" },
    { name: "medvault_get_sponsor_stats", desc: "Sponsor dashboard aggregates" },
    { name: "medvault_get_audit_logs", desc: "Subgraph + chain audit entries" },
    { name: "medvault_get_sponsor_verification", desc: "SponsorRegistry status" },
    {
        name: "medvault_get_trial_pool_status",
        desc: "Public coarse pool status (funded flag, participants, reclaim flags) — no amounts",
    },
    {
        name: "medvault_get_sponsor_trial_pool_details",
        desc: "Sponsor-authorized deposited/reclaimable amounts (requires trial sponsor MCP_PRIVATE_KEY)",
    },
    { name: "medvault_read_contract_view", desc: "Generic eth_call (dev); sensitive vault views blocklisted" },
    { name: "medvault_relayer_health", desc: "GET /health when MEDVAULT_RELAYER_URL set" },
    { name: "medvault_doctor", desc: "Setup diagnostic: env, build, RPC, subgraph, sponsor" },
    { name: "medvault_list_capabilities", desc: "Tools, transports, read-only mode, privacy boundaries" },
    { name: "medvault_get_client_config_help", desc: "Per-client config paths and env interpolation" },
    { name: "medvault_get_protocol_health", desc: "Wiring + subgraph + relayer health aggregate" },
    { name: "medvault_get_sponsor_overview", desc: "Trials, matches, stats; amounts only when signer is sponsor" },
    { name: "medvault_preview_fund_trial_pool", desc: "Dry-run fundTrial preview without submitting tx" },
    { name: "medvault_get_trial_operations_timeline", desc: "Pool status + subgraph context for a trial" },
];

const WRITE_TOOLS = [
    { name: "medvault_create_trial", desc: "TrialManager.createTrial + optional milestones / fund" },
    { name: "medvault_set_trial_milestones", desc: "Phased payout schedule" },
    { name: "medvault_fund_trial_pool", desc: "Send ETH to incentive vault (sponsor only)" },
    { name: "medvault_update_application_status", desc: "EligibilityEngine status (+ vault register on accept)" },
    { name: "medvault_deactivate_trial", desc: "TrialManager.deactivateTrial" },
    { name: "medvault_distribute_milestone", desc: "Partial milestone distribution" },
    { name: "medvault_register_anonymous_participant", desc: "Vault register by nullifier" },
    { name: "medvault_reclaim_trial_pool", desc: "Reclaim undistributed pool funds" },
];

function ToolTable({ tools }: { tools: typeof READ_TOOLS }) {
    return (
        <div className="not-prose overflow-x-auto my-4">
            <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="text-left p-3 font-semibold">Tool</th>
                        <th className="text-left p-3 font-semibold">Description</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {tools.map((t) => (
                        <tr key={t.name}>
                            <td className="p-3 font-mono text-xs text-[#00685f]">{t.name}</td>
                            <td className="p-3 text-slate-700">{t.desc}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function McpToolsDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    All tools are prefixed with <code>medvault_</code> and run against <strong>Ethereum Sepolia</strong> (
                    chain id <code>11155111</code>). MCP is a <strong>sponsor/developer console</strong> — not for
                    patients. Write tools require a verified sponsor wallet unless{" "}
                    <code>MEDVAULT_SPONSOR_OPEN_ACCESS=true</code>. Set <code>MCP_READ_ONLY=true</code> to disable
                    writes.
                </p>

                <Callout type="info" title="Pool amount privacy">
                    Ask &quot;Is the pool funded?&quot; via <code>medvault_get_trial_pool_status</code>. Exact ETH
                    amounts require <code>medvault_get_sponsor_trial_pool_details</code> with the trial sponsor&apos;s{" "}
                    <code>MCP_PRIVATE_KEY</code>.
                </Callout>

                <h2>Read tools</h2>
                <p>Most read tools work without a private key. Pool amounts are the main exception.</p>
                <ToolTable tools={READ_TOOLS} />

                <h2>Write tools (sponsor)</h2>
                <p>
                    Require <code>MCP_PRIVATE_KEY</code>, not <code>MCP_READ_ONLY</code>, and{" "}
                    <Link to="/docs/sponsor-system" className="text-[#00685f] font-semibold hover:underline">
                        sponsor verification
                    </Link>
                    .
                </p>
                <ToolTable tools={WRITE_TOOLS} />

                <Callout type="info" title="Out of scope (v1)">
                    Patient registration, FHE encrypt/decrypt, consent grant/revoke, Semaphore identity generation, and
                    relayer stage/finalize are not exposed. Use the browser dApp and{" "}
                    <Link to="/docs/identity-privacy" className="font-semibold text-[#00685f] hover:underline">
                        identity &amp; relayer
                    </Link>{" "}
                    docs instead.
                </Callout>

                <p>
                    <Link to="/docs/mcp/setup" className="text-[#00685f] font-semibold hover:underline">
                        Setup &amp; clients
                    </Link>{" "}
                    ·{" "}
                    <Link to="/docs/mcp/sdk" className="text-[#00685f] font-semibold hover:underline">
                        TypeScript SDK
                    </Link>
                    ,{" "}
                    <Link to="/docs/mcp" className="text-[#00685f] font-semibold hover:underline">
                        MCP overview
                    </Link>
                </p>
            </Prose>
        </motion.div>
    );
}
