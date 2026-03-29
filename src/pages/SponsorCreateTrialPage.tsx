import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { CriteriaBuilder } from "../components/dashboard/CriteriaBuilder";
import {
    ArrowLeft,
    FlaskConical,
    Target,
    MapPin,
    DollarSign,
    FileText,
    ChevronRight,
    ArrowRight,
    CheckCircle2,
    Clock,
    TrendingUp,
    Plus,
    Trash2,
    Sparkles,
    ShieldCheck as ShieldIcon,
    AlertCircle,
    Coins
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3 } from "../lib/Web3Context";
import {
    getTrialManager,
    getSponsorIncentiveVault,
    getTrialMilestoneManager,
    getSponsorRegistry
} from "../lib/contracts";
import { ethers } from "ethers";
import { cn } from "../lib/utils";

export function SponsorCreateTrialPage() {
    const navigate = useNavigate();
    const { signer, account, connect, isConnecting } = useWeb3();
    const [step, setStep] = useState(1);
    const [status, setStatus] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        phase: "Phase 1",
        location: "",
        compensation: "",
        description: "",
        duration: 30,
        durationUnit: "days" as "days" | "minutes",
        fundingAmount: ""
    });

    const [criteria, setCriteria] = useState({
        minAge: 18,
        maxAge: 65,
        requiresDiabetes: false,
        minHb: 100,
        genderRequirement: 0,
        minHeight: 0,
        maxWeight: 0,
        requiresNonSmoker: false,
        requiresNormalBP: false
    });

    const [milestones, setMilestones] = useState<{ name: string; weight: number; deadline: number }[]>([
        { name: "Initial Screening", weight: 2500, deadline: 7 }, // 25.00%
        { name: "Phase 1 Completion", weight: 7500, deadline: 30 } // 75.00%
    ]);
    const [usePhasedPayouts, setUsePhasedPayouts] = useState(true);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);

    useEffect(() => {
        const checkVerification = async () => {
            if (signer && account) {
                try {
                    const registry = getSponsorRegistry(signer);
                    const verified = await registry.isVerifiedSponsor(account);
                    setIsVerified(verified);
                } catch (err) {
                    console.error("Verification check failed:", err);
                    setIsVerified(false);
                }
            } else {
                setIsVerified(null);
            }
        };
        checkVerification();
    }, [signer, account]);

    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step - 1);

    const handleSubmit = async () => {
        if (!signer || !account) {
            setStatus("Please connect your wallet first.");
            return;
        }

        if (!formData.name) {
            setStatus("Error: Trial name is required.");
            setStep(1);
            return;
        }

        setStatus("Launching protocol on Sepolia...");
        try {
            const trialManager = getTrialManager(signer);
            const tx = await trialManager.createTrial(
                formData.name,
                formData.phase,
                formData.location,
                formData.compensation,
                criteria.minAge,
                criteria.maxAge,
                criteria.requiresDiabetes,
                criteria.minHb,
                criteria.genderRequirement,
                criteria.minHeight,
                criteria.maxWeight,
                criteria.requiresNonSmoker,
                criteria.requiresNormalBP,
                formData.durationUnit === "days"
                    ? formData.duration * 86400
                    : formData.duration * 60
            );

            setStatus("Waiting for protocol confirmation...");
            const receipt = await tx.wait();

            // Extract Trial ID from events
            const event = receipt.logs
                .map((log: any) => {
                    try {
                        return trialManager.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .find((e: any) => e && e.name === "TrialCreated");

            if (!event || !event.args) {
                throw new Error("Could not find TrialCreated event in receipt.");
            }

            const trialId = event.args.trialId;

            // V1.2: Set Milestones if enabled
            if (usePhasedPayouts && milestones.length > 0) {
                setStatus("Defining phased payout milestones...");
                const milestoneManager = getTrialMilestoneManager(signer);
                const mTx = await milestoneManager.setMilestones(
                    trialId,
                    milestones.map(m => m.name),
                    milestones.map(m => m.weight),
                    milestones.map(m => m.deadline)
                );
                await mTx.wait();
            }

            // Optional: Fund the trial if fundingAmount is set
            if (formData.fundingAmount && parseFloat(formData.fundingAmount) > 0) {
                setStatus(`Trial defined. Seeding incentive pool...`);
                try {
                    const vault = getSponsorIncentiveVault(signer);
                    const fundingTx = await vault.fundTrial(trialId, {
                        value: ethers.parseEther(formData.fundingAmount)
                    });
                    setStatus("Confirming incentive pool funding...");
                    await fundingTx.wait();
                } catch (fundErr: any) {
                    console.error("Funding failed but trial created:", fundErr);
                    setStatus(`Trial created but funding failed: ${fundErr.reason || fundErr.message}`);
                    setTimeout(() => navigate("/sponsor/trials"), 3000);
                    return;
                }
            }

            setStatus("Success! Protocol and Incentive Pool initialized.");
            setTimeout(() => navigate("/sponsor/trials"), 1500);
        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.reason || err.message || "Failed to create trial"}`);
        }
    };

    const handleNext = () => {
        if (step === 3 && usePhasedPayouts) {
            const totalWeight = milestones.reduce((acc, curr) => acc + curr.weight, 0);
            if (totalWeight !== 10000) {
                setStatus("Error: Total milestone weights must equal 100%.");
                return;
            }
            if (milestones.some(m => !m.name)) {
                setStatus("Error: All milestones must have a name.");
                return;
            }
        }
        setStatus(null);
        nextStep();
    };

    const steps = [
        { title: "Protocol Definition", icon: FileText },
        { title: "Targeting & Specs", icon: Target },
        { title: "Payout Strategy", icon: Coins },
        { title: "Eligibility Logic", icon: ShieldIcon }
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            {/* ─── Header ─── */}
            <div className="flex flex-col gap-6">
                <Link to="/sponsor/trials" className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-accent transition-all">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 group-hover:border-accent/30 group-hover:bg-accent/5 transition-all">
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    </div>
                    Cancel and return
                </Link>
                <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-[1.25rem] bg-accent/10 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(var(--color-accent),0.1)]">
                        <FlaskConical className="h-8 w-8" />
                    </div>
                    <div>
                        <h2 className="text-4xl font-black tracking-tight text-white mb-1">Initialize Protocol</h2>
                        <p className="text-slate-400 font-medium">Define your clinical trial and encryption parameters with FHE-shielded logic.</p>
                    </div>
                </div>
            </div>

            {/* ─── Step Progress ─── */}
            <div className="relative px-4">
                <div className="absolute top-5 left-8 right-8 h-0.5 bg-white/5" />
                <div className="relative z-10 flex justify-between">
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        const isCompleted = step > i + 1;
                        const isActive = step === i + 1;

                        return (
                            <div key={i} className="flex flex-col items-center gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-500",
                                    isCompleted ? "bg-accent border-accent text-white shadow-[0_0_15px_rgba(var(--color-accent),0.3)]" : "",
                                    isActive ? "bg-[#020617] border-accent text-accent shadow-[0_0_20px_rgba(var(--color-accent),0.4)] scale-110" : "",
                                    !isActive && !isCompleted ? "bg-slate-950 border-white/10 text-slate-600" : ""
                                )}>
                                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                </div>
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-300",
                                    isActive ? "text-accent" : "text-slate-500"
                                )}>
                                    {s.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── Form Content ─── */}
            <Card className="border-white/5 bg-slate-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-[2.5rem]">
                <CardContent className="p-10 md:p-14">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-10"
                            >
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Trial Protocol Name</label>
                                    <Input
                                        placeholder="e.g. Phase 3 Study for mRNA Response..."
                                        className="h-14 text-xl font-bold rounded-2xl border-white/5 bg-slate-950/50 text-white placeholder:text-slate-600 focus-visible:ring-accent transition-all"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Clinical Phase</label>
                                        <div className="relative group">
                                            <select
                                                className="appearance-none w-full h-14 pl-5 pr-12 rounded-2xl border border-white/5 bg-slate-950/50 text-white text-base font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all cursor-pointer"
                                                value={formData.phase}
                                                onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                                            >
                                                <option className="bg-[#020617]">Phase 1</option>
                                                <option className="bg-[#020617]">Phase 2</option>
                                                <option className="bg-[#020617]">Phase 3</option>
                                                <option className="bg-[#020617]">Phase 4</option>
                                            </select>
                                            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 rotate-90 pointer-events-none group-focus-within:text-accent transition-all" />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Location</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                            <Input
                                                placeholder="San Francisco, CA"
                                                className="h-14 pl-12 rounded-2xl border-white/5 bg-slate-950/50 text-white font-bold focus-visible:ring-accent"
                                                value={formData.location}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-10"
                            >
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-5 p-7 rounded-[2rem] bg-accent/5 border border-accent/10 shadow-[inset_0_0_20px_rgba(var(--color-accent),0.02)]">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-[0_0_15px_rgba(var(--color-accent),0.2)]">
                                                <DollarSign className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-lg text-white">Compensation Packet</h4>
                                        </div>
                                        <Input
                                            placeholder="$2,500 + Travel Support"
                                            className="h-14 rounded-2xl border-white/5 bg-slate-950/60 text-white font-bold focus-visible:ring-accent"
                                            value={formData.compensation}
                                            onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                                        />
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visible to matched candidates only.</p>
                                    </div>
                                    <div className="space-y-5 p-7 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.02)]">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                                                <CheckCircle2 className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-lg text-white">Vault Access</h4>
                                        </div>
                                        <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                                            Enable direct "Vault Push" for trial outcomes. Verified data will be transmitted via end-to-end encrypted relay upon patient consent.
                                        </p>
                                    </div>
                                    <div className="space-y-5 p-7 rounded-[2rem] bg-violet-500/5 border border-violet-500/10 shadow-[inset_0_0_20px_rgba(139,92,246,0.02)]">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-violet-500 text-white flex items-center justify-center shadow-[0_0_15_rgba(139,92,246,0.2)]">
                                                <Clock className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-lg text-white">Trial Duration</h4>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Input
                                                type="number"
                                                placeholder="30"
                                                min={1}
                                                className="h-14 rounded-2xl border-white/5 bg-slate-950/60 text-white font-black text-xl w-32 focus-visible:ring-accent"
                                                value={formData.duration}
                                                onChange={(e) => setFormData({ ...formData, duration: Math.max(1, parseInt(e.target.value) || 1) })}
                                            />
                                            <select
                                                className="h-14 px-5 rounded-2xl border border-white/5 bg-slate-950/60 text-white text-base font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all cursor-pointer"
                                                value={formData.durationUnit}
                                                onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as any })}
                                            >
                                                <option value="days" className="bg-[#020617]">days</option>
                                                <option value="minutes" className="bg-[#020617]">minutes</option>
                                            </select>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Automated reward distribution window.</p>
                                    </div>
                                    <div className="space-y-5 p-7 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                                <Coins className="h-5 w-5" />
                                            </div>
                                            <h4 className="font-bold text-lg text-white">Initial Funding</h4>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Input
                                                type="number"
                                                placeholder="0.05"
                                                step="0.01"
                                                min="0"
                                                className="h-14 rounded-2xl border-white/5 bg-slate-950/60 text-white font-black text-xl w-36 focus-visible:ring-accent"
                                                value={formData.fundingAmount}
                                                onChange={(e) => setFormData({ ...formData, fundingAmount: e.target.value })}
                                            />
                                            <span className="text-sm font-black text-slate-400 uppercase tracking-widest">ETH</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Optional: Instant vault seeding.</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Brief Overview</label>
                                    <textarea
                                        placeholder="Describe the clinical objective and participation requirements..."
                                        className="w-full h-40 p-6 rounded-3xl border border-white/5 bg-slate-950/50 text-white text-base font-medium focus:ring-2 focus:ring-accent focus:outline-none transition-all placeholder:text-slate-600 resize-none"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-10"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                                            <TrendingUp className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white tracking-tight">Phased Payout Setup</h3>
                                            <p className="text-sm text-slate-400 font-medium">Distribute your prize pool across trial milestones.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-950/50 p-3 px-5 rounded-2xl border border-white/5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phases</span>
                                        <button
                                            onClick={() => setUsePhasedPayouts(!usePhasedPayouts)}
                                            className={cn(
                                                "w-12 h-6 rounded-full p-1 transition-all duration-300",
                                                usePhasedPayouts ? "bg-accent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" : "bg-slate-800"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                                                usePhasedPayouts ? "translate-x-6" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>
                                </div>

                                {usePhasedPayouts ? (
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-[1.5rem] bg-blue-500/5 border border-blue-500/10">
                                            <div className="flex items-center gap-3 text-blue-400 mb-2">
                                                <Sparkles className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Strategic Payouts</span>
                                            </div>
                                            <p className="text-sm text-slate-400 font-medium">
                                                Define specific achievements (e.g. "Screening Successful") and assign a percentage of the compensation pool to each milestone.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {milestones.map((m, idx) => (
                                                <div key={idx} className="flex gap-6 items-end p-6 rounded-[2rem] bg-slate-950/50 border border-white/5 shadow-inner relative group transition-all hover:bg-slate-950/80">
                                                    <div className="flex-1 space-y-3">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Milestone Name</label>
                                                        <Input
                                                            value={m.name}
                                                            onChange={(e) => {
                                                                const copy = [...milestones];
                                                                copy[idx].name = e.target.value;
                                                                setMilestones(copy);
                                                            }}
                                                            placeholder="e.g. Initial Screening"
                                                            className="h-12 bg-[#020617] border-white/5 text-white font-bold rounded-xl"
                                                        />
                                                    </div>
                                                    <div className="w-28 space-y-3">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Weight (%)</label>
                                                        <Input
                                                            type="number"
                                                            value={m.weight / 100}
                                                            onChange={(e) => {
                                                                const copy = [...milestones];
                                                                copy[idx].weight = Math.round(Number(e.target.value) * 100);
                                                                setMilestones(copy);
                                                            }}
                                                            className="h-12 bg-[#020617] border-white/5 text-white font-black rounded-xl"
                                                        />
                                                    </div>
                                                    <div className="w-28 space-y-3">
                                                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Term (Days)</label>
                                                        <Input
                                                            type="number"
                                                            value={m.deadline}
                                                            onChange={(e) => {
                                                                const copy = [...milestones];
                                                                copy[idx].deadline = parseInt(e.target.value) || 0;
                                                                setMilestones(copy);
                                                            }}
                                                            className="h-12 bg-[#020617] border-white/5 text-white font-black rounded-xl"
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-12 w-12 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                                                        onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}
                                                        disabled={milestones.length <= 1}
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between pt-4">
                                            <Button
                                                variant="outline"
                                                size="default"
                                                className="gap-2 border-dashed border-2 border-white/5 hover:border-accent/40 hover:bg-accent/5 transition-all px-6 py-5 rounded-2xl font-bold"
                                                onClick={() => setMilestones([...milestones, { name: "", weight: 0, deadline: 30 }])}
                                            >
                                                <Plus className="h-4 w-4" /> Add Protocol Milestone
                                            </Button>

                                            <div className={cn(
                                                "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border shadow-lg",
                                                milestones.reduce((acc, curr) => acc + curr.weight, 0) === 10000
                                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5"
                                                    : "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5"
                                            )}>
                                                <span>Allocation: {milestones.reduce((acc, curr) => acc + curr.weight, 0) / 100}%</span>
                                                {milestones.reduce((acc, curr) => acc + curr.weight, 0) !== 10000 && (
                                                    <span className="opacity-60">(Target 100%)</span>
                                                )}
                                                {milestones.reduce((acc, curr) => acc + curr.weight, 0) === 10000 && <CheckCircle2 className="h-3 w-3" />}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-16 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center gap-6 bg-slate-950/20 transition-all hover:bg-slate-950/40">
                                        <div className="h-16 w-16 rounded-2xl bg-slate-950 flex items-center justify-center text-slate-500 border border-white/5 shadow-xl">
                                            <Coins className="h-8 w-8 opacity-40" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-lg font-black text-white uppercase tracking-widest">Single Disbursement Mode</p>
                                            <p className="text-sm text-slate-500 max-w-sm font-medium">Participating patients will receive the full reward amount only upon trial completion.</p>
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="lg" 
                                            onClick={() => setUsePhasedPayouts(true)}
                                            className="px-8 py-6 rounded-2xl border-white/10 hover:border-accent hover:bg-accent/5 font-bold"
                                        >
                                            Enable Phased Strategy
                                        </Button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="space-y-10"
                            >
                                <div className="bg-amber-500/5 border border-amber-500/10 p-6 rounded-[1.5rem] flex gap-4 text-amber-500 shadow-[inset_0_0_20px_rgba(245,158,11,0.02)]">
                                    <ShieldIcon className="h-6 w-6 shrink-0" />
                                    <p className="text-sm font-bold leading-relaxed opacity-90">
                                        Eligibility criteria are executed on our decentralized FHE network. 
                                        Zero-knowledge proofs ensure no patient health information (PHI) is ever exposed to the sponsor node.
                                    </p>
                                </div>
                                <CriteriaBuilder criteria={criteria} onChange={setCriteria} />
                                {status && (
                                    <div className={`p-6 rounded-[1.5rem] text-sm font-black uppercase tracking-widest flex items-center gap-3 border shadow-xl ${status.startsWith("Error") ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-accent/10 text-accent border-accent/20"}`}>
                                        <AlertCircle className="h-5 w-5" />
                                        {status}
                                    </div>
                                )}
                                {!account && (
                                    <Button onClick={connect} disabled={isConnecting} className="w-full h-16 bg-accent hover:bg-accent/80 text-white font-black text-sm uppercase tracking-[0.2em] gap-3 rounded-[1.5rem] shadow-[0_0_20px_rgba(var(--color-accent),0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]">
                                        <ShieldIcon className="h-5 w-5" />
                                        {isConnecting ? "Authenticating..." : "Connect Gateway to Proceed"}
                                    </Button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ─── Footer Navigation ─── */}
                    <div className="flex items-center justify-between mt-16 pt-10 border-t border-white/5">
                        <Button
                            variant="ghost"
                            onClick={prevStep}
                            disabled={step === 1}
                            className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] h-14 px-8 rounded-2xl hover:text-white hover:bg-white/5 disabled:opacity-20"
                        >
                            Back
                        </Button>
                        {step < 4 ? (
                            <Button
                                onClick={handleNext}
                                className="group h-16 px-10 rounded-[1.5rem] bg-accent text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-accent/20 transition-all hover:scale-[1.05] active:scale-95"
                            >
                                Continue Implementation
                                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        ) : (
                            <div className="flex flex-col items-end gap-4">
                                {!isVerified && account && isVerified !== null && (
                                    <div className="flex items-center gap-2 text-rose-500 text-[10px] font-black uppercase tracking-widest animate-pulse px-4 py-2 bg-rose-500/5 rounded-full border border-rose-500/20">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Sponsor Credentials Not Verified
                                    </div>
                                )}
                                <Button
                                    onClick={handleSubmit}
                                    disabled={!isVerified || !account}
                                    className={cn(
                                        "h-16 px-10 rounded-[1.5rem] text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl transition-all hover:scale-[1.05] active:scale-95",
                                        isVerified
                                            ? "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500"
                                            : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5 opacity-50"
                                    )}
                                >
                                    Initialize & Broadcast Protocol
                                    <ShieldIcon className="h-4 w-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
