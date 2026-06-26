import { Shield, Lock, Fingerprint, CheckCircle2, Gift, FileCheck } from "lucide-react";
import { cn } from "../../lib/utils";

export type PrivacyTimelineEvent = {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  timestamp?: string | null;
};

type Props = {
  events: PrivacyTimelineEvent[];
  className?: string;
};

const ICONS = [Lock, Fingerprint, Shield, CheckCircle2, FileCheck, Gift];

export function PrivacyTimeline({ events, className }: Props) {
  return (
    <div className={cn("rounded-2xl border border-teal-100/90 bg-gradient-to-br from-teal-50/50 via-white to-slate-50 p-5", className)}>
      <h3 className="text-sm font-bold text-slate-900 mb-4">Privacy timeline</h3>
      <ol className="space-y-0">
        {events.map((event, index) => {
          const Icon = ICONS[index % ICONS.length];
          const isLast = index === events.length - 1;
          return (
            <li key={event.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border",
                    event.completed
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-400"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {!isLast && (
                  <span
                    className={cn(
                      "my-1 w-px flex-1 min-h-[1.5rem]",
                      event.completed ? "bg-emerald-200" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
              <div className={cn("min-w-0 pb-4", isLast && "pb-0")}>
                <p className={cn("text-sm font-semibold", event.completed ? "text-slate-900" : "text-slate-500")}>
                  {event.label}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{event.description}</p>
                {event.timestamp && (
                  <p className="text-[10px] font-mono text-slate-400 mt-1">{event.timestamp}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function buildDefaultPrivacyTimeline(input: {
  hasProfile: boolean;
  hasConsent: boolean;
  hasSemaphoreIdentity: boolean;
  hasApplied: boolean;
  applicationAccepted: boolean;
  rewardClaimed: boolean;
}): PrivacyTimelineEvent[] {
  return [
    {
      id: "encrypted",
      label: "Profile encrypted",
      description: "Medical vitals sealed with Zama FHE before leaving your device",
      completed: input.hasProfile,
    },
    {
      id: "consent",
      label: "Consent granted",
      description: "Trial-scoped consent recorded on ConsentManager",
      completed: input.hasConsent,
    },
    {
      id: "proof",
      label: "Anonymous proof generated",
      description: "Semaphore membership proof — wallet not linked to application",
      completed: input.hasSemaphoreIdentity && input.hasApplied,
    },
    {
      id: "eligibility",
      label: "Eligibility finalized",
      description: "FHE gate completed via relayer public decrypt",
      completed: input.hasApplied,
    },
    {
      id: "accepted",
      label: "Sponsor accepted",
      description: "Blinded application visible in sponsor queue",
      completed: input.applicationAccepted,
    },
    {
      id: "claimed",
      label: "Reward claimed",
      description: "Confidential ETH withdrawn to your wallet",
      completed: input.rewardClaimed,
    },
  ];
}
