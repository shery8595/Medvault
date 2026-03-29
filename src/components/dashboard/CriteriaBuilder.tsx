import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Sliders, User, Scale, Ruler, Cigarette, Heart, Activity } from "lucide-react";
import { cn } from "../../lib/utils";

export interface Criteria {
  minAge: number;
  maxAge: number;
  requiresDiabetes: boolean;
  minHb: number;
  genderRequirement: number; // 0=any, 1=Male, 2=Female
  minHeight: number;
  maxWeight: number;
  requiresNonSmoker: boolean;
  requiresNormalBP: boolean;
}

interface CriteriaBuilderProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
}

export function CriteriaBuilder({ criteria, onChange }: CriteriaBuilderProps) {
  const handleChange = (field: keyof Criteria, value: any) => {
    onChange({ ...criteria, [field]: value });
  };

  return (
    <Card className="border-white/5 bg-slate-950/40 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-[2rem]">
      <CardHeader className="border-b border-white/5 pb-5 px-8 pt-8">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-black text-white flex items-center gap-3 tracking-tight">
            <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
              <Sliders className="h-5 w-5 text-accent" />
            </div>
            Eligibility Protocol
          </CardTitle>
          <div className="rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-black text-accent uppercase tracking-[0.2em] border border-accent/20 shadow-[0_0_15px_rgba(var(--color-accent),0.1)]">
            FHE-Shielded Layer
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 md:p-10 space-y-10">
        {/* Biology Section */}
        <div className="space-y-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Biological Parameters</p>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Age</label>
              <input
                type="number"
                value={criteria.minAge}
                onChange={(e) => handleChange("minAge", parseInt(e.target.value))}
                className="w-full h-12 px-5 rounded-xl border border-white/5 bg-slate-950/60 text-white font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Age</label>
              <input
                type="number"
                value={criteria.maxAge}
                onChange={(e) => handleChange("maxAge", parseInt(e.target.value))}
                className="w-full h-12 px-5 rounded-xl border border-white/5 bg-slate-950/60 text-white font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gender Target</label>
            <div className="flex p-1.5 bg-[#020617] rounded-2xl border border-white/5">
              {[
                { id: 0, label: "Any" },
                { id: 1, label: "Male" },
                { id: 2, label: "Female" }
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleChange("genderRequirement", g.id)}
                  className={cn(
                    "flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    criteria.genderRequirement === g.id
                      ? "bg-accent text-white shadow-[0_0_15px_rgba(var(--color-accent),0.3)]"
                      : "text-slate-500 hover:text-white"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Height (CM)</label>
              <input
                type="number"
                value={criteria.minHeight}
                onChange={(e) => handleChange("minHeight", parseInt(e.target.value))}
                className="w-full h-12 px-5 rounded-xl border border-white/5 bg-slate-950/60 text-white font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Weight (KG)</label>
              <input
                type="number"
                value={criteria.maxWeight}
                onChange={(e) => handleChange("maxWeight", parseInt(e.target.value))}
                className="w-full h-12 px-5 rounded-xl border border-white/5 bg-slate-950/60 text-white font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Clinical Section */}
        <div className="space-y-6 pt-8 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Clinical Logic (Encrypted)</p>

          <div className="flex items-center justify-between p-6 rounded-2xl bg-[#020617] border border-white/5 hover:bg-slate-950/80 transition-all cursor-pointer group">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" /> Require Diabetes Diagnosis
              </h4>
              <p className="text-[11px] text-slate-500 font-medium tracking-tight">Filters for patients with confirmed diagnosis in Shielded Vault.</p>
            </div>
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={criteria.requiresDiabetes}
                onChange={(e) => handleChange("requiresDiabetes", e.target.checked)}
                className="peer absolute opacity-0 w-6 h-6 cursor-pointer"
              />
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-all duration-300",
                criteria.requiresDiabetes ? "bg-accent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" : "bg-slate-800"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                  criteria.requiresDiabetes ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Hemoglobin Level (mg/dL)</label>
            <input
              type="number"
              value={criteria.minHb}
              onChange={(e) => handleChange("minHb", parseInt(e.target.value))}
              className="w-full h-12 px-5 rounded-xl border border-white/5 bg-slate-950/60 text-white font-bold focus:ring-2 focus:ring-accent focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center justify-between p-6 rounded-2xl bg-[#020617] border border-white/5 hover:bg-slate-950/80 transition-all cursor-pointer group">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-500" /> Normal Blood Pressure
              </h4>
              <p className="text-[11px] text-slate-500 font-medium tracking-tight">Exclude patients with hypertension logic. Executed in enclave.</p>
            </div>
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={criteria.requiresNormalBP}
                onChange={(e) => handleChange("requiresNormalBP", e.target.checked)}
                className="peer absolute opacity-0 w-6 h-6 cursor-pointer"
              />
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-all duration-300",
                criteria.requiresNormalBP ? "bg-accent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" : "bg-slate-800"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                  criteria.requiresNormalBP ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
            </div>
          </div>
        </div>

        {/* Lifestyle Section */}
        <div className="space-y-6 pt-8 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Lifestyle Controls</p>

          <div className="flex items-center justify-between p-6 rounded-2xl bg-[#020617] border border-white/5 hover:bg-slate-950/80 transition-all cursor-pointer group">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cigarette className="h-4 w-4 text-amber-500" /> Non-Smoker Policy
              </h4>
              <p className="text-[11px] text-slate-500 font-medium tracking-tight">Only eligible if the patient is a non-smoker. Anonymous verification.</p>
            </div>
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={criteria.requiresNonSmoker}
                onChange={(e) => handleChange("requiresNonSmoker", e.target.checked)}
                className="peer absolute opacity-0 w-6 h-6 cursor-pointer"
              />
              <div className={cn(
                "w-12 h-6 rounded-full p-1 transition-all duration-300",
                criteria.requiresNonSmoker ? "bg-accent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" : "bg-slate-800"
              )}>
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full transition-transform duration-300",
                  criteria.requiresNonSmoker ? "translate-x-6" : "translate-x-0"
                )} />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
