import { Link } from "react-router-dom";
import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";
import { motion } from "framer-motion";
import { Clock, ShieldCheck } from "lucide-react";

const timelockRows = [
    {
        contract: "TrialManager",
        reverts: "setAutomationContract, setEligibilityEngine, setSponsorRegistry",
        replacement: "scheduleAutomationContract / applyAutomationContract, …",
    },
    {
        contract: "EligibilityEngine",
        reverts: "setScoreLeaderboard, setConsentGate, setAutomation, …",
        replacement: "scheduleAuthorizedReader(role, addr) / applyAuthorizedReader(role)",
    },
    {
        contract: "SponsorIncentiveVault",
        reverts: "setAutomationContract, setMilestoneManager, setSponsorRegistry",
        replacement: "schedule* / apply* pairs",
    },
    {
        contract: "TrialMilestoneManager",
        reverts: "setVault, setTrialManager",
        replacement: "scheduleVault / applyVault, …",
    },
    {
        contract: "MedVaultAutomation",
        reverts: "setVault, setChainlinkForwarder",
        replacement: "scheduleVault / applyVault, scheduleChainlinkForwarder / applyChainlinkForwarder",
    },
    {
        contract: "ConfidentialETH",
        reverts: "authorizeContract",
        replacement: "scheduleContractAuth / applyContractAuth",
    },
    {
        contract: "ConsentManager",
        reverts: "setConsentGate",
        replacement: "scheduleConsentGate / applyConsentGate",
    },
    {
        contract: "DataAccessLog",
        reverts: "authorizeLogger",
        replacement: "scheduleAuthorizedLogger / applyAuthorizedLogger / cancelAuthorizedLoggerSchedule",
    },
    {
        contract: "SponsorRegistry",
        reverts: "(none instant)",
        replacement: "scheduleAuditor / applyAuditor",
    },
];

