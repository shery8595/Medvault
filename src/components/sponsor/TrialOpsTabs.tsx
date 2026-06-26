import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type TrialOpsTabId =
  | "overview"
  | "matches"
  | "milestones"
  | "rewards"
  | "compliance"
  | "automation";

const TABS: { id: TrialOpsTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "matches", label: "Matches" },
  { id: "milestones", label: "Milestones" },
  { id: "rewards", label: "Rewards" },
  { id: "compliance", label: "Compliance" },
  { id: "automation", label: "Automation" },
];

type Props = {
  activeTab: TrialOpsTabId;
  onTabChange: (tab: TrialOpsTabId) => void;
  children: (tab: TrialOpsTabId) => ReactNode;
  className?: string;
};

export function TrialOpsTabs({ activeTab, onTabChange, children, className }: Props) {
  const [visited, setVisited] = useState<Set<TrialOpsTabId>>(() => new Set([activeTab]));

  const select = (id: TrialOpsTabId) => {
    setVisited((prev) => new Set(prev).add(id));
    onTabChange(id);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div
        className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/90 bg-white p-1 shadow-sm"
        role="tablist"
        aria-label="Trial operations"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => select(tab.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
              activeTab === tab.id
                ? "bg-[#1D2634] text-white shadow-md"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{children(activeTab)}</div>
      {!visited.has("automation") && activeTab !== "automation" ? null : null}
    </div>
  );
}

export { TABS as TRIAL_OPS_TABS };
