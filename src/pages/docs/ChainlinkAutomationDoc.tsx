import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export function ChainlinkAutomationDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <p className="lead not-prose text-lg text-slate-600 max-w-3xl">
                    Trial expiry finalization runs through <strong>MedVaultAutomation</strong> on Ethereum Sepolia.
                    MedVault supports <strong>Chainlink CRE</strong> (Runtime Environment) with an{" "}
                    <code>AutomationReceiver</code> bridge, and an <strong>owner cron</strong> scheduler that calls the
                    same <code>checkUpkeep</code> / <code>performUpkeep</code> interface. FHE eligibility remains
                    separate (<strong>MedVaultRegistry</strong> / <strong>EligibilityEngine</strong>).
                </p>

                <Callout type="info" title="Two supported drivers">
                    <strong>CRE</strong> — workflow polls off-chain, forwards via <code>AutomationReceiver</code> (
                    <code>chainlinkForwarder</code>). <strong>Owner cron</strong> — scheduled Node job (e.g. Railway
                    Cron every 5 min) submits <code>performUpkeep</code> as contract owner. Same on-chain outcome;
                    pick based on ops preference. Repo markdown:{" "}
                    <code>docs/AUTOMATION_CRON.md</code>.
                </Callout>

                <Callout type="warning" title="CLA → CRE migration">
                    Chainlink Automation v1/v2 upkeeps are being retired (Sepolia testnet cutoff June 2026). MedVault
                    migrates via the official <strong>automation-migration-ts</strong> template: a CRE cron workflow calls{" "}
                    <code>checkUpkeep</code> off-chain, then forwards <code>performUpkeep</code> through{" "}
                    <code>AutomationReceiver</code>. See <code>cre/README.md</code> in the repo.
                </Callout>

                <h2>Architecture</h2>
                <h3>Chainlink CRE</h3>
                <CodeBlock
                    language="text"
                    filename="Call flow"
                    code={`CRE cron workflow (every ~5 min)
  → eth_call MedVaultAutomation.checkUpkeep("0x")
  → if needed: AutomationReceiver.onReport → performUpkeep(performData)
  → MedVaultAutomation.finalized[trialId], vault.distribute, trialManager.deactivateTrial`}
                />

                <h3>Owner cron (alternative)</h3>
                <CodeBlock
                    language="text"
                    filename="Call flow"
                    code={`Railway Cron */5 * * * * (or VM crontab)
  → eth_call MedVaultAutomation.checkUpkeep("0x")
  → if needed: owner.performUpkeep(performData)
  → process exits`}
                />
                <p>
                    Deploy a standalone Node cron package (private repo) with <code>PRIVATE_KEY</code> ={" "}
                    <code>MedVaultAutomation.owner()</code>. No <code>AutomationReceiver</code> tx path required.
                    Full ops guide: <code>docs/AUTOMATION_CRON.md</code>.
                </p>

                <h3>On-chain contracts</h3>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold">Contract</th>
                                <th className="text-left px-3 py-2 font-bold">Role</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">MedVaultAutomation</td>
                                <td className="px-3 py-2">
                                    Legacy upkeep target — <code>checkUpkeep</code> / <code>performUpkeep</code> unchanged
                                </td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">AutomationReceiver</td>
                                <td className="px-3 py-2">
                                    CRE bridge — receives Keystone reports, allowlisted forward to{" "}
                                    <code>performUpkeep(bytes)</code>
                                </td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">TrialManager</td>
                                <td className="px-3 py-2">
                                    <code>onTrialCreated</code> / <code>onTrialDeactivated</code> hooks via{" "}
                                    <code>automationContract</code>
                                </td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2 font-mono">SponsorIncentiveVault</td>
                                <td className="px-3 py-2">
                                    <code>distribute(trialId)</code> — milestone 0 (screening) staging at trial end
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>What MedVaultAutomation does</h2>
                <ul>
                    <li>
                        <strong><code>checkUpkeep</code></strong> scans active / expired trial IDs and returns{" "}
                        <code>upkeepNeeded = true</code> when a trial is still active, has <code>endTime &gt; 0</code>, block
                        time is past <code>endTime</code>, and <code>finalized[trialId]</code> is false.
                    </li>
                    <li>
                        <strong><code>performUpkeep</code></strong> (via <code>onlyForwarder</code> — CRE{" "}
                        <code>AutomationReceiver</code>, scheduled <strong>owner</strong>, or manual owner) decodes task
                        type <code>1</code>, runs <code>vault.distribute(trialId)</code> (paginated when &gt; 20
                        participants), then <code>trialManager.deactivateTrial(trialId)</code> when distribution
                        completes.
                    </li>
                </ul>

                <Callout type="info" title="Screening (milestone 0) only">
                    At trial end, <code>performUpkeep</code> stages milestone 0 entitlements. Patients{" "}
                    <code>confirmReceipt</code> to receive cETH. Later milestones are sponsor-driven via{" "}
                    <code>distributePartial</code> on <strong>SponsorIncentiveVault</strong>.
                </Callout>

                <h2>CRE setup (Sepolia)</h2>
                <ol>
                    <li>
                        Install <strong>CRE CLI</strong> and <strong>Bun</strong> (TypeScript workflows). Repo scripts
                        assume tools on PATH (e.g. <code>D:\cre-cli</code>, <code>D:\bun\bin</code> on Windows).
                    </li>
                    <li>
                        <code>cre login</code> (or set <code>CRE_API_KEY</code> in <code>.env</code>).
                    </li>
                    <li>
                        Deploy bridge: <code>npm run deploy:cre-receiver:sepolia</code>
                    </li>
                    <li>
                        Wire allowlist + identity: <code>npm run wire:cre-receiver:sepolia</code>
                    </li>
                    <li>
                        After 6h timelock: <code>npx hardhat run scripts/finish-wiring.ts --network sepolia</code> — sets{" "}
                        <code>MedVaultAutomation.chainlinkForwarder</code> to <code>AutomationReceiver</code>.
                    </li>
                    <li>
                        <code>npm run cre:install</code> then <code>npm run cre:simulate</code> /{" "}
                        <code>npm run cre:deploy</code>
                    </li>
                </ol>

                <h2>Ops scripts</h2>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold">Script / npm</th>
                                <th className="text-left px-3 py-2 font-bold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">deploy:cre-receiver:sepolia</td>
                                <td className="px-3 py-2">Deploy <code>AutomationReceiver</code> (KeystoneForwarder in constructor)</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">wire:cre-receiver:sepolia</td>
                                <td className="px-3 py-2">
                                    <code>setCallAllowed</code>, gas limit, workflow identity, schedule forwarder
                                </td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">verify:cre-receiver:sepolia</td>
                                <td className="px-3 py-2">On-chain receiver + forwarder + <code>checkUpkeep</code> state</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">check:forwarder-timelock:sepolia</td>
                                <td className="px-3 py-2">When <code>applyChainlinkForwarder</code> is allowed</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">cre:simulate / cre:deploy</td>
                                <td className="px-3 py-2">CRE workflow simulate and production deploy</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">diagnose-automation-upkeep.ts</td>
                                <td className="px-3 py-2">Trial expiry / forwarder debugging</td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2 font-mono">docs/AUTOMATION_CRON.md</td>
                                <td className="px-3 py-2">
                                    Owner cron package — Railway <code>*/5 * * * *</code>, env vars, deploy checklist
                                </td>
                            </tr>
                            <tr>
                                <td className="px-3 py-2 font-mono">deploy:chainlink-forwarder:sepolia</td>
                                <td className="px-3 py-2">
                                    <strong>Legacy CLA only</strong> — point forwarder at per-upkeep CLA forwarder (superseded by CRE)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>Permission model</h2>
                <p>
                    <code>MedVaultAutomation.chainlinkForwarder</code> must authorize whoever calls{" "}
                    <code>performUpkeep</code>. Under CRE, set it to your deployed <code>AutomationReceiver</code> (not the
                    Keystone forwarder directly — the receiver calls <code>performUpkeep</code> and becomes{" "}
                    <code>msg.sender</code>). Changes use <code>scheduleChainlinkForwarder</code> /{" "}
                    <code>applyChainlinkForwarder</code> (6-hour timelock). The contract owner may also call{" "}
                    <code>performUpkeep</code> — used by the <strong>owner cron</strong> scheduler or for one-off testing.
                </p>

                <h2>Owner cron setup</h2>
                <ol>
                    <li>
                        Standalone Node package with <code>checkUpkeep</code> → <code>performUpkeep</code> loop (private
                        repo).
                    </li>
                    <li>
                        Env: <code>PRIVATE_KEY</code> (owner), <code>MEDVAULT_AUTOMATION_ADDRESS</code>,{" "}
                        <code>SEPOLIA_RPC_URL</code>.
                    </li>
                    <li>
                        Host on <strong>Railway Cron</strong> — schedule <code>*/5 * * * *</code>, start command runs one
                        cycle and exits.
                    </li>
                </ol>
                <p>
                    See <code>docs/AUTOMATION_CRON.md</code>. CRE forwarder wiring is <strong>not</strong> required for the
                    owner cron path.
                </p>

                <h2>Chainlink price feeds (separate)</h2>
                <p>
                    <strong>TrialManager</strong> may use Chainlink ETH/USD feeds for fiat-denominated compensation — see{" "}
                    <Link to="/docs/contracts" className="text-blue-700 font-semibold">
                        contract reference
                    </Link>
                    . That is independent of CRE trial finalization.
                </p>

                <Callout type="tip" title="Simulation says “No upkeep needed”?">
                    Expected when no trials are past <code>endTime</code>. Create a trial with a short duration, wait for
                    expiry, then re-run <code>npm run cre:simulate</code>.
                </Callout>

                <Callout type="tip" title="Read next">
                    <Link to="/docs/timelock-wiring" className="text-blue-700 font-semibold">
                        Timelock wiring
                    </Link>
                    ,{" "}
                    <Link to="/docs/deployment" className="text-blue-700 font-semibold">
                        Deployment guide
                    </Link>
                    , repo <code>cre/README.md</code>, and{" "}
                    <code>docs/AUTOMATION_CRON.md</code>.
                </Callout>
            </Prose>
        </motion.div>
    );
}
