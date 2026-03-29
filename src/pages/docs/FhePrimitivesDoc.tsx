import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Zap, Lock, AlertTriangle, GitBranch, ArrowRight, Binary } from "lucide-react";

const typeGasChart = `
xychart-beta
    title "Approximate Relative Gas Cost by FHE Type"
    x-axis ["euint8", "euint16", "euint32", "euint64", "euint128", "euint256"]
    y-axis "Gas Units (relative)" 0 --> 100
    bar [10, 20, 35, 55, 75, 100]
`;

const eTypes = [
    { type: "euint8", bits: 8, example: "Severity score 0-255", gas: "~Low", used: false },
    { type: "euint16", bits: 16, example: "Blood pressure (mmHg)", gas: "~Low", used: true },
    { type: "euint32", bits: 32, example: "Age, HbA1c, Weight (×10)", gas: "~Med", used: true },
    { type: "euint64", bits: 64, example: "Timestamp, large counters", gas: "~High", used: false },
    { type: "euint128", bits: 128, example: "Token balances", gas: "~High", used: false },
    { type: "ebool", bits: 1, example: "Match result (true/false)", gas: "~Low", used: true },
];

const fheFunctions = [
    { fn: "FHE.add(a, b)", returns: "euint", replaces: "a + b", note: "Homomorphic addition" },
    { fn: "FHE.sub(a, b)", returns: "euint", replaces: "a - b", note: "Homomorphic subtraction" },
    { fn: "FHE.mul(a, b)", returns: "euint", replaces: "a * b", note: "Very expensive – avoid if possible" },
    { fn: "FHE.ge(a, b)", returns: "ebool", replaces: "a >= b", note: "Greater than or equal" },
    { fn: "FHE.le(a, b)", returns: "ebool", replaces: "a <= b", note: "Less than or equal" },
    { fn: "FHE.gt(a, b)", returns: "ebool", replaces: "a > b", note: "Greater than" },
    { fn: "FHE.lt(a, b)", returns: "ebool", replaces: "a < b", note: "Less than" },
    { fn: "FHE.eq(a, b)", returns: "ebool", replaces: "a == b", note: "Equality check" },
    { fn: "FHE.and(a, b)", returns: "ebool", replaces: "a && b", note: "Boolean AND on ebool" },
    { fn: "FHE.or(a, b)", returns: "ebool", replaces: "a || b", note: "Boolean OR on ebool" },
    { fn: "FHE.cmux(cond, t, f)", returns: "euint", replaces: "cond ? t : f", note: "Conditional multiplexer" },
    { fn: "FHE.asEuint32(val)", returns: "euint32", replaces: "uint32(val)", note: "Cast plaintext to encrypted" },
];

