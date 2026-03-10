import { Prose } from "../../components/docs/Prose";
import { Callout } from "../../components/docs/Callout";
import { AnimatedDiagram } from "../../components/docs/AnimatedDiagram";

import { motion } from "framer-motion";
import { Database, Shield, Activity, Users, Lock, Server } from "lucide-react";

const architectureChart = `
graph TD
    subgraph "Client Layer"
        User[Patient/Sponsor]
        FVMJS[fhevmjs SDK]
    end

    subgraph "Network Layer (Zama Sepolia)"
        PR[PatientRegistry]
        TM[TrialManager]
        EE[EligibilityEngine]
        CM[ConsentManager]
        SR[SponsorRegistry]
        CL[Chainlink Oracle]
    end

    subgraph "Indexing Layer"
        SG[The Graph Subgraph]
    end

    User -->|Transaction| FVMJS
    FVMJS -->|Encrypted Input| PR
    FVMJS -->|Encrypted Input| TM
    TM -->|Compensation Logic| CL
    EE -->|FHE Computation| PR
    EE -->|FHE Computation| TM
    PR -->|Events| SG
    TM -->|Events| SG
    User -->|Query| SG
`;

const systemNodes = [
    {
        id: "patient",
        title: "Patient Wallet",
        subtitle: "Encrypted Data Owner",
        icon: <Users className="h-5 w-5" />,
        position: { x: 50, y: 50 },
        color: "teal" as const,
    },
    {
        id: "registry",
        title: "Patient Registry",
        subtitle: "Identity & Vault",
        icon: <Database className="h-5 w-5" />,
        position: { x: 300, y: 50 },
        color: "blue" as const,
    },
    {
        id: "engine",
        title: "Eligibility Engine",
        subtitle: "Zama FHE Computation",
        icon: <Activity className="h-5 w-5" />,
        position: { x: 550, y: 150 },
        color: "purple" as const,
    },
    {
        id: "sponsor",
        title: "Sponsor Wallet",
        subtitle: "Trial Creator",
        icon: <Server className="h-5 w-5" />,
        position: { x: 50, y: 250 },
        color: "amber" as const,
    },
    {
        id: "trialmanager",
        title: "Trial Manager",
        subtitle: "Trial Logic & Access",
        icon: <Shield className="h-5 w-5" />,
        position: { x: 300, y: 250 },
        color: "emerald" as const,
    },
];

const systemEdges = [
    { id: "e1", from: "patient", to: "registry", animated: true },
    { id: "e2", from: "sponsor", to: "trialmanager", animated: true },
    { id: "e3", from: "registry", to: "engine", animated: true },
    { id: "e4", from: "trialmanager", to: "engine", animated: true },
];

