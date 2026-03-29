import React, { useState } from "react";
import { Button } from "../ui/Button";
import { useWeb3 } from "../../lib/Web3Context";
import { encryptUint8, encryptUint16, encryptBool } from "../../lib/fhe";
import { getPatientRegistry } from "../../lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Dna,
    Activity,
    Droplets,
    Scale,
    Ruler,
    Cigarette,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Heart,
    ShieldCheck,
    Stethoscope
} from "lucide-react";
import { cn } from "../../lib/utils";

interface PatientRecordFormProps {
    onSuccess: () => void;
    onCancel: () => void;
}

const steps = [
    { id: 0, title: "Bio-Identity", icon: User },
    { id: 1, title: "Clinical Metrics", icon: Activity },
    { id: 2, title: "Lifestyle", icon: Stethoscope },
];

export function PatientRecordForm({ onSuccess, onCancel }: PatientRecordFormProps) {
    const { signer, account, isFHEReady } = useWeb3();
    const [currentStep, setCurrentStep] = useState(0);

    // Step 0: Biology
    const [age, setAge] = useState(25);
    const [gender, setGender] = useState(true); // true = Male, false = Female
    const [weight, setWeight] = useState(70);
    const [height, setHeight] = useState(175);

    // Step 1: Clinical
    const [hasDiabetes, setHasDiabetes] = useState(false);
    const [hbLevel, setHbLevel] = useState(110);
    const [hasHypertension, setHasHypertension] = useState(false);

    // Step 2: Lifestyle
    const [isSmoker, setIsSmoker] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [allowSubmit, setAllowSubmit] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const nextStep = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        const next = Math.min(currentStep + 1, steps.length - 1);
        setCurrentStep(next);

        // Safety: If moving to last step, only allow submission after a delay
        if (next === steps.length - 1) {
            setTimeout(() => setAllowSubmit(true), 1000);
        }

        setTimeout(() => setIsTransitioning(false), 500);
    };

    const prevStep = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setCurrentStep(prev => Math.max(prev - 1, 0));
        setAllowSubmit(false);
        setTimeout(() => setIsTransitioning(false), 500);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        // EXPLICIT GUARD: 
        // 1. Must be on last step
        // 2. Must not be transitioning
        // 3. Must have explicit permission (allowSubmit) to prevent accidental double-clicks or bleed
        if (isSubmitting || currentStep !== steps.length - 1 || isTransitioning || !allowSubmit) {
            console.log("Submit blocked:", { isSubmitting, step: currentStep, isTransitioning, allowSubmit });
            return;
        }

        if (!signer || !account || !isFHEReady) {
            setStatus("Error: Wallet not connected or FHE not ready");
            return;
        }

        setIsSubmitting(true);
        setStatus("Initializing encryption engine...");

        try {
            const registry = getPatientRegistry(signer);
            const registryAddress = await registry.getAddress();

            // Longer pause to ensure UI "Securing Data..." state is painted
            const pause = (ms = 300) => new Promise(r => setTimeout(r, ms));

            // Encrypt all 8 metrics sequentially
            setStatus("Stage 1/4: Encrypting Bio-Identity...");
            await pause();
            const rawAge = await encryptUint8(registryAddress, account, age);
            const rawGender = await encryptBool(registryAddress, account, gender);

            setStatus("Stage 2/4: Encrypting Physical Metrics...");
            await pause();
            const rawWeight = await encryptUint16(registryAddress, account, weight);
            const rawHeight = await encryptUint8(registryAddress, account, height);

            setStatus("Stage 3/4: Encrypting Clinical Data...");
            await pause();
            const rawDiabetes = await encryptBool(registryAddress, account, hasDiabetes);
            const rawHb = await encryptUint16(registryAddress, account, hbLevel);

            setStatus("Stage 4/4: Encrypting Lifestyle Factors...");
            await pause();
            const rawHypertension = await encryptBool(registryAddress, account, hasHypertension);
            const rawSmoker = await encryptBool(registryAddress, account, isSmoker);

            setStatus("Verification: Preparing blockchain transaction...");
            await pause(500);

            // Prepare parameters for the contract
            const params = [
                rawAge,
                rawGender,
                rawWeight,
                rawHeight,
                rawDiabetes,
                rawHb,
                rawSmoker,
                rawHypertension
            ];

            console.log("Submitting with FHE handles:", params);

            const tx = await registry.submitEncryptedProfile(...params);

            setStatus("Waiting for cryptographic confirmation...");
            await tx.wait();

            setStatus("Success! Metrics secured in FHE vault.");
            setTimeout(onSuccess, 2000);
        } catch (err: any) {
            console.error("Submission failed:", err);
            const errorMsg = err.reason || err.message || "Encryption failed";
            setStatus(`Error: ${errorMsg}`);
            setIsSubmitting(false);
            setAllowSubmit(false); // Reset on error
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Only allow Enter key to move steps, NEVER submit the form
        if (e.key === "Enter") {
            e.preventDefault();
            if (currentStep < steps.length - 1) {
                nextStep();
            }
        }
    };

    return (
        <div className="bg-white dark:bg-[#0a1628] rounded-3xl border border-slate-200 dark:border-[#3b82f6]/10 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header / Info */}
            <div className="bg-slate-50 dark:bg-[#3b82f6]/5 p-6 border-b border-slate-100 dark:border-[#3b82f6]/10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:bg-[#3b82f6]/20 dark:text-[#3b82f6]">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Secure Record Upload</h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Add expanded clinical indicators to your encrypted profile.</p>

                {/* Stepper */}
                <div className="flex items-center justify-between mt-6 relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 z-0" />
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = currentStep >= i;
                        const isCurrent = currentStep === i;
                        return (
                            <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300",
                                    isActive
                                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20 dark:bg-[#3b82f6] dark:text-[#020810] dark:shadow-[#3b82f6]/20"
                                        : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className={cn(
                                    "text-[10px] uppercase tracking-widest font-bold",
                                    isActive ? "text-slate-900 dark:text-slate-200" : "text-slate-400 dark:text-slate-600"
                                )}>{s.title}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div onKeyDown={handleKeyDown} className="p-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 min-h-[280px]"
                    >
                        {currentStep === 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Biological Age</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={age}
                                            onChange={(e) => setAge(parseInt(e.target.value))}
                                            className="w-full h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#3b82f6]/20 transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">YRS</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Legal Gender</label>
                                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl h-12">
                                        <button
                                            type="button"
                                            onClick={() => setGender(true)}
                                            className={cn(
                                                "flex-1 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                                gender ? "bg-white dark:bg-[#3b82f6] text-blue-500 dark:text-[#020810] shadow-sm" : "text-slate-400"
                                            )}
                                        >
                                            Male
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setGender(false)}
                                            className={cn(
                                                "flex-1 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                                                !gender ? "bg-white dark:bg-[#3b82f6] text-blue-500 dark:text-[#020810] shadow-sm" : "text-slate-400"
                                            )}
                                        >
                                            Female
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <Ruler className="h-3 w-3" /> Height
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={height}
                                            onChange={(e) => setHeight(parseInt(e.target.value))}
                                            className="w-full h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#3b82f6]/20 transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">CM</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                        <Scale className="h-3 w-3" /> Body Weight
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={weight}
                                            onChange={(e) => setWeight(parseInt(e.target.value))}
                                            className="w-full h-12 pl-4 pr-12 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-[#3b82f6]/20 transition-all font-bold"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">KG</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="p-6 rounded-2xl bg-blue-50/50 dark:bg-[#3b82f6]/5 border border-blue-100 dark:border-[#3b82f6]/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-blue-500 dark:text-[#3b82f6]">
                                                <Droplets className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">Diagnostic: Diabetes</p>
                                                <p className="text-xs text-slate-500 font-medium">Type 1 or Type 2 Diagnosis</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setHasDiabetes(!hasDiabetes)}
                                            className={cn(
                                                "h-6 w-11 rounded-full relative transition-colors duration-200",
                                                hasDiabetes ? "bg-blue-500 dark:bg-[#3b82f6]" : "bg-slate-200 dark:bg-slate-800"
                                            )}
                                        >
                                            <div className={cn(
                                                "absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform duration-200",
                                                hasDiabetes ? "translate-x-5" : "translate-x-0"
                                            )} />
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Recent HbA1c Level</label>
                                        <input
                                            type="number"
                                            value={hbLevel}
                                            onChange={(e) => setHbLevel(parseInt(e.target.value))}
                                            className="w-full h-12 px-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold"
                                        />
                                        <span className="absolute right-4 bottom-3.5 text-[10px] font-bold text-slate-400">MG/DL Equivalent</span>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-rose-500">
                                            <Heart className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">Hypertension</p>
                                            <p className="text-xs text-slate-500 font-medium">Clinically High Blood Pressure</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHasHypertension(!hasHypertension)}
                                        className={cn(
                                            "h-6 w-11 rounded-full relative transition-colors duration-200",
                                            hasHypertension ? "bg-rose-500" : "bg-slate-200 dark:bg-slate-800"
                                        )}
                                    >
                                        <div className={cn(
                                            "absolute top-1 left-1 h-4 w-4 bg-white rounded-full transition-transform duration-200",
                                            hasHypertension ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div className="p-6 rounded-2xl bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 flex flex-col items-center text-center gap-4">
                                    <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5">
                                        <Cigarette className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lifestyle Factor: Smoking</h3>
                                        <p className="text-sm text-slate-500 max-w-xs mt-1">Select if you have used any tobacco products in the last 6 months.</p>
                                    </div>
                                    <div className="flex gap-3 w-full">
                                        <button
                                            type="button"
                                            onClick={() => setIsSmoker(true)}
                                            className={cn(
                                                "flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all",
                                                isSmoker ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20" : "bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800"
                                            )}
                                        >
                                            Current Smoker
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsSmoker(false)}
                                            className={cn(
                                                "flex-1 h-12 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all",
                                                !isSmoker ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-slate-800"
                                            )}
                                        >
                                            Non-Smoker
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-start gap-3">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">All data will be encrypted into secure FHE handles before leaving your browser. No plaintext data is ever stored on-chain.</p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Footer Actions */}
                <div className="mt-8 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={prevStep}
                        disabled={currentStep === 0 || isSubmitting}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-0 transition-all"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back
                    </button>

                    <div className="flex gap-3">
                        {currentStep < steps.length - 1 ? (
                            <Button
                                key="btn-next"
                                type="button"
                                onClick={nextStep}
                                className="bg-slate-900 dark:bg-[#3b82f6] text-white dark:text-[#020810] h-12 px-8 rounded-xl font-bold uppercase tracking-widest text-xs"
                            >
                                Next Step <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                key="btn-submit"
                                type="button"
                                onClick={() => handleSubmit()}
                                disabled={isSubmitting || !isFHEReady}
                                className="bg-blue-500 dark:bg-[#3b82f6] text-white dark:text-[#020810] h-12 px-8 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-500/20"
                            >
                                {isSubmitting ? "Securing Data..." : "Finalize & Upload"}
                            </Button>
                        )}
                    </div>
                </div>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "mt-6 p-4 rounded-2xl text-xs font-bold font-mono tracking-tight",
                            status.includes("Error") ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                        )}
                    >
                        {status}
                    </motion.div>
                )}
            </div>
        </div>
    );
}
