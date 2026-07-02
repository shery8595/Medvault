import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "../components/ui/Card";
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
  Info,
  ShieldCheck as ShieldIcon,
  AlertCircle,
  Coins,
  Activity,
  Upload,
  Loader2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3 } from "../lib/Web3Context";
import { cn } from "../lib/utils";
import { useSponsorTrialCreation } from "../hooks/useSponsorTrialCreation";
import { useSponsorVerification } from "../hooks/useSponsorVerification";
import {
  extractCriteriaFromProtocolPdf,
  isAiServiceConfigured,
  type RedactionReport,
} from "../lib/aiServiceClient";

import { sponsorCardHeader, sponsorCardShell } from "../lib/sponsorUi";

const labelClass = "text-xs font-semibold uppercase tracking-[0.08em] text-slate-500";

const inputLg =
  "h-12 rounded-xl border-slate-200 bg-white text-slate-900 text-base font-medium placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-teal-500/25 focus-visible:border-teal-400/80";

const subpanel =
  "space-y-4 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-6 transition-colors hover:bg-white";

export function SponsorCreateTrialPage() {
  const navigate = useNavigate();
  const { account, connect, isConnecting } = useWeb3();
  const { isVerified, isLoading: verifyLoading, isAdmin } = useSponsorVerification();
  const [step, setStep] = useState(1);
  const { status, setStatus, submitTrial } = useSponsorTrialCreation();
  const canActAsSponsor = isVerified || isAdmin;
  const blockedFromCreate = Boolean(account && !verifyLoading && !canActAsSponsor);
  const [formData, setFormData] = useState({
    name: "",
    phase: "Phase 1",
    location: "",
    compensation: "",
    description: "",
    duration: 30,
    durationUnit: "days" as "days" | "minutes",
    fundingAmount: "",
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
    requiresNormalBP: false,
  });

  const [milestones, setMilestones] = useState<{ name: string; weight: number; deadline: number }[]>([
    { name: "Initial Screening", weight: 2500, deadline: 7 },
    { name: "Phase 1 Completion", weight: 7500, deadline: 30 },
  ]);
  const [usePhasedPayouts, setUsePhasedPayouts] = useState(true);
  const [redactionReport, setRedactionReport] = useState<RedactionReport | null>(null);
  const [redactionAcknowledged, setRedactionAcknowledged] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiExtractError, setAiExtractError] = useState<string | null>(null);
  const [redactionBannerDismissed, setRedactionBannerDismissed] = useState(false);
  const protocolFileRef = useRef<HTMLInputElement>(null);
  const aiConfigured = isAiServiceConfigured();

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  useEffect(() => {
    const maxDeadline = formData.duration;
    let changed = false;
    const newMilestones = [...milestones];

    for (let i = 0; i < newMilestones.length; i++) {
      if (newMilestones[i].deadline > maxDeadline) {
        newMilestones[i].deadline = maxDeadline;
        changed = true;
      }
    }

    if (changed) {
      setMilestones(newMilestones);
    }
  }, [formData.duration, formData.durationUnit]);

  const handleSubmit = async () => {
    if (!formData.name) {
      setStatus("Error: Trial name is required.");
      setStep(1);
      return;
    }

    if (redactionReport && redactionReport.tokensRedacted > 0 && !redactionAcknowledged) {
      setStatus("Error: Acknowledge PHI redaction before submitting.");
      setStep(4);
      return;
    }

    const success = await submitTrial({
      formData,
      criteria,
      milestones,
      usePhasedPayouts,
    });

    if (success) {
      setTimeout(() => navigate("/sponsor/active-trials"), 1500);
    }
  };

  const handleNext = () => {
    if (step === 3 && usePhasedPayouts) {
      const totalWeight = milestones.reduce((acc, curr) => acc + curr.weight, 0);
      if (totalWeight !== 10000) {
        setStatus("Error: Total milestone weights must equal 100%.");
        return;
      }
      if (milestones.some((m) => !m.name)) {
        setStatus("Error: All milestones must have a name.");
        return;
      }
    }
    setStatus(null);
    nextStep();
  };

  const handleProtocolPdfUpload = async (file: File) => {
    setAiExtracting(true);
    setAiExtractError(null);
    setRedactionAcknowledged(false);
    setRedactionBannerDismissed(false);
    try {
      const result = await extractCriteriaFromProtocolPdf(file);
      setCriteria(result.criteria);
      setRedactionReport(result.redactionReport);
      setStatus("AI pre-filled eligibility criteria from protocol (review before submit).");
      setStep(4);
    } catch (err) {
      setAiExtractError(err instanceof Error ? err.message : "Protocol extraction failed");
    } finally {
      setAiExtracting(false);
    }
  };

  const showRedactionBanner =
    redactionReport &&
    redactionReport.tokensRedacted > 0 &&
    !redactionBannerDismissed;

  const submitBlockedByRedaction =
    Boolean(redactionReport && redactionReport.tokensRedacted > 0 && !redactionAcknowledged);

  const steps = [
    { title: "Protocol", icon: FileText },
    { title: "Details", icon: Target },
    { title: "Payouts", icon: Coins },
    { title: "Eligibility", icon: ShieldIcon },
  ];

  const totalWeight = milestones.reduce((acc, curr) => acc + curr.weight, 0);
  const weightOk = totalWeight === 10000;

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/40 px-6 py-8 md:px-10 md:py-9 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/50">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-teal-500/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-slate-400/[0.07] blur-3xl" />

        <div className="relative space-y-6">
          <Link
            to="/sponsor/active-trials"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 transition-colors hover:text-teal-800"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100">
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </span>
            Back to protocols
          </Link>

          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 ring-1 ring-teal-200/60">
                <FlaskConical className="h-7 w-7 text-teal-700" strokeWidth={2} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200/80">
                    <Activity className="h-4 w-4 text-slate-600" strokeWidth={2} />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">Sponsor console</p>
                </div>
                <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 md:text-[2rem] md:leading-tight">
                  Create protocol
                </h1>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600">
                  Define trial metadata, incentives, milestone splits, and encrypted eligibility — aligned with your active
                  protocols list.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {blockedFromCreate && (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/80 px-4 py-4 sm:flex-row sm:items-start sm:gap-4"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" strokeWidth={2} />
          <div className="min-w-0 space-y-2 text-sm">
            <p className="font-semibold text-amber-950">Verified sponsor required</p>
            <p className="leading-relaxed text-amber-900/90">
              Trial creation is restricted to wallets on the SponsorRegistry allowlist. Connect with an approved sponsor
              wallet, or ask a protocol admin to add this address.
            </p>
            {isAdmin && (
              <Link
                to="/admin/sponsors"
                className="inline-flex font-semibold text-amber-950 underline decoration-amber-700/50 underline-offset-2 hover:text-amber-900"
              >
                Open sponsor admin →
              </Link>
            )}
          </div>
        </div>
      )}

      {showRedactionBanner && redactionReport && (
        <div
          className="relative flex flex-col gap-3 rounded-2xl border border-amber-300/90 bg-amber-50 px-4 py-4 sm:flex-row sm:items-start"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" strokeWidth={2} />
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <p className="font-semibold text-amber-950">PHI redaction applied ({redactionReport.tokensRedacted} tokens)</p>
            <p className="leading-relaxed text-amber-900/90">
              Patient-identifying content was removed locally before AI extraction. Review pre-filled criteria and
              acknowledge before on-chain submit.
            </p>
            <ul className="text-xs text-amber-900/80 list-disc pl-4">
              {redactionReport.entities.slice(0, 5).map((e, i) => (
                <li key={`${e.token}-${i}`}>
                  {e.type} → {e.token}
                </li>
              ))}
              {redactionReport.entities.length > 5 && (
                <li>…and {redactionReport.entities.length - 5} more</li>
              )}
            </ul>
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={redactionAcknowledged}
                onChange={(e) => setRedactionAcknowledged(e.target.checked)}
              />
              <span className="font-medium text-amber-950">
                I reviewed the redaction report and confirm criteria before submitting on-chain.
              </span>
            </label>
          </div>
          <button
            type="button"
            className="absolute right-3 top-3 rounded-lg p-1 text-amber-800 hover:bg-amber-100/80"
            aria-label="Dismiss banner"
            onClick={() => setRedactionBannerDismissed(true)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-10 right-10 top-5 hidden h-px bg-slate-200 md:block" />
        <div className="relative z-10 grid grid-cols-2 gap-6 md:flex md:justify-between md:gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = step > i + 1;
            const isActive = step === i + 1;

            return (
              <div key={s.title} className="flex flex-col items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border transition-colors md:h-11 md:w-11",
                    isCompleted && "border-[#1D2634] bg-[#1D2634] text-white shadow-sm",
                    isActive && "border-teal-300 bg-teal-50 text-teal-800 ring-2 ring-teal-200/60",
                    !isActive && !isCompleted && "border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" strokeWidth={2} /> : <Icon className="h-5 w-5" strokeWidth={2} />}
                </div>
                <span
                  className={cn(
                    "max-w-[100px] text-center text-[10px] font-semibold uppercase tracking-[0.1em] md:max-w-none",
                    isActive ? "text-teal-800" : "text-slate-500",
                  )}
                >
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Card className={cn(sponsorCardShell, "overflow-hidden border-0")}>
        <CardContent className="p-6 md:p-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="rounded-2xl border-2 border-teal-200/90 bg-gradient-to-br from-teal-50/90 via-white to-indigo-50/40 p-6 shadow-sm ring-1 ring-teal-100/80">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                          <ShieldIcon className="h-3 w-3" />
                          Headline feature
                        </span>
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-emerald-800">
                          PHI-safe · redacted before LLM
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-semibold text-slate-900">
                        Upload protocol PDF → encrypted criteria
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
                        Dr. Chen uploads a sponsor protocol PDF. PHI is redacted locally, AI extracts eligibility
                        bounds, and you review before{" "}
                        <code className="text-xs bg-white/80 px-1 rounded">createTrialWithEncryptedCriteria</code>{" "}
                        encrypts bounds with Zama FHE on Sepolia.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                      <input
                        ref={protocolFileRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleProtocolPdfUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        disabled={!aiConfigured || aiExtracting}
                        className="gap-2 rounded-xl bg-teal-700 font-semibold text-white hover:bg-teal-800"
                        onClick={() => protocolFileRef.current?.click()}
                      >
                        {aiExtracting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {aiExtracting ? "Extracting criteria…" : "Upload protocol PDF"}
                      </Button>
                      {!aiConfigured && (
                        <p className="text-[11px] text-amber-800 text-right max-w-[220px]">
                          Set <code>VITE_AI_SERVICE_URL</code> to enable
                        </p>
                      )}
                    </div>
                  </div>
                  {aiExtractError && (
                    <p className="mt-3 text-xs text-rose-700" role="alert">
                      {aiExtractError}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>Trial name</label>
                  <Input
                    placeholder="e.g. Phase 2 mRNA immune response"
                    className={cn(inputLg, "h-14 text-lg")}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className={cn(subpanel, "opacity-80")}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Or enter trial metadata manually below — criteria step still uses encrypted bounds.
                    </p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={labelClass}>Clinical phase</label>
                    <div className="group relative">
                      <select
                        className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-11 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400/80"
                        value={formData.phase}
                        onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                      >
                        <option>Phase 1</option>
                        <option>Phase 2</option>
                        <option>Phase 3</option>
                        <option>Phase 4</option>
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={labelClass}>Location</label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="City, region"
                        className={cn(inputLg, "h-12 pl-10")}
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className={subpanel}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <DollarSign className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <h4 className="font-display text-base font-semibold text-slate-900">Compensation</h4>
                    </div>
                    <Input
                      placeholder="$2,500 + travel"
                      className={inputLg}
                      value={formData.compensation}
                      onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">Shown to matched candidates only.</p>
                  </div>
                  <div className={subpanel}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                        <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <h4 className="font-display text-base font-semibold text-slate-900">Vault outcomes</h4>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-600">
                      With consent, trial outcomes can be reflected in the patient vault via the protocol relay — no raw
                      PHI exposed to sponsors.
                    </p>
                  </div>
                  <div className={subpanel}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
                        <Clock className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <h4 className="font-display text-base font-semibold text-slate-900">Duration</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        type="number"
                        placeholder="30"
                        min={1}
                        className={cn(inputLg, "h-12 w-28 font-semibold tabular-nums")}
                        value={formData.duration}
                        onChange={(e) =>
                          setFormData({ ...formData, duration: Math.max(1, parseInt(e.target.value, 10) || 1) })
                        }
                      />
                      <select
                        className="h-12 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                        value={formData.durationUnit}
                        onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as "days" | "minutes" })}
                      >
                        <option value="days">Days</option>
                        <option value="minutes">Minutes</option>
                      </select>
                    </div>
                    <p className="text-xs text-slate-500">Used for milestone deadlines and automation windows.</p>
                  </div>
                  <div className={subpanel}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                        <Coins className="h-5 w-5" strokeWidth={2} />
                      </div>
                      <h4 className="font-display text-base font-semibold text-slate-900">Initial funding</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Input
                        type="number"
                        placeholder="0.05"
                        step="0.01"
                        min="0"
                        className={cn(inputLg, "h-12 w-36 font-semibold tabular-nums")}
                        value={formData.fundingAmount}
                        onChange={(e) => setFormData({ ...formData, fundingAmount: e.target.value })}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">ETH</span>
                    </div>
                    <p className="text-xs text-slate-500">Optional escrow seed when creating the trial.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Brief overview</label>
                  <textarea
                    placeholder="Objectives, visit schedule, and participation expectations…"
                    className="min-h-[140px] w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400/80"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="flex flex-col gap-6 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-200/70">
                      <TrendingUp className="h-6 w-6 text-amber-700" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900">Milestone payouts</h3>
                      <p className="mt-1 text-sm text-slate-600">Split incentives across phases or pay once at completion.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Phased payouts</span>
                    <button
                      type="button"
                      onClick={() => setUsePhasedPayouts(!usePhasedPayouts)}
                      className={cn(
                        "relative h-7 w-12 rounded-full p-0.5 transition-colors",
                        usePhasedPayouts ? "bg-[#1D2634]" : "bg-slate-300",
                      )}
                      aria-pressed={usePhasedPayouts}
                    >
                      <span
                        className={cn(
                          "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
                          usePhasedPayouts ? "translate-x-5" : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>

                {usePhasedPayouts ? (
                  <div className="space-y-6">
                    <div className="flex gap-3 rounded-xl border border-slate-200/90 bg-slate-50 p-4">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" strokeWidth={2} />
                      <p className="text-sm leading-relaxed text-slate-600">
                        Name each milestone and assign a share of the pool. Weights must total <strong>100%</strong> before
                        you continue.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {milestones.map((m, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 transition-colors hover:bg-white md:flex-row md:items-end"
                        >
                          <div className="min-w-0 flex-1 space-y-2">
                            <label className={labelClass}>Milestone name</label>
                            <Input
                              value={m.name}
                              onChange={(e) => {
                                const copy = [...milestones];
                                copy[idx].name = e.target.value;
                                setMilestones(copy);
                              }}
                              placeholder="e.g. Screening complete"
                              className={inputLg}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4 sm:w-auto sm:grid-cols-none sm:flex sm:items-end">
                            <div className="w-full space-y-2 sm:w-24">
                              <label className={labelClass}>Weight %</label>
                              <Input
                                type="number"
                                value={m.weight / 100}
                                onChange={(e) => {
                                  const copy = [...milestones];
                                  copy[idx].weight = Math.round(Number(e.target.value) * 100);
                                  setMilestones(copy);
                                }}
                                className={cn(inputLg, "tabular-nums")}
                              />
                            </div>
                            <div className="w-full space-y-2 sm:w-24">
                              <label className={labelClass}>
                                {formData.durationUnit === "days" ? "Day" : "Min"}
                              </label>
                              <Input
                                type="number"
                                value={m.deadline}
                                onChange={(e) => {
                                  const copy = [...milestones];
                                  copy[idx].deadline = parseInt(e.target.value, 10) || 0;
                                  setMilestones(copy);
                                }}
                                className={cn(inputLg, "tabular-nums")}
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setMilestones(milestones.filter((_, i) => i !== idx))}
                            disabled={milestones.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-4 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        variant="outline"
                        className="gap-2 rounded-xl border-dashed border-slate-300 bg-white font-semibold hover:border-teal-300 hover:bg-teal-50/50"
                        onClick={() =>
                          setMilestones([
                            ...milestones,
                            { name: "", weight: 0, deadline: formData.durationUnit === "days" ? 30 : 10 },
                          ])
                        }
                      >
                        <Plus className="h-4 w-4" strokeWidth={2} />
                        Add milestone
                      </Button>

                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide",
                          weightOk
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-amber-200 bg-amber-50 text-amber-900",
                        )}
                      >
                        <span>Allocation {totalWeight / 100}%</span>
                        {!weightOk && <span className="font-normal normal-case text-amber-800/80">Target 100%</span>}
                        {weightOk && <CheckCircle2 className="h-4 w-4" strokeWidth={2} />}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <Coins className="h-7 w-7 text-slate-400" strokeWidth={2} />
                    </div>
                    <div className="space-y-1">
                      <p className="font-display text-base font-semibold text-slate-900">Single disbursement</p>
                      <p className="mx-auto max-w-md text-sm text-slate-600">
                        Participants receive the full reward when the protocol completes — no intermediate milestones.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl border-slate-300 font-semibold hover:border-teal-300 hover:bg-teal-50/50"
                      onClick={() => setUsePhasedPayouts(true)}
                    >
                      Use phased payouts
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
                  <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-800" strokeWidth={2} />
                  <p className="text-sm font-medium leading-relaxed text-amber-950/90">
                    Eligibility rules are evaluated on encrypted patient attributes. Sponsors see match outcomes, not
                    underlying health fields.
                  </p>
                </div>
                <CriteriaBuilder criteria={criteria} onChange={setCriteria} />
                {status && (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium",
                      status.startsWith("Error")
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : "border-teal-200 bg-teal-50 text-teal-900",
                    )}
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {status}
                  </div>
                )}
                {!account && (
                  <Button
                    onClick={connect}
                    disabled={isConnecting}
                    className="h-12 w-full gap-2 rounded-xl border border-slate-800 bg-slate-900 font-semibold text-white shadow-none hover:bg-slate-800"
                  >
                    <ShieldIcon className="h-4 w-4" strokeWidth={2} />
                    {isConnecting ? "Connecting…" : "Log in to submit"}
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 flex flex-col gap-4 border-t border-slate-200/80 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={prevStep}
              disabled={step === 1}
              className="order-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 sm:order-1"
            >
              Back
            </Button>
            {step < 4 ? (
              <Button
                onClick={handleNext}
                className="order-1 gap-2 rounded-xl border border-slate-800 bg-slate-900 px-6 font-semibold text-white shadow-none hover:bg-slate-800 sm:order-2 sm:ml-auto"
              >
                Continue
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!account || blockedFromCreate || submitBlockedByRedaction}
                title={
                  submitBlockedByRedaction
                    ? "Acknowledge PHI redaction before submitting"
                    : blockedFromCreate
                      ? "Wallet must be allowlisted on Sponsor Registry or be the registry owner"
                      : undefined
                }
                className="order-1 gap-2 rounded-xl border border-emerald-700 bg-emerald-600 px-6 font-semibold text-white shadow-none hover:bg-emerald-700 disabled:opacity-50 sm:order-2 sm:ml-auto"
              >
                Create protocol
                <ShieldIcon className="h-4 w-4" strokeWidth={2} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
