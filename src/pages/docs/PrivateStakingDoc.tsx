import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";

import { motion } from "framer-motion";
import { Coins, ShieldCheck, TrendingUp, Landmark, ArrowRight, Wallet } from "lucide-react";

const severityStyles: Record<string, { bg: string; text: string }> = {
    "Medium": {
        bg: "bg-amber-100 dark:bg-amber-900/30",
        text: "text-amber-700 dark:text-amber-400"
    },
    "Low": {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400"
    }
};

export function PrivateStakingDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <span className="text-teal-500 font-bold tracking-widest uppercase text-xs">Operations &amp; Guides</span>
                <h1 className="mt-2 text-5xl">Private Yield Staking (Aave V3 Integration)</h1>

                <p className="lead text-2xl text-slate-500 dark:text-slate-400 mt-6 mb-6 max-w-prose">
                    MedVault enables patients to earn yield on their clinical trial rewards without exposing their financial activity or balances on the public blockchain. By leveraging Zama's FHEVM and Aave V3, we maintain a "Confidential Enclave" for patient payouts.
                </p>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 not-prose text-white">
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-purple-500/20">
                        <ShieldCheck className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Privacy First</h3>
                        <p className="text-sm opacity-90 font-medium">Staked balances are stored as <code>euint64</code>. No one, not even Aave, can see how much you have staked.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-teal-500 to-emerald-600 shadow-xl shadow-emerald-500/20">
                        <TrendingUp className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Passive Yield</h3>
                        <p className="text-sm opacity-90 font-medium">Rewards are automatically converted to aWETH behind a gateway, collecting real-time interest from Aave V3.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-slate-800 to-slate-950 shadow-xl shadow-black/20">
                        <Landmark className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Instant Unstake</h3>
                        <p className="text-sm opacity-90 font-medium">Withdraw your ETH at any time. The contract handles the redemption from Aave and re-encryption back to your wallet.</p>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>I. Staking Architecture</h2>
                <p>
                    The staking system operates as a gateway between the <strong>MedVault Confidential Enclave</strong> and the <strong>Aave V3 Liquidity Pool</strong>. Because Aave requires public <code>uint256</code> values for accounting, MedVault acts as an "accumulator" that pools private intents and manages the public interactions.
                </p>

                <div className="not-prose my-10 p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
                        <h3 className="text-xl font-semibold text-slate-200 mb-4">Staking Lifecycle</h3>
                        <div className="text-slate-300 space-y-4">
                            <p>1. <strong>Trial Setup:</strong> Sponsor deposits total reward pool</p>
                            <p>2. <strong>Enrollment:</strong> Patient stakes deposit (encrypted condition)</p>
                            <p>3. <strong>Trial Active:</strong> Both Sponsor and Patient funds locked in contract</p>
                            <p>4. <strong>Completion:</strong> Evaluation checks condition via FHE</p>
                            <p>5a. <strong>Success:</strong> Patient receives deposit + reward</p>
                            <p>5b. <strong>Failure:</strong> Patient receives only deposit, reward returns to Sponsor</p>
                        </div>
                    </div>
                    <p className="text-center text-xs text-slate-400 mt-4 italic">Figure 1. High-level architecture of the Private Staking Gateway.</p>
                </div>

                <h2>II. The Staking Manager</h2>
                <p>
                    The <code>StakingManager.sol</code> contract is the primary entry point. It handles two types of staking:
                </p>
                <ul>
                    <li><strong>Direct Staking:</strong> Users send public ETH from their wallet.</li>
                    <li><strong>Confidential Staking:</strong> Users stake rewards directly from their <code>ConfidentialETH</code> balance.</li>
                </ul>

                <Callout type="info" title="Precision &amp; e-Types">
                    MedVault uses <code>euint64</code> for staking balances to maintain high precision. We map 1 ETH to 10^6 units in the FHE layer, allowing for granular interest tracking without the extreme gas costs of 256-bit FHE types.
                </Callout>

                <h3>Contract Implementation Preview</h3>
                <CodeBlock
                    filename="StakingManager.sol"
                    language="solidity"
                    code={`// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import "@zama-ai/fhevm/contracts/lib/TFHE.sol";

contract StakingManager {
    // Encrypted balance mapping (User => euint64)
    mapping(address => euint64) private _stakedBalances;

    /**
     * @notice Stakes rewards directly from the user's confidential balance
     * @param amountUnits The amount in micro-ETH units to stake
     */
    function stakeFromConfidential(euint64 amountUnits) external {
        // 1. Authorize transfer from ConfidentialETH
        // 2. Wrap ETH into WETH
        // 3. Supply WETH to Aave V3 Pool
        // 4. Update the patient's encrypted stake record
        euint64 current = _stakedBalances[msg.sender];
        _stakedBalances[msg.sender] = TFHE.add(current, amountUnits);
        
        TFHE.allow(_stakedBalances[msg.sender], msg.sender);
    }
}`}
                />

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>III. User Experience Patterns</h2>
                <p>
                    Integrated into the Patient Dashboard, the staking experience is designed to be seamless.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0 font-bold">1</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <strong>Claim Choice:</strong> When a trial payment is released, the patient sees a "Secure Payout" modal. They can choose to withdraw to their wallet or "Stake &amp; Earn".
                            </p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0 font-bold">2</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <strong>Confidential Vault:</strong> The "Private Staking Vault" card on the dashboard remains locked until the user requests decryption via a re-encryption request.
                            </p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0 font-bold">3</div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <strong>Manual Deposits:</strong> Users can also top up their vault using public ETH, which is automatically converted and added to their private balance.
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Coins className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-black uppercase tracking-widest text-teal-500 mb-2">Dashboard Preview</div>
                            <div className="h-6 w-32 bg-slate-800 rounded mb-4" />
                            <div className="space-y-2">
                                <div className="h-2 w-full bg-slate-800 rounded" />
                                <div className="h-2 w-3/4 bg-slate-800 rounded" />
                            </div>
                            <div className="mt-8 flex gap-2">
                                <div className="h-8 flex-1 bg-teal-500 rounded-lg shadow-[0_0_15px_rgba(20,184,166,0.2)]" />
                                <div className="h-8 flex-1 bg-slate-800 rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>IV. Yield Mathematics</h2>
                <p>
                    The interest earned on staked MedVault rewards follows Aave V3's variable-rate lending model. When the <code>StakingManager</code> supplies WETH to the Aave pool, it receives <code>aWETH</code> receipt tokens that appreciate in value as borrowers pay interest.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Yield Accrual Formula</span>
                    </div>
                    <div className="overflow-x-auto p-6 bg-white dark:bg-slate-900">
                        <div className="text-sm font-mono text-slate-600 dark:text-slate-400 space-y-2">
                            <p>Yield = Principal × (1 + APY/365)^days_staked - Principal</p>
                            <p className="text-xs text-slate-400 mt-4">Where:</p>
                            <p className="text-xs text-slate-400">• Principal = amount of WETH supplied to Aave via StakingManager</p>
                            <p className="text-xs text-slate-400">• APY = Aave V3 variable supply rate (typically 1-5% for WETH)</p>
                            <p className="text-xs text-slate-400">• days_staked = time from stake to unstake (accumulated per-block)</p>
                        </div>
                    </div>
                </div>

                <p>
                    The key innovation is that the <strong>patient's share of this yield is tracked privately</strong> using encrypted <code>euint64</code> balances. The <code>StakingManager</code> knows the total pool size (public), but individual positions are encrypted.
                </p>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>V. ConfidentialETH Scaling</h2>
                <p>
                    The <code>ConfidentialETH</code> wrapper uses a critical scaling factor to bridge between Ethereum's 18-decimal wei representation and the TFHE type system:
                </p>

                <ul>
                    <li><strong>ETH uses 18 decimals:</strong> 1 ETH = 10^18 wei. This is far too large for <code>euint32</code> (max ~4.29 billion) or even <code>euint64</code>.</li>
                    <li><strong>Scaling factor: 1e12:</strong> MedVault divides incoming wei by <code>10^12</code> before storing as an encrypted value. This means 1 ETH = 10^6 encrypted units (1,000,000 "micro-ETH"). This provides 6 decimal places of precision.</li>
                    <li><strong>Reverse on unshield:</strong> When a patient withdraws (unshields), the contract multiplies the decrypted amount by <code>10^12</code> to convert back to wei.</li>
                </ul>

                <Callout type="danger" title="Precision Limitation">
                    Due to the <code>1e12</code> scaling, the smallest representable unit is <code>0.000001 ETH</code> (~$0.0025 at current prices). This means sub-micro-ETH amounts are truncated. For clinical trial rewards (typically $100-$10,000), this precision is more than sufficient.
                </Callout>

                <hr className="my-12 border-slate-200 dark:border-slate-800" />

                <h2>VI. Risk Factors</h2>
                <p>
                    Patients and auditors should be aware of the following risk factors affecting the private staking system:
                </p>

                <div className="not-prose space-y-4 my-8">
                    {[
                        { title: "Aave Protocol Risk", desc: "Yield generation depends on Aave V3's continued operation and solvency. In the unlikely event of an Aave pool exploit or WETH liquidity crisis, staked funds could be partially or fully lost.", severity: "Medium" },
                        { title: "Smart Contract Risk", desc: "The StakingManager, ConfidentialETH, and their interactions with Aave introduce additional smart contract surface area. Each contract has been tested with 100+ test cases, but formal verification has not been completed.", severity: "Medium" },
                        { title: "FHE Liveness Dependency", desc: "If the Zama coprocessor experiences downtime, encrypted staking operations (deposits, withdrawals) will be blocked. Public ETH operations remain unaffected.", severity: "Low" },
                        { title: "Scaling Truncation", desc: "The 1e12 scaling factor means very small yield amounts may be lost to truncation. Over long staking periods with small balances, this can result in slightly lower effective APY than quoted.", severity: "Low" },
                    ].map(risk => {
                        const styles = severityStyles[risk.severity];
                        return (
                        <div key={risk.title} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm m-0">{risk.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles.bg} ${styles.text}`}>{risk.severity}</span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed m-0">{risk.desc}</p>
                        </div>
                        );
                    })}
                </div>

            </Prose>
        </motion.div>
    );
}
