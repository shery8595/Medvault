import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export function McpServerDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-3 my-6">
                    {[
                        { href: "/docs/mcp/sdk", title: "TypeScript SDK", desc: "MedVaultSDK — trials, sponsor, relayer" },
                        { href: "/docs/mcp/setup", title: "Setup & clients", desc: "Env vars, Cursor, Codex, HTTP" },
                        { href: "/docs/mcp/tools", title: "Tool reference", desc: "All medvault_* read & write tools" },
                    ].map((card) => (
                        <Link
                            key={card.href}
                            to={card.href}
                            className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-[#00685f]/40 hover:shadow-sm transition-all"
                        >
                            <p className="text-sm font-bold text-slate-900 m-0">{card.title}</p>
                            <p className="text-xs text-slate-500 mt-1 m-0">{card.desc}</p>
                        </Link>
                    ))}
                </div>

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    The <strong>MedVault MCP server</strong> is a local{" "}
                    <a
                        href="https://modelcontextprotocol.io"
                        className="text-[#00685f] font-semibold hover:underline"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Model Context Protocol
                    </a>{" "}
                    bridge for <strong>developers</strong> and <strong>sponsors</strong> — protocol debugging and
                    sponsor trial operations, not patient-facing flows. It does not run inside the browser app.
                </p>

                <Callout type="info" title="Separate from the dApp">
                    The React portal uses <code>VITE_*</code> env vars. MCP uses its own process env. End users of{" "}
                    <a href="https://med-vault.xyz" className="font-semibold text-[#00685f] hover:underline">
                        med-vault.xyz
                    </a>{" "}
                    never need MCP configured.
                </Callout>

                <h2>What it does</h2>
                <ul>
                    <li>
                        <strong>Read:</strong> trials, matches, audit logs, wiring checks, subgraph (allowlisted), contract
                        metadata.
                    </li>
                    <li>
                        <strong>Write (sponsor):</strong> create trials, fund pools, update applications, milestones,
                        reclaim — with <code>MCP_PRIVATE_KEY</code> on a verified sponsor wallet.
                    </li>
                    <li>
                        <strong>Not in v1:</strong> patient FHE flows, consent, or anonymous relayer apply (see{" "}
                        <Link to="/docs/identity-privacy" className="text-[#00685f] font-semibold hover:underline">
                            Identity &amp; relayer
                        </Link>
                        ).
                    </li>
                </ul>

                <h2>Supported AI clients</h2>
                <p>
                    Cursor, OpenAI Codex, Claude Code, ChatGPT Desktop, Google Antigravity, and OpenClaw — one stdio server,
                    config snippets in <code>config/mcp/</code>. Details on{" "}
                    <Link to="/docs/mcp/setup" className="text-[#00685f] font-semibold hover:underline">
                        Setup &amp; clients
                    </Link>
                    .
                </p>

                <h2>Repository layout</h2>
                <CodeBlock
                    language="text"
                    code={`packages/medvault-sdk/   # @medvault/sdk — integrator facade
packages/medvault-core/  # RPC, contracts, subgraph (SDK dependency)
mcp-server/              # MCP entry (stdio + optional HTTP)
config/mcp/              # Client config snippets`}
                />

                <p>
                    Integrators can use the SDK without MCP — see{" "}
                    <Link to="/docs/mcp/sdk" className="text-[#00685f] font-semibold hover:underline">
                        TypeScript SDK
                    </Link>
                    .
                </p>

                <h2>Quick start</h2>
                <CodeBlock
                    language="bash"
                    code={`npm install
npm run mcp:build
npm run mcp:export-config
npm run mcp:validate-config

# Set env in your shell (see Setup page)
export SEPOLIA_RPC_URL=...
export MEDVAULT_SUBGRAPH_URL=...   # same as VITE_SUBGRAPH_URL

npm run mcp:doctor   # optional
npm run mcp:smoke    # offline; mcp:smoke:live for Sepolia`}
                />

                <h2>Security</h2>
                <ul>
                    <li>Runs locally — no MedVault-hosted MCP endpoint in production.</li>
                    <li>Dedicated Sepolia wallet; never commit <code>MCP_PRIVATE_KEY</code>.</li>
                    <li>No decrypted patient vitals via MCP.</li>
                </ul>

                <Callout type="warning" title="No hosting required">
                    Clone the repo, build locally, configure your IDE. The live dApp is unchanged.
                </Callout>
            </Prose>
        </motion.div>
    );
}
