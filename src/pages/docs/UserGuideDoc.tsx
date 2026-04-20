import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Fingerprint, Stethoscope, ShieldAlert, BadgeCheck, DatabaseBackup, Building2, Lock, CheckCircle2 } from "lucide-react";

const patientJourneyChart = `
stateDiagram-v2
    [*] --> Unregistered
    Unregistered --> DataVault: Register + Encrypt Metrics (@cofhe/sdk)
    DataVault --> Applied: Apply for Trial
    Applied --> Matching: EligibilityEngine.computeEligibility()
    Matching --> ScoreReady: FHE Score stored on-chain (encrypted)
    ScoreReady --> ResultKnown: Patient signs EIP-712 Viewing Key
    ResultKnown --> Consented: Grant identity access to Sponsor
    ResultKnown --> NoConsent: Decline (trial entry closed)
    Consented --> [*]
    NoConsent --> DataVault: Apply for another trial
`;

const sponsorJourneyChart = `
stateDiagram-v2
    [*] --> Unverified
    Unverified --> KYC_Submitted: Off-chain identity submission
    KYC_Submitted --> Verified: Admin executes addSponsor()
    Verified --> TrialCreated: Create Trial + encrypt requirements
    TrialCreated --> Reviewing: Patients apply, Engine computes
    Reviewing --> Decision: View anonymized match counts via Subgraph
    Decision --> Accepted: updateApplicationStatus(Accepted)
    Decision --> Rejected: updateApplicationStatus(Rejected)
    Accepted --> Enrolled: Automatic Vault Registration
    Enrolled --> TrialEnds: Chainlink Automation triggers
    TrialEnds --> [*]: Milestone 0 Paid out
`;

const patientSteps = [
    { icon: <Fingerprint />, step: "1", title: "Connect & Register", color: "blue", desc: "Connect your MetaMask wallet to the Fhenix Sepolia testnet. In the Patient Dashboard, click 'Update Vault' and enter your medical metrics (Age, Blood Pressure, HbA1c, Weight). These are encrypted by `@cofhe/sdk` in your browser before being sent on-chain." },
    { icon: <Stethoscope />, step: "2", title: "Browse & Apply", color: "teal", desc: "Navigate to the Trials tab to browse all active trials indexed by The Graph Subgraph. Click 'Apply' on any trial that might match your profile. The `EligibilityEngine` will immediately compute a score by comparing your encrypted metrics against the trial's encrypted requirements." },
    { icon: <ShieldAlert />, step: "3", title: "Request Result (EIP-712)", color: "purple", desc: "In your Applications list, click 'Reveal Score'. This triggers MetaMask to show an EIP-712 signing request. You are not signing a transaction — you are generating a cryptographic viewing key that proves you own the wallet. The Fhenix network uses this key to decrypt your specific score mapping slot." },
    { icon: <BadgeCheck />, step: "4", title: "Grant Consent (Optional)", color: "emerald", desc: "If your score is 100 (perfect match), you may optionally choose to reveal your identity to the sponsor by clicking 'Grant Access'. This records a time-locked access token on-chain. The sponsor can now contact you directly through the DApp's encrypted messaging system." },
];

const edgeCases = [
    { icon: <DatabaseBackup />, title: "Data Revocation / Un-registration", color: "purple", desc: "To revoke your data, call `unregister()` in the Patient Registry. This deletes your ciphertext mappings on-chain. However, public structural metadata (application events) may still exist in the Subgraph. MedVault uses an `active` boolean in the GraphQL schema to filter these out from the UI." },
    { icon: <Lock />, title: "Sponsor Key Compromise", color: "rose", desc: "If a sponsor's private key is leaked, the attacker gains the ability to read decrypted profiles of patients who previously granted consent to that specific sponsor wallet. MedVault's `SponsorRegistry` admin can call `emergencyRemoveSponsor()` to instantly terminate all trial activity associated with the compromised wallet." },
    { icon: <Building2 />, title: "FHE Node Downtime", color: "amber", desc: "The Fhenix Sepolia testnet is a research network and may experience downtime. When the FHE coprocessor is unavailable, `computeEligibility()` transactions will simply fail at the RPC level. The MedVault frontend catches these failures and shows a clear 'Network Unavailable' banner rather than silently freezing." },
];
const colorStyles: Record<string, { iconBg: string; iconText: string; cardBorder: string; cardBg: string; stepBadge?: string }> = {
    blue: {
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconText: "text-blue-600 dark:text-blue-400",
        cardBorder: "border-blue-200 dark:border-blue-900/40",
        cardBg: "bg-blue-50/50 dark:bg-blue-950/10",
        stepBadge: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    },
    teal: {
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconText: "text-blue-600 dark:text-blue-400",
        cardBorder: "border-blue-200 dark:border-blue-900/40",
        cardBg: "bg-blue-50/50 dark:bg-blue-950/10",
        stepBadge: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    },
    purple: {
        iconBg: "bg-purple-100 dark:bg-purple-900/30",
        iconText: "text-purple-600 dark:text-purple-400",
        cardBorder: "border-purple-200 dark:border-purple-900/40",
        cardBg: "bg-purple-50/50 dark:bg-purple-950/10",
        stepBadge: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    },
    emerald: {
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconText: "text-emerald-600 dark:text-emerald-400",
        cardBorder: "border-emerald-200 dark:border-emerald-900/40",
        cardBg: "bg-emerald-50/50 dark:bg-emerald-950/10",
        stepBadge: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    },
    rose: {
        iconBg: "bg-rose-100 dark:bg-rose-900/30",
        iconText: "text-rose-600 dark:text-rose-400",
        cardBorder: "border-rose-200 dark:border-rose-900/40",
        cardBg: "bg-rose-50/50 dark:bg-rose-950/10",
        stepBadge: "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
    },
    amber: {
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconText: "text-amber-600 dark:text-amber-400",
        cardBorder: "border-amber-200 dark:border-amber-900/40",
        cardBg: "bg-amber-50/50 dark:bg-amber-950/10",
        stepBadge: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    },
};