export function TimelockWiringDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                <div className="not-prose my-6 p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white flex gap-3 items-start">
                    <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 m-0">6-hour admin delay on live networks</p>
                        <p className="text-xs text-slate-600 mt-1 m-0">
                            <code>READER_CHANGE_DELAY = 6 hours</code> on affected contracts (relayer auth uses the same delay).
                            Hardhat tests fast-forward via <code>test-support/timelock.ts</code>; Sepolia requires{" "}
                            <code>npm run deploy:wiring:sepolia</code> after the delay.
                        </p>
                    </div>
                </div>

                <p className="lead not-prose text-base text-slate-600 max-w-3xl">
                    Cross-contract wiring (automation hooks, vault references, FHE reader ACL, cETH contract auth, audit
                    loggers) uses a <strong>schedule → wait → apply</strong> pattern instead of instant owner setters.
                    This gives operators time to detect malicious wiring before it takes effect.
                </p>

                <h2>I. Affected contracts</h2>
                <div className="not-prose overflow-x-auto my-6 rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="text-left px-3 py-2 font-bold text-xs">Contract</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Instant setter (reverts)</th>
                                <th className="text-left px-3 py-2 font-bold text-xs">Timelocked API</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-slate-600">
                            {timelockRows.map((row) => (
                                <tr key={row.contract} className="border-b border-slate-100">
                                    <td className="px-3 py-2 font-mono text-[#00685f]">{row.contract}</td>
                                    <td className="px-3 py-2">{row.reverts}</td>
                                    <td className="px-3 py-2">{row.replacement}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p>
                    <code>EligibilityEngine</code> reader roles are <code>bytes32</code> constants exported as{" "}
                    <code>ENGINE_READER_ROLES</code> in <code>scripts/lib/timelockWiring.ts</code> (automation, consent
                    gate, score leaderboard, sponsor vault, registry, verifier).
                </p>

                <h2>II. Sepolia deploy &amp; wiring</h2>
                <CodeBlock
                    language="bash"
                    filename="Terminal — Sepolia deploy flow"
                    code={`# Deploy stack (schedules timelocked wiring)
npm run deploy:sepolia

# Complete wiring if deploy stopped early (requires FHEVM plugin init on Sepolia)
npm run deploy:wire:sepolia

# After ~2 days, apply all pending schedule* operations
npm run deploy:wiring:sepolia

# Verify references on-chain
npm run deploy:check-wiring:sepolia

# Chainlink CRE (after deploy:cre-receiver + wire:cre-receiver)
npm run check:forwarder-timelock:sepolia
npm run deploy:wiring:sepolia
npm run verify:cre-receiver:sepolia`}
                />

                <Callout type="warning" title="FHEVM on live networks">
                    Deploy/wire scripts call <code>ensureFhevmInitialized()</code> so{" "}
                    <code>@fhevm/hardhat-plugin</code> can estimate gas on Sepolia. Without it, wiring txs may fail
                    with opaque plugin errors.
                </Callout>

                <Callout type="info" title="MedVaultAutomation — CRE or owner cron">
                    Deploy passes a <strong>non-zero</strong> forwarder placeholder. For CRE, point{" "}
                    <code>chainlinkForwarder</code> at <code>AutomationReceiver</code> (
                    <code>scheduleChainlinkForwarder</code> / <code>applyChainlinkForwarder</code>, or{" "}
                    <code>npm run wire:cre-receiver:sepolia</code>). For owner cron, scheduled upkeep uses the contract{" "}
                    owner key — see <code>docs/AUTOMATION_CRON.md</code>. Legacy CLA forwarders are deprecated.
                </Callout>

                <h2>III. Related API changes (same release)</h2>
                <ul>
                    <li>
                        <strong>MH-1:</strong> <code>AnonymousPatientRegistry.registerPatient</code> requires{" "}
                        <code>authorizedEngine != address(0)</code>.
                    </li>
                    <li>
                        <strong>Withdraw-to:</strong> <code>requestWithdrawTo</code> requires patient EIP-712{" "}
                        <code>WithdrawTo</code> signature (<code>nonce</code>, <code>deadline</code>,{" "}
                        <code>signature</code>). See{" "}
                        <Link to="/docs/private-withdrawals" className="font-semibold text-[#00685f] hover:underline">
                            Private withdrawals
                        </Link>
                        .
                    </li>
                    <li>
                        <strong>Claims:</strong> patients <code>confirmReceipt</code> after sponsor staging, then{" "}
                        <code>claimParticipantRewards</code> / <code>claimParticipantRewardsFor</code> forward withdraw-to
                        args; gasless claim EIP-712 binds{" "}
                        <code>encryptedAmountCommitment</code>.
                    </li>
                    <li>
                        <strong>cETH auth:</strong> fund-moving paths use <code>onlyAuthorizedContract</code>; vault must
                        call <code>completeWithdrawTo</code> — owner is excluded.
                    </li>
                    <li>
                        <strong>Reclaim:</strong> two-step pull pattern — <code>reclaimUndistributed</code> /{" "}
                        <code>reclaimAbandonedToOwner</code> schedule; <code>claimReclaimed</code> delivers ETH.
                        Failed transfers re-route to owner. <strong>Verified sponsors</strong> must complete screening
                        (or have zero participants) and milestone settlement before <code>reclaimUndistributed</code>.
                        <strong> Abandoned path (vault P2):</strong> when <code>isVerifiedSponsor(trial.sponsor)</code> is
                        false, only the vault owner may call <code>reclaimAbandonedToOwner</code> after trial end +
                        <code>RECLAIM_GRACE_PERIOD</code>; distribution-status gates are skipped so funds are not frozen.
                    </li>
                </ul>

                <h2>IV. Tests &amp; fixtures</h2>
                <div className="not-prose flex items-start gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 my-6">
                    <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-700">
                        <p className="font-bold m-0 mb-1">Case IDs TL-01–TL-06</p>
                        <p className="m-0 text-xs">
                            <code>test/unit/timelock-wiring.test.ts</code> — instant setter reverts, schedule/apply
                            delay, engine reader roles, MH-1, withdraw-to signature, full stack wiring via{" "}
                            <code>deployMedVaultStack()</code>. Helpers: <code>test-support/timelock.ts</code>,{" "}
                            <code>test-support/withdraw.ts</code> (<code>buildWithdrawToAuthorization</code>).
                        </p>
                    </div>
                </div>

                <CodeBlock
                    language="typescript"
                    filename="test-support/timelock.ts"
                    code={`import { scheduleAndApply, advanceTimelock, authorizeCethContract } from "../../test-support/timelock";

await scheduleAndApply(
  () => trialManager.scheduleAutomationContract(automationAddr),
  () => trialManager.applyAutomationContract()
);

await authorizeCethContract(cETH, owner, vaultAddress, true);`}
                />

                <h2>V. Production runbooks</h2>
                <p className="text-sm text-slate-600">
                    Markdown mirror with full script table: <code>docs/TIMELOCK_WIRING.md</code> and{" "}
                    <Link to="/docs/deployment" className="font-semibold text-[#00685f] hover:underline">
                        Deployment guide
                    </Link>{" "}
                    (sections VI–VII).
                </p>
                <ul className="text-sm">
                    <li>Full deploy: <code>deploy:sepolia</code> → wait 2 days → <code>deploy:wiring:sepolia</code></li>
                    <li>Wire only: <code>deploy:wire:sepolia</code></li>
                    <li>Chainlink CRE: <code>deploy:cre-receiver:sepolia</code> → <code>wire:cre-receiver:sepolia</code> → timelock → <code>cre:deploy</code></li>
                    <li>Attestation upgrade: <code>deploy:upgrade:sepolia</code> / <code>deploy:finish-upgrade:sepolia</code></li>
                </ul>

                <Callout type="tip" title="Read next">
                    <Link to="/docs/deployment" className="text-[#00685f] font-semibold">
                        Deployment guide
                    </Link>
                    ,{" "}
                    <Link to="/docs/automation" className="text-[#00685f] font-semibold">
                        Chainlink CRE
                    </Link>
                    ,{" "}
                    <Link to="/docs/security-model" className="text-[#00685f] font-semibold">
                        Security model
                    </Link>
                    ,{" "}
                    <Link to="/docs/testing/matrix" className="text-[#00685f] font-semibold">
                        Test matrix
                    </Link>
                    . Markdown mirror: <code>docs/TIMELOCK_WIRING.md</code>.
                </Callout>
            </Prose>
        </motion.div>
    );
}