export function ArchitectureDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-purple-500 font-bold tracking-widest uppercase text-xs">System Design</span>
                <h1 className="mt-2 text-5xl">Architecture & Zama Integration</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-12 max-w-prose">
                    MedVault relies on a modular smart contract architecture deployed on a Zama fhEVM-compatible network. It separates data storage, role authorization, and heavy FHE computation into distinct layers to optimize gas limits.
                </p>

                <div className="my-16">
                    <AnimatedDiagram nodes={systemNodes} edges={systemEdges} height={420} className="w-full" />
                    <p className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 mt-4 tracking-tight">
                        Fig 1. High-level interaction flow between users and core contracts in the MedVault ecosystem.
                    </p>
                </div>

                <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                    <h3 className="text-xl font-semibold text-slate-200 mb-4">System Component Architecture</h3>
                    <ul className="text-slate-300 space-y-2 list-disc list-inside">
                        <li><strong>Frontend DApp:</strong> React + Vite, interacting with Wallets.</li>
                        <li><strong>Relayer SDK:</strong> @zama-fhe/relayer-sdk handling client-side FHE operations.</li>
                        <li><strong>Smart Contracts:</strong> FHEVM compiled Solidity contracts managing state and Homomorphic ops.</li>
                        <li><strong>The Graph Indexer:</strong> Indexes blockchain events to Postgres.</li>
                        <li><strong>GraphQL API:</strong> Serves real-time indexed data to the frontend.</li>
                    </ul>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>The Four Layers of MedVault</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 my-10">
                    {/* Data Layer */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-blue-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <h3 className="flex items-center gap-3 mt-0 text-xl text-slate-900 dark:text-white">
                                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 shadow-inner border border-blue-500/20"><Database className="h-5 w-5" /></div>
                                Data Layer
                            </h3>
                            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                The <strong>PatientRegistry</strong> is responsible for state persistence. It stores encrypted health attributes (Age, HbA1c, Weight) as <code>euint32</code> ciphertexts. These values are encrypted client-side using the Zama network public key before ever touching the blockchain.
                            </p>
                        </div>
                    </div>

                    {/* Logic Layer */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-emerald-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <h3 className="flex items-center gap-3 mt-0 text-xl text-slate-900 dark:text-white">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shadow-inner border border-emerald-500/20"><Shield className="h-5 w-5" /></div>
                                Logic Layer
                            </h3>
                            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                The <strong>TrialManager</strong> aggregates trial requirements (which are also encrypted as <code>euint32</code> bounds). It works in strict tandem with the <strong>SponsorRegistry</strong> ensuring only entities with verified cryptographic signatures can initiate trials.
                            </p>
                        </div>
                    </div>

                    {/* Computation Layer */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <h3 className="flex items-center gap-3 mt-0 text-xl text-slate-900 dark:text-white">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 shadow-inner border border-purple-500/20"><Activity className="h-5 w-5" /></div>
                                Computation Layer
                            </h3>
                            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                The <strong>EligibilityEngine</strong> is the brain. It pulls the encrypted patient cyphertext from the Data Layer and the encrypted trial bounds from the Logic layer, combining them using Zama's `TFHE` library to generate a match score without decrypting the inputs.
                            </p>
                        </div>
                    </div>

                    {/* Access Layer */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-amber-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <h3 className="flex items-center gap-3 mt-0 text-xl text-slate-900 dark:text-white">
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 shadow-inner border border-amber-500/20"><Lock className="h-5 w-5" /></div>
                                Access Layer
                            </h3>
                            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                The <strong>ConsentManager</strong> acts as the final gatekeeper. Even if the Computation Layer determines a perfect 100% match, the payload cannot be decrypted or utilized by the sponsor unless a signed, time-locked authorization token is present here.
                            </p>
                        </div>
                    </div>

                    {/* Oracle Data Layer */}
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-rose-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <h3 className="flex items-center gap-3 mt-0 text-xl text-slate-900 dark:text-white">
                                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 shadow-inner border border-rose-500/20"><Database className="h-5 w-5" /></div>
                                Oracle Validation Layer
                            </h3>
                            <p className="text-[15px] text-slate-600 dark:text-slate-400 leading-relaxed">
                                MedVault integrates <strong>Chainlink Price Feeds</strong> natively within the `TrialManager`. When Sponsors instantiate trials with specific compensation budgets, the Oracle Layer verifies real-time ETH/USD rates before locking the funding parameters, ensuring compensation math holds true regardless of market violently swinging during a long clinical trial.
                            </p>
                        </div>
                    </div>
                </div>
                <p className="max-w-prose text-lg">
                    When a patient clicks "Apply" on the frontend, a complex, multi-stage orchestration kicks off under the hood. Understanding this flow is critical for extending MedVault:
                </p>

                <ol className="max-w-prose space-y-4 mt-8 pb-8">
                    <li><strong>Input Aggregation:</strong> The frontend requests the user's encrypted parameters from the `PatientRegistry` and the trial's encrypted parameters from `TrialManager`. Because both are stored on-chain, this step involves contract-to-contract reads.</li>
                    <li><strong>Execution Trigger:</strong> The `EligibilityEngine.computeEligibility(patientAddress, trialId)` function is executed via a transaction.</li>
                    <li><strong>Homomorphic Comparison:</strong> Within the fhEVM, specialized Zama opcodes are triggered. MedVault utilizes `TFHE.le` (less than or equal) and `TFHE.ge` (greater than or equal) functions to securely compare the health metrics against the bounded trial limits.</li>
                    <li><strong>Multiplexed Aggregation:</strong> The results of those comparisons (`ebool`) cannot be used in `if` statements. MedVault uses `TFHE.cmux` to add points (e.g., +40 for correct Age) together into an `euint32` final score.</li>
                    <li><strong>State Persistence:</strong> The resulting encrypted score is saved mapped to the `trialId` and `patientAddress`. Only the owner of the wallet possessing the correct EIP-712 generated viewing key can request the fhEVM to decrypt this specific mapping slot.</li>
                </ol>

                <Callout type="info" title="Gas Architecture & Optimization">
                    FHE operations are notoriously gas-intensive because they require massive polynomial mathematics behind the scenes in the Zama coprocessor. MedVault optimizes this by separating the computation layer from storage. We only run computations at the exact moment of application ("milestone evaluation"), rather than continuously looping through the registry as new trials appear.
                </Callout>

            </Prose>
        </motion.div >
    );
}