export function UserGuideDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Operations</span>
                <h1 className="mt-2 text-5xl">User Workflows & State Machines</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    MedVault operates with strict cryptographic guarantees at every phase of the user lifecycle. This guide documents the exact steps for Patients and Sponsors, the precise state machine both parties traverse, and critical edge cases developers must handle.
                </p>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>I. The Patient Journey</h2>
                <p>
                    Patients are the absolute sovereign owners of their encrypted health data. Their workflow is a linear 4-step process, but each step involves distinct cryptographic operations.
                </p>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">Patient State Machine</h3>
                    <ul className="list-disc list-inside space-y-2 text-slate-300">
                        <li><strong>Unregistered:</strong> Initial state</li>
                        <li><strong>Registered:</strong> After sign up</li>
                        <li><strong>Matching:</strong> Running FHE evaluation against trials</li>
                        <li><strong>Matched:</strong> 100% eligibility achieved</li>
                        <li><strong>Approved:</strong> Sponsor accepted the match</li>
                        <li><strong>Staked:</strong> Tokens locked for trial</li>
                        <li><strong>Completed:</strong> Trial finished, rewards claimed</li>
                    </ul>
                </div>

                <div className="not-prose space-y-4 my-10">
                    {patientSteps.map((s, i) => {
                        const styles = colorStyles[s.color];
                        return (
                        <motion.div
                            key={s.step}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            viewport={{ once: true }}
                            className="flex gap-5 items-start p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
                        >
                            <div className={`p-3 rounded-2xl ${styles.iconBg} ${styles.iconText} shrink-0 mt-0.5`}>
                                {s.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-400">Step {s.step}</span>
                                </div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-white mt-0 mb-2">{s.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                            </div>
                        </motion.div>
                        );
                    })}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>II. The Sponsor Journey</h2>
                <p>
                    Sponsors are authorized pharmaceutical research institutions. They follow a strictly gated workflow that requires both off-chain KYC verification and on-chain admin approval before they can publish trials.
                </p>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8 mt-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">Sponsor State Machine</h3>
                    <ul className="list-disc list-inside space-y-2 text-slate-300">
                        <li><strong>Trial Setup:</strong> Defining FHE criteria</li>
                        <li><strong>Active:</strong> Recruiting patients</li>
                        <li><strong>Reviewing:</strong> Checking matched patients and sending consent requests</li>
                        <li><strong>Approved:</strong> Patient accepted</li>
                        <li><strong>Closed:</strong> Trial capacity reached</li>
                    </ul>
                </div>

                <div className="not-prose grid grid-cols-1 md:grid-cols-3 gap-4 my-8">
                    {[
                        { step: "A", title: "Off-Chain KYC", desc: "Submit organizational credentials, wallet address, and legal documentation to MedVault protocol admins via an off-chain submission form.", color: "blue" },
                        { step: "B", title: "On-Chain Allowlist", desc: "The MedVault admin multisig executes `addSponsor(address, name)` on the `SponsorRegistry`. The Subgraph indexes the event, unlocking trial creation in the UI.", color: "teal" },
                        { step: "C", title: "Trial Management", desc: "Sponsors create trials with encrypted requirements, review anonymized applicant counts via Subgraph, and issue accept/reject decisions which send encrypted messages.", color: "purple" },
                        { step: "D", title: "Automated Rewards", desc: "Upon acceptance, patients are automatically enrolled in the SponsorIncentiveVault. When the trial's end time is reached, Chainlink Automation automatically distributes the initial Milestone 0 screening reward without manual intervention.", color: "emerald" },
                    ].map(s => {
                        const styles = colorStyles[s.color];
                        return (
                        <div key={s.step} className={`p-5 rounded-2xl border ${styles.cardBorder} bg-white dark:bg-slate-900`}>
                            <div className={`w-8 h-8 rounded-full ${styles.stepBadge} flex items-center justify-center font-bold font-mono text-sm mb-3`}>{s.step}</div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 mt-0">{s.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                        </div>
                        );
                    })}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>III. Edge Cases & Known Behavior</h2>
                <p>
                    Due to the unique nature of FHE-based blockchain applications, several non-obvious behaviors must be accounted for at the UI and contract level.
                </p>

                <div className="not-prose space-y-4 my-8">
                    {edgeCases.map(e => {
                        const styles = colorStyles[e.color];
                        return (
                        <div key={e.title} className={`p-5 rounded-2xl border ${styles.cardBorder} ${styles.cardBg} flex gap-4 items-start`}>
                            <div className={`p-2 rounded-xl ${styles.iconBg} shrink-0 ${styles.iconText}`}>{e.icon}</div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 mt-0">{e.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-0">{e.desc}</p>
                            </div>
                        </div>
                        );
                    })}
                </div>

                <Callout type="info" title="Data Retention Policy">
                    MedVault does not control The Graph Studio's data persistence. If the Subgraph is re-deployed or reset, historical indexing may be temporarily unavailable. The on-chain state (ciphertext handles in contract storage) is always the ground truth and will be re-indexed upon Subgraph re-deployment.
                </Callout>

            </Prose>
        </motion.div>
    );
}
