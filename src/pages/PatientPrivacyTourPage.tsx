import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Fingerprint,
  Sparkles,
  ArrowRight,
  FileKey,
  Telescope,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { PatientConnectPrompt } from "../components/dashboard/PatientConnectPrompt";
import { useWeb3 } from "../lib/Web3Context";
import { cn } from "../lib/utils";

const steps = [
  {
    n: 1,
    title: "Medical vault",
    detail: "Register once with Semaphore — your commitment replaces your name.",
    icon: ShieldCheck,
    tint: "teal",
    to: "/patient/medical-vault",
    label: "Open vault",
  },
  {
    n: 2,
    title: "Encrypted profile",
    detail: "@zama-fhe/sdk encrypts vitals locally; ciphertext is what hits the RPC.",
    icon: Lock,
    tint: "violet",
    to: "/patient/medical-vault",
    label: "See encryption",
  },
  {
    n: 3,
    title: "Find & apply",
    detail: "Eligibility runs on ciphertext (FHE). Sponsors define criteria — not plaintext.",
    icon: Telescope,
    tint: "indigo",
    to: "/patient/find-trials",
    label: "Find trials",
  },
  {
    n: 4,
    title: "Results + compliance seal",
    detail: "Decrypt locally with Zama, then optionally generate a Noir attestation — HonkVerifier records the seal on-chain.",
    icon: Fingerprint,
    tint: "violet",
    to: "/patient/results",
    label: "Go to results",
  },
];

const tintMap: Record<
  string,
  { chip: string; iconBg: string; iconText: string; border: string }
> = {
  teal: {
    chip: "bg-teal-50 text-teal-800 ring-teal-200",
    iconBg: "bg-teal-600 text-white",
    iconText: "text-teal-800",
    border: "border-teal-100",
  },
  violet: {
    chip: "bg-violet-50 text-violet-900 ring-violet-200",
    iconBg: "bg-violet-600 text-white",
    iconText: "text-violet-900",
    border: "border-violet-100",
  },
  indigo: {
    chip: "bg-indigo-50 text-indigo-900 ring-indigo-200",
    iconBg: "bg-indigo-600 text-white",
    iconText: "text-indigo-900",
    border: "border-indigo-100",
  },
};

export function PatientPrivacyTourPage() {
  const { account } = useWeb3();
  const isConnected = Boolean(account);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">
      <SectionTopBar
        title="Privacy in 60 seconds"
        rightContent={
          <Link to="/patient/dashboard" className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800">
            Dashboard
          </Link>
        }
      />

      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white px-6 py-8 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.08)] md:px-10"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-teal-400/[0.12] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-40 w-40 rounded-full bg-indigo-400/[0.12] blur-3xl" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-teal-900 w-fit">
            <Sparkles className="h-3.5 w-3.5" />
            Guided tour
          </div>
          <h1 className="font-display text-2xl md:text-[1.85rem] font-semibold tracking-tight text-slate-900 leading-tight">
            How MedVault keeps your clinic data&nbsp;shielded
          </h1>
          <p className="max-w-xl text-sm text-slate-600 leading-relaxed">
            Designed for demos and onboarding: tap each step below. No PHI ever appears on-chain in plaintext — eligibility
            and scores stay inside FHE and permissioned decrypt flows.
          </p>
          <Link to="/docs/introduction" className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
            Read full docs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </motion.header>

      {isConnected ? (
      <ol className="relative space-y-4">
        {steps.map((s, idx) => {
          const Tint = tintMap[s.tint];
          const Icon = s.icon;
          return (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.35 }}
              className={cn(
                "relative flex gap-4 rounded-2xl border bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow",
                Tint.border
              )}
            >
              <div className="flex flex-col items-center gap-2 pt-0.5">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shadow-sm ring-1",
                    Tint.chip
                  )}
                >
                  {s.n}
                </span>
                {idx < steps.length - 1 ? (
                  <span className="hidden sm:block flex-1 w-px grow min-h-[24px] bg-gradient-to-b from-slate-200 to-transparent" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", Tint.iconBg)}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <h2 className={cn("text-base font-bold", Tint.iconText)}>{s.title}</h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{s.detail}</p>
                <Link to={s.to}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-slate-200 font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {s.label}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              {idx === steps.length - 1 ? (
                <CheckCircle2 className="absolute right-4 top-4 h-5 w-5 text-emerald-500 hidden sm:block" aria-hidden />
              ) : null}
            </motion.li>
          );
        })}
      </ol>
      ) : (
        <PatientConnectPrompt
          title="Connect to walk through the privacy tour"
          description="The guided steps use your vault and wallet context. You can still read the overview above, then log in to open each step."
          showBrowseTrials={false}
        />
      )}

      {isConnected ? (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 flex gap-4 items-start">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200">
          <FileKey className="h-5 w-5 text-slate-600" aria-hidden />
        </div>
        <div className="min-w-0 text-sm text-slate-600">
          <strong className="text-slate-900">Consent & audits</strong> live under{" "}
          <Link to="/patient/consent-logs" className="font-semibold text-teal-700 underline-offset-4 hover:underline">
            Consent logs
          </Link>{" "}
          and sponsor{" "}
          <Link to="/sponsor/audit-logs" className="font-semibold text-teal-700 underline-offset-4 hover:underline">
            Audit logs
          </Link>{" "}
          for an integrity trail — still without exposing ciphertext contents.
        </div>
      </div>
      ) : null}
    </div>
  );
}
