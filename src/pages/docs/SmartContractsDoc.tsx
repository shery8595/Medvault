import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { motion } from "framer-motion";

export function SmartContractsDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-emerald-500 font-bold tracking-widest uppercase text-xs">Technical Reference</span>
                <h1 className="mt-2 text-5xl">Core Logic Contracts</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-12 max-w-prose">
                    MedVault's logic is distributed across <strong>11 specialized smart contracts</strong>, ensuring strict separation of concerns and minimizing gas vulnerabilities while executing operations on the Fhenix fhEVM coprocessor. This page serves as a complete reference for every deployed contract.
                </p>

                <Callout type="info" title="Deployment Environment">
                    All contracts are deployed on the <strong>Fhenix Sepolia Testnet</strong> chain. Connecting to the network requires RPC URLs pointing to Fhenix infrastructure. Contracts are compiled with Solidity 0.8.24+ and use the <code>@fhenixprotocol/cofhe-contracts</code> SDK for encrypted type support.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <div className="space-y-16 mt-12">
                    {/* 01 — Trial Manager */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
                                <span className="font-mono font-bold text-lg leading-none">01</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">TrialManager.sol</h2>
                        </div>

                        <p className="max-w-prose">
                            The <code>TrialManager</code> is the central hub for creating, tracking, and halting clinical trials. It acts as the routing layer between unencrypted structural metadata (Trial Names, Phases, Timestamps) and the encrypted requirements (min/max bounds for health metrics stored as <code>euint32</code>). Before instantiating a new trial struct, the <code>TrialManager</code> makes a synchronous cross-contract call to the <code>SponsorRegistry</code> to verify the <code>msg.sender</code> is KYC-approved.
                        </p>

                        <CodeBlock
                            filename="TrialManager.sol (Create Logic)"
                            language="solidity"
                            code={`function createTrial(
    string memory name,
    string memory phase,
    string memory location,
    string memory compensation,
    bytes memory encryptedReqs
) external returns (uint256) {
    // 1. Authorize Caller via distinct registry
    require(
        sponsorRegistry.isVerifiedSponsor(msg.sender), 
        "Only verified sponsors can create trials"
    );
    
    // 2. Increment global trial counter securely
    uint256 newTrialId = ++trialCount;
    
    // 3. Map structural data
    trials[newTrialId] = Trial({
        id: newTrialId,
        sponsor: msg.sender,
        name: name,
        phase: phase,
        active: true,
        // ...
    });

    emit TrialCreated(newTrialId, msg.sender, name);
    return newTrialId;
}`}
                        />
                    </section>

                    {/* 02 — Patient Registry */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
                                <span className="font-mono font-bold text-lg leading-none">02</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">PatientRegistry.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            The <code>PatientRegistry</code> handles the storage and updating of patient health metrics. It manages the <code>PatientInfo</code> struct which holds exclusively Fhenix encrypted data types. On registration, ZK input proofs are validated via the FHE precompile, ciphertext handles are stored with ACL permissions granted to this contract and the <code>EligibilityEngine</code>, and a <code>DataAccessLog</code> entry is recorded.
                        </p>
                        <Callout type="warning" title="Reentrancy Protections">
                            Because the patient registry interfaces with the <code>EligibilityEngine</code> and the <code>ConsentManager</code> directly upon state updates, it utilizes standard OpenZeppelin <code>ReentrancyGuard</code> modifiers to prevent recursive calls during FHE evaluations.
                        </Callout>

                        <CodeBlock
                            filename="PatientRegistry.sol (Structs)"
                            language="solidity"
                            code={`import "@fhenixprotocol/cofhe-contracts/FHE.sol";

// All fields are fully homomorphically encrypted
struct PatientInfo {
    euint32 age;
    euint32 bloodPressure;
    euint32 hba1c;
    euint32 weight;
    bool isRegistered; // Standard boolean — it is public knowledge *that* a patient exists.
}

mapping(address => PatientInfo) private registry;`}
                        />

                        <p className="max-w-prose">
                            <strong>Key functions:</strong> <code>registerPatient(einput, einput, einput, einput, bytes)</code>, <code>updateMetrics(...)</code>, <code>unregister()</code>, <code>getPatientEncryptedMetrics(address) → PatientInfo</code>
                        </p>
                    </section>

                    {/* 03 — Eligibility Engine */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl border border-purple-500/20">
                                <span className="font-mono font-bold text-lg leading-none">03</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">EligibilityEngine.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            The <strong>computational core</strong> of MedVault. Reads encrypted patient metrics from <code>PatientRegistry</code> and encrypted trial bounds from <code>TrialManager</code>, then executes 5 FHE comparison operations and 3 CMUX multiplexing operations to produce a weighted eligibility score (0-100) — all without decrypting any inputs. The score is stored in a private mapping keyed by <code>(trialId, patientAddress)</code> with FHE ACL granting decryption rights only to the patient.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>computeEligibility(address patient, uint256 trialId)</code>, <code>getScore(uint256 trialId, address patient) → euint32</code>
                        </p>
                        <Callout type="info" title="Detailed Documentation">
                            See the <a href="/docs/engine">Eligibility Engine Mechanics</a> page for a comprehensive scoring breakdown, threshold behavior analysis, and gas cost estimation.
                        </Callout>
                    </section>

                    {/* 04 — Sponsor Registry */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20">
                                <span className="font-mono font-bold text-lg leading-none">04</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">SponsorRegistry.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            An admin-gated allowlist of verified pharmaceutical sponsors. Only the protocol owner (multisig) can add or remove sponsors via <code>Ownable</code>-protected functions. This prevents Sybil attacks where malicious actors create trials with extreme parameter bounds designed to deduce patient data through binary search. The registry exposes <code>isVerifiedSponsor(address)</code> for cross-contract authorization checks from <code>TrialManager</code>.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>addSponsor(address)</code>, <code>removeSponsor(address)</code>, <code>isVerifiedSponsor(address) → bool</code>, <code>emergencyRemoveSponsor(address)</code>
                        </p>
                    </section>

                    {/* 05 — Consent Manager */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
                                <span className="font-mono font-bold text-lg leading-none">05</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">ConsentManager.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            Manages granular, revocable patient consent for identity disclosure. After a patient receives a match score, they may <em>optionally</em> grant the trial sponsor access to their profile through this contract. Consent is scoped per <code>(patient, sponsor, trialId)</code> tuple — granting consent for Trial #1 does not affect Trial #2. All consent grants and revocations are logged to <code>DataAccessLog</code> with anonymized hashes.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>grantConsent(address sponsor, uint256 trialId)</code>, <code>revokeConsent(address sponsor, uint256 trialId)</code>, <code>hasConsent(address patient, address sponsor, uint256 trialId) → bool</code>
                        </p>
                    </section>

                    {/* 06 — Chainlink Price Feeds */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                                <span className="font-mono font-bold text-lg leading-none">06</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">Chainlink Price Feeds Integration</h2>
                        </div>

                        <p className="max-w-prose">
                            Clinical trials often guarantee compensation (e.g., "$5,000 equivalent in ETH"). To prevent sponsors from under-funding their trial escrow due to extreme market volatility, MedVault integrates <code>@chainlink/contracts</code> to fetch live ETH/USD market data during trial instantiation and funding operations.
                        </p>

                        <Callout type="tip" title="Decentralized Validation">
                            By querying the <code>AggregatorV3Interface</code> dynamically inside the payable Trial Activation function, we eliminate the need for an admin to manually set oracle prices. If <code>msg.value &lt; requiredFiatFunding / getChainlinkDataFeedLatestAnswer()</code>, the transaction reverts, protecting patient payouts.
                        </Callout>
                    </section>

                    {/* 07 — Sponsor Incentive Vault */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl border border-purple-500/20">
                                <span className="font-mono font-bold text-lg leading-none">07</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">SponsorIncentiveVault.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            Manages the <strong>escrow and phased payout</strong> mechanism for trial participant rewards. When a sponsor creates a trial, they fund an escrow pool. Matched and consent-approved patients are registered as participants. Rewards are distributed in phased milestones (enrollment, mid-trial, completion) rather than lump-sum, protecting both sponsors from early patient dropout and patients from sponsor non-payment.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>registerParticipant(address, uint256)</code>, <code>distributeReward(uint256, uint256)</code>, <code>claimReward(uint256)</code>
                        </p>
                    </section>

                    {/* 08 — Staking Manager */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
                                <span className="font-mono font-bold text-lg leading-none">08</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">StakingManager.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            Coordinates the <strong>private yield generation</strong> pipeline. Patient rewards flow through this contract into Aave V3 lending pools, generating interest on locked funds. The staking position is tracked privately using <code>ConfidentialETH</code> encrypted balance wrappers, so the on-chain observer cannot determine how much yield any individual patient has accrued.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>stake(uint256)</code>, <code>unstake(uint256)</code>, <code>getPrivateBalance(address) → euint32</code>
                        </p>
                    </section>

                    {/* 09 — Confidential ETH */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
                                <span className="font-mono font-bold text-lg leading-none">09</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">ConfidentialETH.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            An <strong>encrypted ERC-20 wrapper</strong> for ETH. Users "shield" plaintext ETH into encrypted <code>euint32</code> balance representations. Transfers between addresses add and subtract encrypted values using <code>FHE.add()</code> and <code>FHE.sub()</code> — the blockchain computes the transfer without knowing the amounts. Uses a <code>1e12</code> scaling factor to convert between wei (18 decimals) and <code>euint32</code> (max ~4.29 billion).
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>shield(uint256)</code>, <code>unshield(uint256)</code>, <code>transferEncrypted(address, euint32)</code>
                        </p>
                    </section>

                    {/* 10 — MedVault Automation */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
                                <span className="font-mono font-bold text-lg leading-none">10</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">MedVaultAutomation.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            Implements Chainlink's <code>AutomationCompatibleInterface</code> for <strong>trustless, time-based triggers</strong>. The <code>checkUpkeep()</code> function scans for trials with pending milestone payouts, and <code>performUpkeep()</code> executes the distribution via <code>SponsorIncentiveVault</code>. This removes the need for any centralized cron job or human trigger — Chainlink Keepers autonomously call the contract when conditions are met.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>checkUpkeep(bytes calldata) → (bool, bytes memory)</code>, <code>performUpkeep(bytes calldata)</code>
                        </p>
                    </section>

                    {/* 11 — Data Access Log */}
                    <section>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20">
                                <span className="font-mono font-bold text-lg leading-none">11</span>
                            </div>
                            <h2 className="m-0 border-0 pb-0">DataAccessLog.sol</h2>
                        </div>
                        <p className="max-w-prose">
                            A centralized, <strong>immutable on-chain audit recorder</strong> for every sensitive state change in MedVault. Only whitelisted MedVault contracts (PatientRegistry, EligibilityEngine, ConsentManager, SponsorIncentiveVault) can write to the log — external contracts cannot inject entries. Each entry contains an <code>ActionType</code> enum, trial ID, anonymized <code>keccak256</code> hash, and block timestamp.
                        </p>
                        <p>
                            <strong>Key functions:</strong> <code>log(ActionType, uint256, bytes32)</code>, <code>authorizeLogger(address)</code>
                        </p>
                        <p>
                            <strong>ActionType enum:</strong> <code>PATIENT_REGISTERED</code>, <code>ELIGIBILITY_CHECKED</code>, <code>CONSENT_GRANTED</code>, <code>CONSENT_REVOKED</code>, <code>STATUS_CHANGED</code>, <code>REWARD_DISTRIBUTED</code>
                        </p>
                    </section>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                {/* Contract Interaction Matrix */}
                <h2>Contract Interaction Matrix</h2>
                <p>
                    The following table summarizes cross-contract call relationships in the MedVault protocol:
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Caller</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Callee</th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-700 dark:text-slate-300 text-xs">Call Purpose</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { caller: "EligibilityEngine", callee: "PatientRegistry", purpose: "Read encrypted patient health metrics" },
                                    { caller: "EligibilityEngine", callee: "TrialManager", purpose: "Read encrypted trial requirement bounds" },
                                    { caller: "TrialManager", callee: "SponsorRegistry", purpose: "Validate sponsor authorization (isVerifiedSponsor)" },
                                    { caller: "TrialManager", callee: "Chainlink PriceFeed", purpose: "Fetch live ETH/USD for compensation math" },
                                    { caller: "SponsorIncentiveVault", callee: "StakingManager", purpose: "Route participant rewards to yield generation" },
                                    { caller: "StakingManager", callee: "ConfidentialETH", purpose: "Shield/unshield encrypted balance wrappers" },
                                    { caller: "StakingManager", callee: "Aave V3 Pool", purpose: "Supply/withdraw from lending pool" },
                                    { caller: "MedVaultAutomation", callee: "SponsorIncentiveVault", purpose: "Trigger milestone-based reward distribution" },
                                    { caller: "PatientRegistry", callee: "DataAccessLog", purpose: "Log registration/unregistration actions" },
                                    { caller: "ConsentManager", callee: "DataAccessLog", purpose: "Log consent grant/revocation actions" },
                                    { caller: "EligibilityEngine", callee: "DataAccessLog", purpose: "Log eligibility computation events" },
                                ].map((row, i) => (
                                    <tr key={`${row.caller}-${row.callee}`} className={`border-b border-slate-100 dark:border-slate-800/50 ${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-900/30"}`}>
                                        <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">{row.caller}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{row.callee}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500">{row.purpose}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </Prose>
        </motion.div>
    );
}