export function FhePrimitivesDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-blue-500 font-bold tracking-widest uppercase text-xs">Core Concepts</span>
                <h1 className="mt-2 text-5xl">Fhenix fhEVM Primitives & FHE Operations</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    Fully Homomorphic Encryption demands a fundamental rethinking of how we write smart contracts. Standard Solidity types like <code>uint256</code> and <code>bool</code> cannot safely represent sensitive state. Every piece of health data must instead live inside an encrypted envelope exposed by Fhenix's <code>@fhenixprotocol/cofhe-contracts</code> library.
                </p>

                {/* Stat Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-10 not-prose">
                    {[
                        { label: "Encrypted Types", value: "6+", icon: <Lock className="w-5 h-5" />, color: "teal" },
                        { label: "FHE Operations", value: "12+", icon: <Zap className="w-5 h-5" />, color: "purple" },
                        { label: "Branching Allowed", value: "None", icon: <GitBranch className="w-5 h-5" />, color: "rose" },
                        { label: "Data Revealed On-Chain", value: "Zero", icon: <Binary className="w-5 h-5" />, color: "amber" },
                    ].map((s) => (
                        <div key={s.label} className="flex flex-col items-center justify-center p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm text-center">
                            <div className={`p-2 rounded-xl mb-3 bg-${s.color}-100 dark:bg-${s.color}-900/30 text-${s.color}-600 dark:text-${s.color}-400`}>{s.icon}</div>
                            <div className="text-3xl font-bold font-display text-slate-900 dark:text-white">{s.value}</div>
                            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>I. Encrypted Integer Types (e-Types)</h2>
                <p>
                    The Fhenix fhEVM exposes encrypted versions of Solidity's primitive unsigned integer types. Each type trades off bit-width against FHE computation cost. Larger types require more polynomial rings during evaluation, increasing gas significantly.
                </p>
                <p>
                    MedVault primarily uses <code>euint32</code> because all medical scalar metrics (Age, Blood Pressure, HbA1c) fit comfortably within a 32-bit range while minimizing unnecessary gas expenditure.
                </p>

                {/* Type Reference Table */}
                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Type</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Bits</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">MedVault Example</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Gas Cost</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Used in App</th>
                                </tr>
                            </thead>
                            <tbody>
                                {eTypes.map((t, i) => (
                                    <tr key={t.type} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 font-bold">{t.type}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.bits}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.example}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{t.gas}</td>
                                        <td className="px-4 py-3">
                                            {t.used
                                                ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">✓ Yes</span>
                                                : <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">– No</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8 mt-6">
                        <h3 className="text-xl font-semibold text-slate-200 mb-4">Operations vs Gas Cost</h3>
                        <ul className="text-slate-300 space-y-2 list-disc list-inside">
                            <li><strong>euint32 Add/Sub:</strong> ~8M Gas (Extremely Fast)</li>
                            <li><strong>euint32 Mul/Div:</strong> ~12M Gas (Fast)</li>
                            <li><strong>euint32 Cmp (lt/gt/eq):</strong> ~15M Gas (Moderate)</li>
                            <li><strong>euint32 Shift (shl/shr):</strong> ~18M Gas (Slow)</li>
                        </ul>
                    </div>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400">Table 1. Encrypted type reference for MedVault contract development.</div>
                </div>

                <Callout type="warning" title="The Branching Problem — Critical Law of FHE Development">
                    You <strong>cannot</strong> write <code>if (encryptedAge &gt; 18) {"{ ... }"}</code> in FHE. Because the EVM node executing the transaction has no way to evaluate the condition — it sees only undecodable encrypted bytes — the blockchain state machine cannot branch deterministically. Attempting to use encrypted values in standard <code>if</code> statements will either silently produce wrong results or revert entirely.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>II. The FHE.sol Standard Library</h2>
                <p>
                    All arithmetic, comparisons, and logic operations on encrypted types must go through the <code>FHE.sol</code> library shipped by Fhenix. Internally, these functions translate to specialized EVM precompile calls that trigger FHE computation in the Fhenix coprocessor, not in the EVM itself.
                </p>

                {/* FHE Function Reference Table */}
                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 m-0">FHE.sol Function Reference</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Function</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Returns</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Replaces</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fheFunctions.map((f, i) => (
                                    <tr key={f.fn} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 text-xs">{f.fn}</td>
                                        <td className="px-4 py-3 font-mono text-purple-600 dark:text-purple-400 text-xs">{f.returns}</td>
                                        <td className="px-4 py-3 font-mono text-slate-500 text-xs">{f.replaces}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{f.note}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <h2>III. The CMUX (Conditional Multiplexer) Pattern</h2>
                <p>
                    Since <code>if/else</code> statements are completely forbidden on encrypted data, the <strong>entire conditional logic</strong> in MedVault is implemented via <code>FHE.cmux()</code>. This is the single most important function in FHE smart contract development.
                </p>

                <div className="not-prose my-8 p-6 rounded-2xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/10">
                    <div className="font-mono text-center text-slate-900 dark:text-white text-lg font-bold mb-2">
                        FHE.cmux(<span className="text-purple-600 dark:text-purple-400">ebool condition</span>, <span className="text-blue-600 dark:text-blue-400">euint trueVal</span>, <span className="text-rose-600 dark:text-rose-400">euint falseVal</span>) → <span className="text-amber-600 dark:text-amber-400">euint</span>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-6 flex-wrap">
                        {[
                            { label: "condition", desc: "An encrypted boolean result from any FHE comparison", color: "purple" },
                            { label: "trueVal", desc: "The value selected when condition = true (always computed!)", color: "teal" },
                            { label: "falseVal", desc: "The value selected when condition = false (always computed!)", color: "rose" },
                        ].map(a => (
                            <div key={a.label} className={`flex-1 min-w-[180px] p-4 rounded-xl border border-${a.color}-200 dark:border-${a.color}-900/40 bg-white dark:bg-slate-900 shadow-sm text-center`}>
                                <div className={`font-mono font-bold text-${a.color}-600 dark:text-${a.color}-400 mb-2`}>{a.label}</div>
                                <div className="text-xs text-slate-500">{a.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <Callout type="warning" title="CMUX Cost: Both Branches Are Always Evaluated">
                    Unlike standard code where <code>condition ? doA() : doB()</code> only executes one branch, FHE's <code>FHE.cmux</code> <strong>always evaluates both branches</strong> behind the scenes. The coprocessor performs polynomial multiplication on both paths and then mathematically selects the correct one. Never put expensive operations inside a cmux argument.
                </Callout>

                <h3>Full Coding Example: Age Range Eligibility</h3>
                <p>This demonstrates a complete age-range check as it appears inside MedVault's <code>EligibilityEngine</code>:</p>

                <CodeBlock
                    filename="EligibilityEngine.sol — Age Check Pattern"
                    language="solidity"
                    code={`import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// Patient's encrypted age (stored in PatientRegistry)
euint32 encryptedAge = registry.getPatientAge(patientAddr);

// Trial's encrypted minimum and maximum age bounds
euint32 encMinAge = trialManager.getMinAge(trialId);
euint32 encMaxAge = trialManager.getMaxAge(trialId);

// --- Step 1: Compute two comparison eboools ---
ebool isOldEnough  = FHE.ge(encryptedAge, encMinAge); // age >= minAge
ebool isYoungEnough = FHE.le(encryptedAge, encMaxAge); // age <= maxAge

// --- Step 2: AND the two conditions into a single pass/fail ebool ---
ebool ageInRange = FHE.and(isOldEnough, isYoungEnough);

// --- Step 3: Assign 40 points via cmux if both conditions are met ---
// Note: BOTH FHE.asEuint32(40) and FHE.asEuint32(0) are "computed" 
// in the coprocessor, but only one value is cryptographically selected.
euint32 agePoints = FHE.cmux(
    ageInRange,
    FHE.asEuint32(40), // 40 points if in range
    FHE.asEuint32(0)   // 0 points if outside range
);`}
                />

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>IV. Permission Management (ACL)</h2>
                <p>
                    When a contract stores a ciphertext, only specific addresses can access it. The Fhenix fhEVM enforces this via an on-chain Access Control List (ACL). When <code>FHE.allow(handle, address)</code> is called, the specified address is granted the right to request decryption of that specific ciphertext handle.
                </p>
                <p>
                    MedVault calls <code>FHE.allowThis(score)</code> immediately after computing the match score so the <code>EligibilityEngine</code> itself can pass it into storage, and <code>FHE.allow(score, patientAddress)</code> so the patient wallet can later decrypt it.
                </p>

                <CodeBlock
                    filename="ACL Permission Grant Pattern"
                    language="solidity"
                    code={`// After computing the final euint32 score:
FHE.allowThis(score);              // Allow the current contract to store it
FHE.allow(score, patientAddress);  // Allow only the patient to decrypt it
// The sponsor cannot request decryption without patient consent
trialApplicantScores[trialId][patientAddress] = score;`}
                />

            </Prose>
        </motion.div>
    );
}
