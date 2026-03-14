import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { motion } from "framer-motion";
import { Scale, Shield, Database, FileText, CheckCircle2, Lock, Eye, UserX, Clock, Globe } from "lucide-react";

const hipaaMapping = [
    { requirement: "§164.312(a)(1) — Access Control", implementation: "TFHE ACL system (`TFHE.allow()`) restricts ciphertext decryption to authorized addresses only. `ConsentManager` enforces patient-signed EIP-712 tokens before any data access.", status: "Satisfied" },
    { requirement: "§164.312(a)(2)(iv) — Encryption", implementation: "All patient health data is encrypted using TFHE (Fully Homomorphic Encryption) with 128-bit security level. Data is encrypted client-side before transmission and remains encrypted on-chain.", status: "Satisfied" },
    { requirement: "§164.312(c)(1) — Integrity Controls", implementation: "Blockchain immutability guarantees data integrity. ZK input proofs validate ciphertext well-formedness. Smart contract logic is deterministic and verifiable.", status: "Satisfied" },
    { requirement: "§164.312(e)(1) — Transmission Security", implementation: "All data transmitted to the blockchain is TFHE-encrypted. Even if RPC traffic is intercepted, only opaque ciphertext blobs are visible. No plaintext health data exists in any network packet.", status: "Satisfied" },
    { requirement: "§164.312(b) — Audit Controls", implementation: "`DataAccessLog.sol` records every sensitive operation with anonymized `keccak256(patient, timestamp)` hashes. Immutable on-chain storage provides tamper-proof audit trail.", status: "Satisfied" },
    { requirement: "§164.530 — Notice of Privacy Practices", implementation: "Smart contract source code is publicly verifiable on-chain. Patients can audit exactly what operations are performed on their data by reading the contract logic.", status: "Satisfied" },
    { requirement: "§164.522 — Minimum Necessary Standard", implementation: "The `EligibilityEngine` only accesses the specific encrypted metrics required for a given trial's criteria. No bulk data access is possible — each computation is scoped to (patient, trialId).", status: "Satisfied" },
];

const gdprMapping = [
    { article: "Art. 17 — Right to Erasure", implementation: "Patients can call `unregister()` on the `PatientRegistry` to delete their ciphertext handles from on-chain contract state. The `DataAccessLog` retains anonymized hashes but no personally identifiable information.", compliance: "Partial — blockchain immutability means structural event metadata persists" },
    { article: "Art. 20 — Data Portability", implementation: "Patient ciphertext handles are stored in public contract mappings accessible by the patient's wallet. The patient can export their encrypted profile by reading their own mappings.", compliance: "Supported via on-chain data sovereignty" },
    { article: "Art. 25 — Data Protection by Design", implementation: "FHE encryption is applied at the earliest possible point (browser DOM). The entire protocol is designed around the principle that plaintext health data never exists outside the patient's browser.", compliance: "Core architectural principle" },
    { article: "Art. 32 — Security of Processing", implementation: "128-bit FHE security level (TFHE). OpenZeppelin security patterns. Formal threat model with 8 identified vectors and mitigations. 100-case test verification suite.", compliance: "Exceeded — provable mathematical guarantees" },
    { article: "Art. 35 — Data Protection Impact Assessment", implementation: "This documentation serves as the technical DPIA for MedVault. Risk assessment is documented in the Security Model page with severity ratings and mitigation status.", compliance: "Documented" },
    { article: "Art. 7 — Conditions for Consent", implementation: "The `ConsentManager` contract requires explicit EIP-712 signatures from the patient before any data can be re-encrypted for a sponsor. Consent is granular (per-trial, per-sponsor) and revocable.", compliance: "Fully implemented on-chain" },
];

const colorStyles: Record<string, { iconBg: string; iconText: string; cardBorder: string; cardBg: string }> = {
    teal: {
        iconBg: "bg-teal-100 dark:bg-teal-900/30",
        iconText: "text-teal-600 dark:text-teal-400",
        cardBorder: "border-teal-200 dark:border-teal-900/40",
         cardBg: "bg-teal-50/50 dark:bg-teal-950/10",
    },
    purple: {
        iconBg: "bg-purple-100 dark:bg-purple-900/30",
        iconText: "text-purple-600 dark:text-purple-400",
        cardBorder: "border-purple-200 dark:border-purple-900/40",
         cardBg: "bg-purple-50/50 dark:bg-purple-950/10",
    },
    blue: {
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconText: "text-blue-600 dark:text-blue-400",
        cardBorder: "border-blue-200 dark:border-blue-900/40",
         cardBg: "bg-blue-50/50 dark:bg-blue-950/10",
    },
    amber: {
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconText: "text-amber-600 dark:text-amber-400",
        cardBorder: "border-amber-200 dark:border-amber-900/40",
         cardBg: "bg-amber-50/50 dark:bg-amber-950/10",
    },
};

