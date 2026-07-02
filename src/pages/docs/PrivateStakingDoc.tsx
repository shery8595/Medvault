import { Prose } from "../../components/docs/Prose";
import { CodeBlock } from "../../components/docs/CodeBlock";
import { Callout } from "../../components/docs/Callout";
import { DocsPageHeaderForRoute } from "../../components/docs/DocsPageHeader";

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Coins, ShieldCheck, TrendingUp, Landmark, ArrowRight, Wallet } from "lucide-react";

const severityStyles: Record<string, { bg: string; text: string }> = {
    "Medium": {
        bg: "bg-amber-100",
        text: "text-amber-700"
    },
    "Low": {
        bg: "bg-blue-100",
        text: "text-blue-700"
    }
};

export function PrivateStakingDoc() {
    return (
        <motion.div>
            <Prose className="max-w-none">
                <DocsPageHeaderForRoute />

                {/* Feature Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12 not-prose text-white">
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-purple-500/20">
                        <ShieldCheck className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Privacy First</h3>
                        <p className="text-sm opacity-90 font-medium">Staked balances are stored as <code>euint64</code>. No one, not even Aave, can see how much you have staked.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-blue-500 to-emerald-600 shadow-xl shadow-emerald-500/20">
                        <TrendingUp className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Passive Yield</h3>
                        <p className="text-sm opacity-90 font-medium">Rewards are automatically converted to aWETH behind a gateway, collecting real-time interest from Aave V3.</p>
                    </div>
                    <div className="p-8 rounded-[32px] bg-gradient-to-br from-slate-800 to-slate-950 shadow-xl shadow-black/20">
                        <Landmark className="w-10 h-10 mb-4 opacity-80" />
                        <h3 className="text-xl font-black mb-2">Two unstake paths</h3>
                        <p className="text-sm opacity-90 font-medium">Private unstake returns encrypted stake to your cETH balance. Public unstake unwinds Aave (amounts visible on-chain).</p>
                    </div>
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>I. Staking architecture (dual paths)</h2>
                <p>
                    <code>StakingManager</code> exposes two deliberately separated paths. The <strong>private path</strong> keeps
                    value inside MedVault&apos;s encrypted cETH ledger. The <strong>public path</strong> deposits WETH into
                    Aave V3 and unwinds through the gateway — amounts are visible via standard ERC-20 / gateway events.
                </p>
                <Callout type="info" title="Default private design (Option A)">
                    Private staking withdrawal means <strong>return to confidential MedVault balance</strong>, not an Aave
                    exit. Use <code>stakeAndLock</code> (with cETH operator) → <code>requestPrivateUnstake</code> →{" "}
                    <code>completePrivateUnstake</code>. Deprecated: <code>requestConfidentialStake</code> /{" "}
                    <code>completeConfidentialStake</code> / <code>stakeFromConfidential</code> revert. See{" "}
                    <Link to="/docs/private-withdrawals" className="font-semibold text-[#00685f] hover:underline">
                        Private withdrawals
                    </Link>{" "}
                    for encrypted amount staging.
                </Callout>

                <div className="not-prose my-10 p-8 rounded-3xl bg-slate-50 border border-slate-200">
                    <div className="not-prose bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                        <h3 className="text-xl font-semibold text-slate-900 mb-4 m-0">Staking lifecycle</h3>
                        <div className="text-slate-600 text-sm space-y-4">
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
                    The <code>StakingManager.sol</code> contract handles three staking modes:
                </p>
                <ul>
                    <li><strong>Public stake (<code>stake</code>):</strong> Send ETH from wallet → Aave V3 via WETH gateway. Encrypted stake total tracked in gwei units.</li>
                    <li><strong>Confidential stake (<code>stakeAndLock</code>):</strong> Atomic ERC-7984 transfer-and-call from encrypted cETH into encrypted stake ledger — set cETH operator first.</li>
                    <li><strong>Private unstake (<code>requestPrivateUnstake</code>):</strong> Release encrypted stake back to cETH via <code>transferEncrypted</code>.</li>
                    <li><strong>Public unstake (<code>requestPublicUnstake</code>):</strong> Explicit Aave unwind; aliases <code>requestUnstake</code> / <code>completeUnstake</code> for back-compat.</li>
                </ul>

                <Callout type="info" title="Precision &amp; e-Types">
                    MedVault uses <code>euint64</code> for staking balances to maintain high precision. We map 1 ETH to 10^6 units in the FHE layer, allowing for granular interest tracking without the extreme gas costs of 256-bit FHE types.
                </Callout>

                <h3>Contract Implementation Preview</h3>
                <CodeBlock
                    filename="StakingManager.sol"
                    language="solidity"
                    code={`function stakeAndLock(
    externalEuint64 encryptedUnits,
    bytes calldata inputProof
) external {
    // Caller must set StakingManager as cETH operator, then:
    IERC7984(address(cETH)).confidentialTransferFromAndCall(
        msg.sender, address(this), encryptedUnits, inputProof,
        abi.encodePacked(STAKE_AND_LOCK_FLAG)
    );
}

// Deprecated — reverts "Use stakeAndLock":
// requestConfidentialStake, completeConfidentialStake, stakeFromConfidential

function requestPrivateUnstake(
    externalEuint64 encryptedUnits,
    bytes calldata inputProof
) external {
    // FHE.select(ge(encStaked, units), units, 0) → transferableHandle
}

function completePrivateUnstake(
    bytes calldata transferableCleartexts,
    bytes calldata transferableProof
) external {
    // subtract stake, cETH.transferEncrypted back to patient
}`}
                />

                <hr className="my-12 border-slate-200" />

                <h2>III. User Experience Patterns</h2>
                <p>
                    Integrated into the Patient Dashboard, the staking experience is designed to be seamless.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 font-bold">1</div>
                            <p className="text-sm text-slate-600">
                                <strong>Claim Choice:</strong> When a trial payment is released, the patient sees a "Secure Payout" modal. They can choose to withdraw to their wallet or "Stake &amp; Earn".
                            </p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 font-bold">2</div>
                            <p className="text-sm text-slate-600">
                                <strong>Confidential Vault:</strong> The "Private Staking Vault" card on the dashboard remains locked until the user requests decryption via a re-encryption request.
                            </p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 font-bold">3</div>
                            <p className="text-sm text-slate-600">
                                <strong>Manual Deposits:</strong> Users can also top up their vault using public ETH, which is automatically converted and added to their private balance.
                            </p>
                        </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Coins className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Dashboard Preview</div>
                            <div className="h-6 w-32 bg-slate-800 rounded mb-4" />
                            <div className="space-y-2">
                                <div className="h-2 w-full bg-slate-800 rounded" />
                                <div className="h-2 w-3/4 bg-slate-800 rounded" />
                            </div>
                            <div className="mt-8 flex gap-2">
                                <div className="h-8 flex-1 bg-blue-500 rounded-lg shadow-[0_0_15px_rgba(20,184,166,0.2)]" />
                                <div className="h-8 flex-1 bg-slate-800 rounded-lg" />
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="my-12 border-slate-200" />

                <h2>IV. Yield Mathematics</h2>
                <p>
                    The interest earned on staked MedVault rewards follows Aave V3's variable-rate lending model. When the <code>StakingManager</code> supplies WETH to the Aave pool, it receives <code>aWETH</code> receipt tokens that appreciate in value as borrowers pay interest.
                </p>

                <div className="not-prose my-8 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                    <div className="px-4 pt-4 pb-2 bg-slate-50 border-b border-slate-200">
                        <span className="font-bold text-sm text-slate-700">Yield Accrual Formula</span>
                    </div>
                    <div className="overflow-x-auto p-6 bg-white">
                        <div className="text-sm font-mono text-slate-600 space-y-2">
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

                <hr className="my-12 border-slate-200" />

                <h2>V. ConfidentialETH Scaling</h2>
                <p>
                    The <code>ConfidentialETH</code> wrapper uses a critical scaling factor to bridge between Ethereum's 18-decimal wei representation and the FHE type system:
                </p>

                <ul>
                    <li><strong>ETH uses 18 decimals:</strong> 1 ETH = 10^18 wei. This is far too large for <code>euint32</code> (max ~4.29 billion) or even <code>euint64</code>.</li>
                    <li><strong>Scaling factor: 1e12:</strong> MedVault divides incoming wei by <code>10^12</code> before storing as an encrypted value. This means 1 ETH = 10^6 encrypted units (1,000,000 "micro-ETH"). This provides 6 decimal places of precision.</li>
                    <li><strong>Reverse on unshield:</strong> When a patient withdraws (unshields), the contract multiplies the decrypted amount by <code>10^12</code> to convert back to wei.</li>
                </ul>

                <Callout type="danger" title="Precision Limitation">
                    Due to the <code>1e12</code> scaling, the smallest representable unit is <code>0.000001 ETH</code> (~$0.0025 at current prices). This means sub-micro-ETH amounts are truncated. For clinical trial rewards (typically $100-$10,000), this precision is more than sufficient.
                </Callout>

                <hr className="my-12 border-slate-200" />

                <h2>VI. Risk Factors</h2>
                <p>
                    Patients and auditors should be aware of the following risk factors affecting the private staking system:
                </p>

                <div className="not-prose space-y-4 my-8">
                    {[
                        { title: "Aave Protocol Risk", desc: "Yield generation depends on Aave V3's continued operation and solvency. In the unlikely event of an Aave pool exploit or WETH liquidity crisis, staked funds could be partially or fully lost.", severity: "Medium" },
                        { title: "Smart Contract Risk", desc: "The StakingManager, ConfidentialETH, and their interactions with Aave introduce additional smart contract surface area. Each contract has been tested with 100+ test cases, but formal verification has not been completed.", severity: "Medium" },
                        { title: "FHE Liveness Dependency", desc: "If the Zama FHE coprocessor experiences downtime, encrypted staking operations (deposits, withdrawals) will be blocked. Public ETH operations remain unaffected.", severity: "Low" },
                        { title: "Scaling Truncation", desc: "The 1e12 scaling factor means very small yield amounts may be lost to truncation. Over long staking periods with small balances, this can result in slightly lower effective APY than quoted.", severity: "Low" },
                    ].map(risk => {
                        const styles = severityStyles[risk.severity];
                        return (
                        <div key={risk.title} className="p-5 rounded-2xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-slate-900 text-sm m-0">{risk.title}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles.bg} ${styles.text}`}>{risk.severity}</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed m-0">{risk.desc}</p>
                        </div>
                        );
                    })}
                </div>

            </Prose>
        </motion.div>
    );
}
