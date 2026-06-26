import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const CURSOR_SNIPPET = `{
  "mcpServers": {
    "medvault": {
      "command": "node",
      "args": ["\${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "SEPOLIA_RPC_URL": "\${env:SEPOLIA_RPC_URL}",
        "MEDVAULT_SUBGRAPH_URL": "\${env:MEDVAULT_SUBGRAPH_URL}",
        "MCP_PRIVATE_KEY": "\${env:MCP_PRIVATE_KEY}"
      }
    }
  }
}`;

const CODEX_SNIPPET = `[mcp_servers.medvault]
command = "node"
args = ["<repo>/mcp-server/dist/index.js"]
enabled = true

[mcp_servers.medvault.env]
SEPOLIA_RPC_URL = "..."
MEDVAULT_SUBGRAPH_URL = "..."
MCP_PRIVATE_KEY = "..."`;

export function McpSetupDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    MCP runs as a <strong>local Node process</strong>. Your IDE spawns it via stdio — you set environment
                    variables on your machine, not in the Vite <code>.env</code> used by the web app (unless you export
                    those vars into your shell before launching Cursor).
                </p>

                <h2>Build once per clone</h2>
                <CodeBlock
                    language="bash"
                    code={`npm install
npm run mcp:build
npm run mcp:export-config   # portable config/mcp/* + local .cursor/mcp.json, .mcp.json
npm run mcp:validate-config
npm run mcp:doctor          # optional`}
                />
                <p>
                    For integrator scripts without MCP, see{" "}
                    <Link to="/docs/mcp/sdk" className="text-[#00685f] font-semibold hover:underline">
                        TypeScript SDK
                    </Link>{" "}
                    (<code>npm run sdk:build</code>).
                </p>

                <h2>Environment variables</h2>
                <div className="not-prose overflow-x-auto my-4">
                    <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Variable</th>
                                <th className="text-left p-3 font-semibold">When</th>
                                <th className="text-left p-3 font-semibold">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            <tr>
                                <td className="p-3 font-mono text-xs">SEPOLIA_RPC_URL</td>
                                <td className="p-3">Always</td>
                                <td className="p-3">Ethereum Sepolia JSON-RPC</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MEDVAULT_SUBGRAPH_URL</td>
                                <td className="p-3">Indexed reads</td>
                                <td className="p-3">Copy from <code>VITE_SUBGRAPH_URL</code> in <code>.env.example</code></td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MCP_PRIVATE_KEY</td>
                                <td className="p-3">Write tools</td>
                                <td className="p-3">Sponsor wallet — never commit</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MEDVAULT_SPONSOR_OPEN_ACCESS</td>
                                <td className="p-3">Optional</td>
                                <td className="p-3">
                                    <code>true</code> bypasses SponsorRegistry (testnet only)
                                </td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MCP_MAX_ETH_PER_TX</td>
                                <td className="p-3">Optional</td>
                                <td className="p-3">Caps <code>medvault_fund_trial_pool</code></td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MEDVAULT_RELAYER_URL</td>
                                <td className="p-3">Optional</td>
                                <td className="p-3">Relayer health checks</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-mono text-xs">MCP_READ_ONLY</td>
                                <td className="p-3">Optional</td>
                                <td className="p-3">
                                    <code>true</code> disables write tools
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Per-client configuration</h2>

                <h3>Cursor</h3>
                <p>
                    Copy <code>config/mcp/cursor.mcp.json</code> to <code>.cursor/mcp.json</code> (gitignored) or use the
                    exported file from <code>npm run mcp:export-config</code>. Reload MCP in Cursor settings.
                </p>
                <CodeBlock language="json" code={CURSOR_SNIPPET} />

                <h3>Claude Code</h3>
                <p>
                    Run <code>npm run mcp:export-config</code> to generate <code>.mcp.json</code> at repo root
                    (gitignored), or merge <code>config/mcp/claude.mcp.json</code>. Alternatively:{" "}
                    <code>claude mcp add medvault -- node mcp-server/dist/index.js</code> after <code>mcp:build</code>.
                </p>

                <h3>OpenAI Codex</h3>
                <p>
                    Merge <code>config/mcp/codex.toml</code> into <code>~/.codex/config.toml</code> (or project{" "}
                    <code>.codex/config.toml</code> when trusted).
                </p>
                <CodeBlock language="toml" code={CODEX_SNIPPET} />

                <h3>ChatGPT Desktop</h3>
                <p>
                    Use <code>config/mcp/chatgpt.mcp.json</code> at the OS-specific path documented in{" "}
                    <code>config/mcp/README.md</code>. If your build only supports remote connectors, use HTTP below.
                </p>

                <h3>Google Antigravity</h3>
                <p>
                    Paste <code>config/mcp/antigravity.mcp.json</code> into Antigravity&apos;s MCP config. Local servers use{" "}
                    <code>command</code> / <code>args</code>; remote servers use <code>serverUrl</code> (not{" "}
                    <code>url</code>).
                </p>

                <h3>OpenClaw</h3>
                <p>
                    Merge <code>config/mcp/openclaw.json</code> into <code>~/.openclaw/openclaw.json</code> and run{" "}
                    <code>openclaw gateway restart</code> if the gateway caches servers.
                </p>

                <h2>Optional HTTP transport</h2>
                <p>For clients that require a URL (e.g. ChatGPT Connectors developer mode):</p>
                <CodeBlock language="bash" code="npm run mcp:http" />
                <p>
                    Default: <code>http://127.0.0.1:3100/mcp</code> · health check: <code>/health</code>. Tunnel with ngrok
                    or similar if the client cannot reach localhost.
                </p>

                <Callout type="warning" title="Security">
                    Never commit <code>MCP_PRIVATE_KEY</code>. Use a dedicated Sepolia test wallet with minimal ETH. MCP
                    cannot decrypt patient health data.
                </Callout>

                <p>
                    <Link to="/docs/mcp/tools" className="text-[#00685f] font-semibold hover:underline">
                        Tool reference
                    </Link>{" "}
                    ·{" "}
                    <Link to="/docs/mcp" className="text-[#00685f] font-semibold hover:underline">
                        MCP overview
                    </Link>
                </p>
            </Prose>
        </motion.div>
    );
}
