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
                    <strong>MedVaultAutomation</strong> uses Chainlink Automation (
                    <code>AutomationCompatibleInterface</code>) so trial lifecycle actions run without a centralized cron.
                    It pairs with <strong>TrialManager</strong> and <strong>SponsorIncentiveVault</strong> — separate from
                    FHE eligibility, which is handled by <strong>MedVaultRegistry</strong> /{" "}
                    <strong>EligibilityEngine</strong>.
                </p>

                <h2>What it does today</h2>
                <ul>
                    <li>
                        <strong><code>checkUpkeep</code></strong> scans only <em>active</em> trial IDs (tracked when trials
                        are created/deactivated) and returns <code>upkeepNeeded = true</code> when a trial is still active,
                        has a non-zero <code>endTime</code>, the block time is past <code>endTime</code>, and the trial has
                        not yet been marked finalized in <code>finalized[trialId]</code>.
                    </li>
                    <li>
                        <strong><code>performUpkeep</code></strong> (restricted via <code>onlyForwarder</code> to the
                        configured Chainlink forwarder or owner) decodes task type <code>1</code>, sets{" "}
                        <code>finalized[trialId] = true</code>, attempts <code>vault.distribute(trialId)</code> for any
                        incentive pool payout, then attempts <code>trialManager.deactivateTrial(trialId)</code>. Failures
                        in distribute/deactivate are swallowed where noted in contract comments so automation does not brick.
                    </li>
                </ul>

                <Callout type="info" title="Screening (milestone 0) only">
                    At trial end, <code>performUpkeep</code> calls <code>vault.distribute(trialId)</code>, which{" "}
                    <strong>stages milestone 0 (screening)</strong> entitlements for registered participants and emits{" "}
                    <code>MilestoneRewardsDistributed</code> for index <code>0</code>. Patients must{" "}
                    <code>confirmReceipt</code> to receive cETH. Later milestones are staged by the sponsor via{" "}
                    <code>distributePartial</code> / <code>distributeMilestoneToParticipant</code> on{" "}
                    <strong>SponsorIncentiveVault</strong>.
                </Callout>

                <h2>Task type 1 only</h2>
                <p>
                    <code>performUpkeep</code> decodes a single task type: <strong><code>1</code></strong> — finalize an
                    expired trial. It sets <code>finalized[trialId]</code>, calls <code>vault.distribute(trialId)</code>{" "}
                    (milestone 0 / screening staging), then <code>trialManager.deactivateTrial(trialId)</code>. No other task types
                    are implemented. <code>MedVaultAutomation</code> is <strong>not indexed</strong> by the subgraph.
                </p>

                <h2>Ops scripts</h2>
                <div className="not-prose overflow-x-auto my-4 rounded-xl border border-slate-200 text-xs">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold">Script</th>
                                <th className="text-left px-3 py-2 font-bold">npm alias</th>
                                <th className="text-left px-3 py-2 font-bold">Purpose</th>
                            </tr>
                        </thead>
                        <tbody className="text-slate-600">
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">set-chainlink-forwarder.ts</td>
                                <td className="px-3 py-2 font-mono">deploy:chainlink-forwarder:sepolia</td>
                                <td className="px-3 py-2">Schedule/apply real forwarder (2-day timelock)</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">diagnose-automation-upkeep.ts</td>
                                <td className="px-3 py-2">—</td>
                                <td className="px-3 py-2">Print checkUpkeep, forwarder, trial expiry state</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                                <td className="px-3 py-2 font-mono">finish-wiring.ts</td>
                                <td className="px-3 py-2 font-mono">deploy:wiring:sepolia</td>
                                <td className="px-3 py-2">Apply automation/vault timelocks after deploy</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <h2>II. Chainlink forwarder</h2>
                <p>
                    The owner sets <code>chainlinkForwarder</code> via{" "}
                    <code>scheduleChainlinkForwarder</code> / <code>applyChainlinkForwarder</code> (2-day timelock on live
                    networks). Only that address (or <code>owner</code>) may call <code>performUpkeep</code>, matching
                    Chainlink&apos;s forwarder pattern. The constructor requires a <strong>non-zero</strong> placeholder
                    at deploy.
                </p>

                <h2>Relationship to Chainlink Price Feeds</h2>
                <p>
                    <strong>TrialManager</strong> may consult Chainlink <strong>ETH/USD</strong> style feeds when sponsors
                    activate trials with fiat-denominated compensation — see{" "}
                    <Link to="/docs/contracts" className="text-blue-700 font-semibold">
                        contract reference (price feeds section)
                    </Link>
                    . That oracle usage is independent of Automation upkeep registration for{" "}
                    <code>MedVaultAutomation</code>.
                </p>

                <h2>Deploy &amp; ops checklist</h2>
                <ul>
                    <li>Deploy <code>MedVaultAutomation</code> with <code>TrialManager</code> and vault addresses.</li>
                    <li>
                        Ensure <code>TrialManager.scheduleAutomationContract</code> /{" "}
                        <code>applyAutomationContract</code> points at this automation contract so new trials call{" "}
                        <code>onTrialCreated</code> (instant <code>setAutomationContract</code> reverts).
                    </li>
                    <li>
                        Register an upkeep in the Chainlink Automation UI for this contract (
                        <code>checkUpkeep</code>/<code>performUpkeep</code>) on Ethereum Sepolia (or your network).
                    </li>
                    <li>
                        After registration, copy the <strong>Forwarder address</strong> from your upkeep&apos;s Details page
                        (per-upkeep, not a global network address) and call{" "}
                        <code>scheduleChainlinkForwarder(forwarder)</code> / <code>applyChainlinkForwarder</code> on{" "}
                        <code>MedVaultAutomation</code>, or <code>npm run deploy:chainlink-forwarder:sepolia</code>.
                        Until the forwarder is applied, Chainlink&apos;s simulated <code>performUpkeep</code> reverts and
                        the upkeep never shows a run date.
                    </li>
                    <li>
                        <code>checkData</code> can be empty (<code>0x</code>) — the contract ignores it.
                    </li>
                </ul>

                <Callout type="warning" title="Upkeep not running?">
                    Run <code>npx hardhat run scripts/diagnose-automation-upkeep.ts --network sepolia</code>.
                    If <code>checkUpkeep</code> is <code>true</code> but <code>chainlinkForwarder</code> is{" "}
                    <code>0x000…000</code>, set the forwarder from the Chainlink UI with{" "}
                    <code>scripts/set-chainlink-forwarder.ts</code>. The contract owner may also call{" "}
                    <code>performUpkeep</code> manually to finalize one expired trial per transaction while testing.
                </Callout>

                <CodeBlock
                    language="text"
                    filename="Touchpoints"
                    code={`contracts/MedVaultAutomation.sol — AutomationCompatibleInterface
contracts/TrialManager.sol — onTrialCreated / onTrialDeactivated hooks (via automation reference)
contracts/SponsorIncentiveVault.sol — distribute(trialId)`}
                />

                <Callout type="tip" title="Read next">
                    <Link to="/docs/architecture" className="text-blue-700 font-semibold">
                        Architecture
                    </Link>
                    ,{" "}
                    <Link to="/docs/contracts" className="text-blue-700 font-semibold">
                        Contract reference
                    </Link>
                    , and{" "}
                    <Link to="/docs/deployment" className="text-blue-700 font-semibold">
                        Deployment guide
                    </Link>
                    .
                </Callout>
            </Prose>
        </motion.div>
    );
}