export function ComplianceDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Security & Compliance</span>
                <h1 className="mt-2 text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-white">Regulatory Compliance & Audit Trail</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-12 max-w-prose leading-relaxed">
                    MedVault is designed to meet or exceed the data protection requirements of major healthcare regulations. This page maps MedVault's architecture to HIPAA, GDPR, and FDA 21 CFR Part 11 requirements, demonstrating how FHE-based computation provides mathematical compliance guarantees that traditional encryption cannot.
                </p>

                {/* Compliance Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 not-prose text-white">
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl shadow-blue-500/20">
                        <Shield className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">HIPAA</h3>
                        <p className="text-sm opacity-90 font-medium">Health Insurance Portability and Accountability Act. MedVault satisfies all technical safeguard requirements through FHE encryption and on-chain access controls.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-emerald-600 to-emerald-800 shadow-xl shadow-emerald-500/20">
                        <Globe className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">GDPR</h3>
                        <p className="text-sm opacity-90 font-medium">General Data Protection Regulation. MedVault implements data protection by design, granular consent management, and supports right-to-erasure through contract unregistration.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-purple-600 to-purple-800 shadow-xl shadow-purple-500/20">
                        <FileText className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">FDA 21 CFR Part 11</h3>
                        <p className="text-sm opacity-90 font-medium">Electronic records and signatures. Blockchain immutability, EIP-712 signatures, and DataAccessLog provide authenticated, tamper-proof audit records.</p>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                {/* ═════════════ HIPAA ═════════════ */}
                <h2>I. HIPAA Technical Safeguard Mapping</h2>
                <p>
                    The HIPAA Security Rule (45 CFR §164.312) defines technical safeguards that covered entities must implement to protect electronic Protected Health Information (ePHI). MedVault's FHE architecture satisfies these requirements at a level far exceeding traditional encrypted database approaches because the data remains encrypted <strong>during computation</strong>, not just at rest and in transit.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">HIPAA Security Rule — Technical Safeguard Compliance Matrix</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">HIPAA Requirement</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">MedVault Implementation</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hipaaMapping.map((row, i) => (
                                    <tr key={row.requirement} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 align-top whitespace-nowrap">{row.requirement}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{row.implementation}</td>
                                        <td className="px-4 py-3 align-top">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                                ✓ {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <Callout type="tip" title="Beyond Traditional Encryption">
                    Traditional HIPAA compliance requires encrypting data <em>at rest</em> and <em>in transit</em>—but the data must be decrypted for processing, creating a window of exposure. MedVault's FHE approach <strong>eliminates this window entirely</strong>. Data is encrypted at rest, in transit, <em>and during computation</em>. This exceeds the HIPAA Security Rule's requirements and provides a fundamentally stronger privacy guarantee.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                {/* ═════════════ GDPR ═════════════ */}
                <h2>II. GDPR Compliance Mapping</h2>
                <p>
                    The General Data Protection Regulation (EU 2016/679) imposes strict requirements on the processing of personal data. MedVault's architecture is designed with GDPR's principles embedded as core design constraints, not afterthought compliance patches.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-500" />
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">GDPR Article Compliance Matrix</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">GDPR Article</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">MedVault Implementation</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Compliance Level</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gdprMapping.map((row, i) => (
                                    <tr key={row.article} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 align-top whitespace-nowrap">{row.article}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{row.implementation}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 align-top">{row.compliance}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                {/* ═════════════ DataAccessLog ═════════════ */}
                <h2>III. Immutable Audit Trail — DataAccessLog Architecture</h2>
                <p>
                    For a health-tech DApp to be taken seriously by regulators (FDA, EMA, MHRA), "security through obscurity" is insufficient. MedVault implements <strong>"Attested Privacy"</strong> — cryptographic proof that data was only accessed by authorized actors, recorded in an immutable, tamper-proof on-chain log.
                </p>

                <p>
                    The <code>DataAccessLog.sol</code> contract serves as a centralized, immutable audit recorder for every sensitive state change in the MedVault ecosystem. Only authorized MedVault contracts (Registry, Engine, Vault) can push logs — external contracts cannot write to the log.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 m-0">Logged Action Types</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">ActionType</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Triggered When</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Data Logged</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { action: "PATIENT_REGISTERED", trigger: "Patient stores encrypted health profile", data: "keccak256(patient, timestamp)" },
                                    { action: "ELIGIBILITY_CHECKED", trigger: "EligibilityEngine computes match score", data: "keccak256(patient, trialId, timestamp)" },
                                    { action: "CONSENT_GRANTED", trigger: "Patient grants viewing access to sponsor", data: "keccak256(patient, sponsor, trialId)" },
                                    { action: "CONSENT_REVOKED", trigger: "Patient revokes previously granted access", data: "keccak256(patient, sponsor, trialId)" },
                                    { action: "STATUS_CHANGED", trigger: "Sponsor accepts/rejects application", data: "keccak256(patient, trialId, newStatus)" },
                                    { action: "REWARD_DISTRIBUTED", trigger: "Milestone payout executed via Chainlink", data: "keccak256(patient, trialId, milestoneId)" },
                                ].map((row, i) => (
                                    <tr key={row.action} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-mono text-xs text-teal-600 dark:text-teal-400 font-bold">{row.action}</td>
                                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{row.trigger}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{row.data}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <CodeBlock
                    filename="DataAccessLog.sol — Integration Example"
                    language="solidity"
                    code={`// Called internally by EligibilityEngine after computing a match score
dataAccessLog.log(
    DataAccessLog.ActionType.ELIGIBILITY_CHECKED,
    _trialId,
    keccak256(abi.encodePacked(_patient, block.timestamp))
);

// The log contains:
// - WHO triggered it (msg.sender → authorized contract address)
// - WHAT happened (ActionType enum)
// - WHICH trial was involved (trialId)
// - ANONYMIZED reference (keccak256 hash — proves action without revealing identity)
// - WHEN it happened (block.timestamp, immutable)`}
                />

                <Callout type="info" title="Anonymized Hashing Strategy">
                    MedVault logs <code>keccak256(patient, details)</code> instead of raw addresses in the public log title. This serves a dual purpose: (1) regulators can verify that a specific patient's data was handled correctly by reconstructing the hash, and (2) casual blockchain observers cannot enumerate patient addresses from the log entries. The patient address is only discoverable if you already know who you're looking for.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>IV. FDA 21 CFR Part 11 — Electronic Records</h2>
                <p>
                    FDA 21 CFR Part 11 governs electronic records and electronic signatures in pharmaceutical and clinical trial contexts. While MedVault is currently a testnet deployment, its architecture naturally satisfies key Part 11 requirements:
                </p>

                <div className="not-prose space-y-4 my-8">
                    {[
                        { title: "Tamper-Proof Record Integrity", desc: "All records are stored on a public blockchain with Ethereum-level consensus guarantees. Once a DataAccessLog entry is mined, it cannot be altered, deleted, or backdated. This exceeds the Part 11 requirement for audit trails that cannot be modified.", icon: <Database className="w-5 h-5" />, color: "blue" },
                        { title: "Cryptographic Signatures", desc: "Every transaction is signed with the user's Ethereum private key. EIP-712 structured data signatures provide additional typed, human-readable signature context. These signatures are non-repudiable and verifiable on-chain by any third party.", icon: <Lock className="w-5 h-5" />, color: "teal" },
                        { title: "Closed System Controls", desc: "The SponsorRegistry operates as a closed system for trial creation — only KYC-verified institutions can publish trials. Patient data submission is controlled by wallet ownership. No anonymous actors can modify critical state.", icon: <UserX className="w-5 h-5" />, color: "purple" },
                        { title: "Timestamp Authority", desc: "Block timestamps serve as the authoritative time source for all audit log entries. These timestamps are set by Ethereum validators and are accurate to within seconds. Chainlink Automation provides additional deadline enforcement for trial milestones.", icon: <Clock className="w-5 h-5" />, color: "amber" },
                    ].map(item => {
                        const styles = colorStyles[item.color];
                        return (
                        <div key={item.title} className={`p-5 rounded-2xl border ${styles.cardBorder} ${styles.cardBg} flex gap-4 items-start`}>
                            <div className={`p-2 rounded-xl ${styles.iconBg} ${styles.iconText} shrink-0`}>
                                {item.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 mt-0">{item.title}</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-0">{item.desc}</p>
                            </div>
                        </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Compliance Assessment</div>
                        <div className="text-slate-900 dark:text-white font-medium">March 2026 — Zama Sepolia Testnet</div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-bold border border-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4" />
                        HIPAA + GDPR ASSESSED
                    </div>
                </div>

            </Prose>
        </motion.div>
    );
}
