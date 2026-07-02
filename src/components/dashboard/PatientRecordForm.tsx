import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, ShieldCheck, Stethoscope, Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { useWeb3 } from "../../lib/Web3Context";
import { buildPatientProfileInputs, yieldToMain } from "../../lib/fhe";
import { friendlyContractError } from "../../lib/contractErrors";
import { getContractAddressForChain, getDataAccessLog } from "../../lib/contracts";
import { storePatientProfilePlain } from "../../lib/profileStorage";
import { cn } from "../../lib/utils";

import {
  type ReclaimAttestation,
  isAttestationExpired,
} from "../../lib/reclaim";
import type { FhirMappedProfile } from "../../lib/fhirImport";

interface PatientRecordFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    /** Set after a successful Reclaim session before this form (optional). */
    reclaimAttestation?: ReclaimAttestation | null;
    /** Prefill from FHIR importer or similar (optional). */
    prefillProfile?: FhirMappedProfile | null;
}

type FormErrors = {
    age?: string;
    weight?: string;
    height?: string;
    hbLevel?: string;
    gender?: string;
};

type EncryptPhase = {
    step: number;
    total: number;
    label: string;
};

const ENCRYPT_STEPS_TOTAL = 5;

export function PatientRecordForm({ onSuccess, onCancel, reclaimAttestation, prefillProfile }: PatientRecordFormProps) {
    const { signer, account, isFHEReady, connect, isConnecting, error: connectError } = useWeb3();
    const [age, setAge] = useState("25");
    const [gender, setGender] = useState<"male" | "female" | "">("");
    const [weight, setWeight] = useState("70");
    const [height, setHeight] = useState("175");
    const [hasDiabetes, setHasDiabetes] = useState<"yes" | "no" | "">("");
    const [hbLevel, setHbLevel] = useState("110");
    const [isSmoker, setIsSmoker] = useState(false);
    const [hasHypertension, setHasHypertension] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [encryptPhase, setEncryptPhase] = useState<EncryptPhase | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [errors, setErrors] = useState<FormErrors>({});
    const [alreadyRegistered, setAlreadyRegistered] = useState(false);

    React.useEffect(() => {
        if (!prefillProfile) return;
        if (prefillProfile.age != null) setAge(String(prefillProfile.age));
        if (prefillProfile.gender) setGender(prefillProfile.gender);
        if (prefillProfile.weightKg != null) setWeight(String(Math.round(prefillProfile.weightKg)));
        if (prefillProfile.heightCm != null) setHeight(String(Math.round(prefillProfile.heightCm)));
        if (prefillProfile.hbApprox != null) setHbLevel(String(Math.round(prefillProfile.hbApprox)));
        if (prefillProfile.hasDiabetes === true) setHasDiabetes("yes");
        else if (prefillProfile.hasDiabetes === false) setHasDiabetes("no");
        if (prefillProfile.isSmoker === true) setIsSmoker(true);
        if (prefillProfile.isSmoker === false) setIsSmoker(false);
        if (prefillProfile.hasHypertension === true) setHasHypertension(true);
    }, [prefillProfile]);

    const canSubmit = useMemo(() => {
        return !!account && isFHEReady && !isSubmitting;
    }, [account, isFHEReady, isSubmitting]);

    const validateForm = (): FormErrors => {
        const parsedAge = Number(age);
        const parsedWeight = Number(weight);
        const parsedHeight = Number(height);
        const parsedHb = Number(hbLevel);
        const nextErrors: FormErrors = {};

        if (!gender) nextErrors.gender = "Please select biological sex.";
        if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
            nextErrors.age = "Age must be between 1 and 120.";
        }
        if (!Number.isFinite(parsedWeight) || parsedWeight < 20 || parsedWeight > 300) {
            nextErrors.weight = "Weight must be between 20 and 300 kg.";
        }
        if (!Number.isFinite(parsedHeight) || parsedHeight < 100 || parsedHeight > 250) {
            nextErrors.height = "Height must be between 100 and 250 cm.";
        }
        if (!Number.isFinite(parsedHb) || parsedHb < 20 || parsedHb > 300) {
            nextErrors.hbLevel = "HbA1c equivalent must be between 20 and 300.";
        }
        return nextErrors;
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!canSubmit) {
            return;
        }

        const validationErrors = validateForm();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length > 0) {
            setStatus("Error: Please fix the highlighted fields.");
            return;
        }

        if (!signer || !account || !isFHEReady) {
            setStatus("Error: Wallet not connected or FHE not ready");
            return;
        }

        setIsSubmitting(true);
        setEncryptPhase(null);
        setStatus("Starting secure encryption…");

        const advance = async (step: number, label: string) => {
            setEncryptPhase({ step, total: ENCRYPT_STEPS_TOTAL, label });
            setStatus(label);
            await yieldToMain();
        };

        try {
            const provider = await signer.provider;
            if (!provider) {
                throw new Error("No provider from signer.");
            }

            const chainId = await provider.getNetwork().then((network) => network.chainId).catch(() => undefined);

            await advance(1, "Checking protocol wiring…");
            const anonymousRegistryAddress = getContractAddressForChain("AnonymousPatientRegistry", chainId);
            if (!anonymousRegistryAddress) {
                throw new Error("AnonymousPatientRegistry address not configured for current network.");
            }
            const registryAddress = getContractAddressForChain("MedVaultRegistry", chainId);
            if (!registryAddress) {
                throw new Error("MedVaultRegistry address not configured for current network.");
            }
            const dataAccessLog = getDataAccessLog(provider, chainId);
            const patientRegistryCanLog = await dataAccessLog.isAuthorizedLogger(anonymousRegistryAddress);
            if (!patientRegistryCanLog) {
                throw new Error(
                    "Protocol wiring issue: AnonymousPatientRegistry is not authorized in DataAccessLog. " +
                    "Ask the protocol admin to run `npx hardhat run scripts/fix-loggers.ts --network sepolia`, then try again."
                );
            }

            await advance(2, "Private identity…");
            const identity = getOrCreateIdentity();
            await yieldToMain();

            // Guard 1: Check if this WALLET has already registered (regardless of commitment).
            // MedVaultRegistry.registerPatient() checks `registered[msg.sender]` and reverts
            // with "Already registered" inside a cross-contract call, which surfaces as
            // "missing revert data" (data=null) on estimateGas. Catch it early.
            const walletAlreadyRegistered = await isPatientRegistered(signer);
            if (walletAlreadyRegistered) {
                setAlreadyRegistered(true);
                setIsSubmitting(false);
                setEncryptPhase(null);
                setStatus(null);
                return;
            }

            // Guard 2: if this commitment is already in the Semaphore group the tx WILL revert
            // with a custom error (0x258a195a) before FHE is ever reached.
            // Check on-chain before spending time on encryption.
            const alreadyIn = await isMemberRegistered(provider, identity.commitment);
            if (alreadyIn) {
                setAlreadyRegistered(true);
                setIsSubmitting(false);
                setEncryptPhase(null);
                setStatus(null);
                return;
            }

            // FHE verifyInput binds (contract=APR, user=MVR) when MVR forwards registerPatient.
            const parsedAge = Number(age);
            const parsedWeight = Number(weight);
            const parsedHeight = Number(height);
            const parsedHb = Number(hbLevel);

            await advance(3, "Encrypt: health profile…");
            const encryptedData = await buildPatientProfileInputs(
                anonymousRegistryAddress,
                registryAddress,
                {
                    age: parsedAge,
                    gender: gender === "male",
                    weight: parsedWeight,
                    height: parsedHeight,
                    hasDiabetes: hasDiabetes === "yes",
                    hbLevel: parsedHb,
                    isSmoker,
                    hasHypertension,
                }
            );

            await advance(4, "Wallet: sign & submit…");
            const profilePlain = {
                age: parsedAge,
                gender: gender === "male",
                weight: parsedWeight,
                height: parsedHeight,
                hasDiabetes: hasDiabetes === "yes",
                hbLevel: parsedHb,
                isSmoker,
                hasHypertension,
            };
            storePatientProfilePlain(profilePlain);
            await registerPatientWithHealthData(signer, identity, encryptedData, profilePlain);

            setStatus("Submitted. Record encrypted and linked to your anonymous identity.");
            setEncryptPhase({ step: ENCRYPT_STEPS_TOTAL, total: ENCRYPT_STEPS_TOTAL, label: "Done" });
            setIsSubmitting(false);
            setTimeout(() => {
                setEncryptPhase(null);
                onSuccess();
            }, 1600);
        } catch (err: any) {
            console.error("Submission failed:", err);
            let errorMsg = friendlyContractError(err);

            if (
                errorMsg.includes("missing revert data") ||
                (err.code === "CALL_EXCEPTION" && err.data === null)
            ) {
                errorMsg =
                    "Transaction would revert on-chain. This usually means your wallet is already registered, " +
                    "the Semaphore commitment is a duplicate, or the FHE encrypted inputs are invalid. " +
                    "Try clicking \"Reset Identity\" or reconnecting your wallet.";
            }

            setStatus(`Error: ${errorMsg}`);
            setEncryptPhase(null);
            setIsSubmitting(false);
        }
    };

    const progressPct = encryptPhase
        ? Math.min(100, Math.round((encryptPhase.step / encryptPhase.total) * 100))
        : 0;

    const showEncryptProgress = isSubmitting || encryptPhase !== null;

    if (alreadyRegistered) {
        return (
            <div className="relative overflow-hidden rounded-[2rem] border border-teal-200 bg-white shadow-xl">
                <div className="absolute top-0 right-0 h-64 w-64 -translate-y-1/3 translate-x-1/3 rounded-full bg-teal-100/50 blur-[80px] pointer-events-none" />
                <div className="relative z-10 p-10 flex flex-col items-center text-center gap-6">
                    <div className="h-20 w-20 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center shadow-inner">
                        <ShieldCheck className="h-10 w-10 text-teal-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Already Registered</h2>
                        <p className="text-slate-600 max-w-sm mx-auto leading-relaxed">
                            Your anonymous health identity is already on-chain. Your vault is active and ready — no re-registration needed.
                        </p>
                    </div>
                    <div className="w-full rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left">
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1">Why did this happen?</p>
                        <p className="text-sm text-amber-800">
                            Your device's Semaphore identity (stored locally) was already registered in a previous session. Submitting again would revert on-chain because the commitment already exists in the privacy group.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <Button
                            onClick={onSuccess}
                            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold h-12 px-6 rounded-2xl gap-2"
                        >
                            <ShieldCheck className="h-4 w-4" />
                            Go to My Vault
                        </Button>
                        <Button
                            onClick={() => {
                                forceNewIdentity();
                                setAlreadyRegistered(false);
                                setStatus("New identity created. Fill in your details and submit.");
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold h-12 px-6 rounded-2xl gap-2 border border-slate-200"
                        >
                            Reset Identity
                        </Button>
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                        "Reset Identity" generates a brand-new anonymous key. Only use this if you deliberately want a fresh on-chain profile.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl">
            <div className="absolute top-0 right-0 h-72 w-72 -translate-y-1/3 translate-x-1/4 rounded-full bg-teal-100/60 blur-[90px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 h-56 w-56 translate-y-1/3 -translate-x-1/4 rounded-full bg-emerald-100/50 blur-[80px] pointer-events-none" />

            <div className="relative z-10 p-6 md:p-8 border-b border-slate-200 bg-slate-50/80">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
                        <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Encrypt Health Data</h2>
                </div>
                <p className="text-slate-600">
                    Enter your baseline clinical metrics. This data is encrypted locally before transmission.
                </p>
                {reclaimAttestation ? (
                    <div
                        className={cn(
                            "mt-4 rounded-2xl border px-4 py-3",
                            isAttestationExpired(reclaimAttestation)
                                ? "border-amber-300 bg-amber-50/90"
                                : "border-emerald-200 bg-emerald-50/80"
                        )}
                    >
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800 mb-1">
                            Reclaim — {reclaimAttestation.kind.replace("_", " ")}
                        </p>
                        {isAttestationExpired(reclaimAttestation) ? (
                            <p className="text-sm text-amber-950 font-semibold mb-1">
                                This session attestation expired. Run Reclaim again for a fresh audit trail (optional).
                            </p>
                        ) : null}
                        <p className="text-sm text-emerald-900/90">
                            Provider{" "}
                            <code className="text-xs bg-white/60 px-1 rounded border border-emerald-200/80">
                                {reclaimAttestation.providerId}
                            </code>
                            {reclaimAttestation.expiresAt ? (
                                <>
                                    {" "}
                                    · valid until{" "}
                                    <span className="font-semibold tabular-nums">
                                        {new Date(reclaimAttestation.expiresAt).toLocaleString()}
                                    </span>
                                </>
                            ) : (
                                <> · no local expiry stamp</>
                            )}
                            . Encrypted values below are separate from the proof.
                        </p>
                    </div>
                ) : null}
            </div>

            <form
                onSubmit={handleSubmit}
                className="relative z-10 p-6 md:p-8 space-y-6"
                aria-busy={isSubmitting}
            >
                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white text-violet-700 mt-0.5 border border-violet-200">
                        <Lock className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-semibold text-violet-900 text-sm">Zero-Knowledge Proof Active</p>
                        <p className="text-violet-800/90 text-sm">
                            Your data is encrypted before leaving your device. Researchers receive verifying proof without exposing underlying values.
                        </p>
                    </div>
                </div>

                {showEncryptProgress ? (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border border-teal-200 bg-gradient-to-b from-teal-50/90 to-white px-4 py-4 shadow-sm"
                        role="status"
                        aria-live="polite"
                    >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Encryption progress</p>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                            <div className="relative shrink-0">
                                <motion.div
                                    className="absolute -inset-2 rounded-2xl bg-teal-400/15"
                                    animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                />
                                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-teal-200 bg-white shadow-sm">
                                    <Lock className="h-5 w-5 text-teal-600" strokeWidth={2} />
                                    <Sparkles
                                        className="absolute -right-0.5 -top-0.5 h-4 w-4 text-amber-400"
                                        strokeWidth={2}
                                        aria-hidden
                                    />
                                </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <p className="text-sm font-semibold text-slate-800">
                                    {encryptPhase?.label ?? "Preparing…"}
                                </p>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                                        initial={false}
                                        animate={{ width: `${progressPct}%` }}
                                        transition={{ type: "spring", stiffness: 200, damping: 26 }}
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    Step {encryptPhase?.step ?? 0} of {ENCRYPT_STEPS_TOTAL}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ) : null}

                <fieldset
                    disabled={isSubmitting || encryptPhase?.step === ENCRYPT_STEPS_TOTAL}
                    className="min-w-0 space-y-6 border-0 p-0 disabled:opacity-60"
                >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Age" error={errors.age}>
                        <InputShell
                            type="number"
                            value={age}
                            placeholder="Years"
                            onChange={setAge}
                            trailing={<span className="text-slate-400 text-xs font-semibold">yrs</span>}
                        />
                    </Field>
                    <Field label="Biological Sex" error={errors.gender}>
                        <SelectShell
                            value={gender}
                            onChange={setGender}
                            placeholder="Select..."
                            options={[
                                { label: "Male", value: "male" },
                                { label: "Female", value: "female" }
                            ]}
                        />
                    </Field>
                    <Field label="Weight" error={errors.weight}>
                        <InputShell
                            type="number"
                            value={weight}
                            placeholder="kg"
                            onChange={setWeight}
                            trailing={<span className="text-slate-400 text-xs font-semibold">kg</span>}
                        />
                    </Field>
                    <Field label="Height" error={errors.height}>
                        <InputShell
                            type="number"
                            value={height}
                            placeholder="cm"
                            onChange={setHeight}
                            trailing={<span className="text-slate-400 text-xs font-semibold">cm</span>}
                        />
                    </Field>
                    <Field label="HbA1c Level (Equivalent)" error={errors.hbLevel}>
                        <InputShell
                            type="number"
                            value={hbLevel}
                            placeholder="e.g. 110"
                            onChange={setHbLevel}
                        />
                    </Field>
                    <Field label="Diabetes Diagnosis">
                        <SelectShell
                            value={hasDiabetes}
                            onChange={setHasDiabetes}
                            placeholder="Select status..."
                            options={[
                                { label: "Yes", value: "yes" },
                                { label: "No", value: "no" }
                            ]}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <ToggleCard
                        title="Smoker Status"
                        enabled={isSmoker}
                        onToggle={() => setIsSmoker((prev) => !prev)}
                    />
                    <ToggleCard
                        title="Hypertension"
                        enabled={hasHypertension}
                        onToggle={() => setHasHypertension((prev) => !prev)}
                    />
                </div>
                </fieldset>

                {!account ? (
                    <Button
                        type="button"
                        onClick={() => void connect()}
                        disabled={isConnecting}
                        className="w-full md:w-auto md:ml-auto h-12 px-8 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20"
                    >
                        {isConnecting ? "Connecting..." : "Log in"}
                    </Button>
                ) : (
                    <div className="flex items-center justify-between pt-2">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            className="text-sm text-slate-500 transition-colors enabled:hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <motion.div
                            animate={isSubmitting ? { scale: [1, 1.01, 1] } : { scale: 1 }}
                            transition={isSubmitting ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                        >
                            <Button
                                type="submit"
                                disabled={!canSubmit}
                                className={cn(
                                    "h-12 px-8 rounded-full bg-teal-600 font-semibold shadow-lg shadow-teal-600/20",
                                    isSubmitting
                                        ? "text-white"
                                        : "hover:bg-teal-700 text-white"
                                )}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" aria-hidden />
                                        {encryptPhase?.label ?? "Encrypting…"}
                                    </>
                                ) : (
                                    <>
                                        Encrypt &amp; Continue
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    </div>
                )}

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "p-3 rounded-xl text-xs font-semibold",
                            status.includes("Error")
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : "bg-teal-50 text-teal-700 border border-teal-100"
                        )}
                    >
                        {status}
                    </motion.div>
                )}
                {!account && connectError ? (
                    <p className="text-sm text-rose-600">{connectError}</p>
                ) : null}
            </form>
        </div>
    );
}

function Field({
    label,
    error,
    children
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
            {children}
            {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
    );
}

function InputShell({
    type = "text",
    value,
    onChange,
    placeholder,
    trailing
}: {
    type?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    trailing?: React.ReactNode;
}) {
    return (
        <div className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center gap-2">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="bg-transparent outline-none w-full text-slate-800 placeholder:text-slate-400"
            />
            <Lock className="h-4 w-4 text-teal-600/80 shrink-0" />
            {trailing}
        </div>
    );
}

function SelectShell({
    value,
    onChange,
    placeholder,
    options
}: {
    value: string;
    onChange: (v: any) => void;
    placeholder: string;
    options: Array<{ label: string; value: string }>;
}) {
    return (
        <div className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center gap-2">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-transparent outline-none w-full text-slate-800"
            >
                <option value="" disabled>
                    {placeholder}
                </option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            <Lock className="h-4 w-4 text-teal-600/80 shrink-0" />
        </div>
    );
}

function ToggleCard({
    title,
    enabled,
    onToggle
}: {
    title: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="h-14 rounded-xl border border-slate-200 bg-slate-50 px-4 flex items-center justify-between"
        >
            <span className="text-sm font-medium text-slate-800 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-slate-500" />
                {title}
            </span>
            <span
                className={cn(
                    "h-6 w-10 rounded-full relative transition-colors",
                    enabled ? "bg-teal-500" : "bg-slate-300"
                )}
            >
                <span
                    className={cn(
                        "absolute top-1 h-4 w-4 rounded-full bg-white transition-all",
                        enabled ? "left-5" : "left-1"
                    )}
                />
            </span>
        </button>
    );
}
