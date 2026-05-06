import { Link } from "react-router-dom";
import { ShieldCheck, Wallet, Lock, Bell, TrendingUp, Search, Clock, ArrowRight } from "lucide-react";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { useWeb3 } from "../lib/Web3Context";
import { useTrials } from "../hooks/useTrials";

function summarizeCompensation(compensation: string) {
  if (!compensation) return "N/A";
  return compensation;
}

export function PatientDashboard() {
  const { account, connect, isConnecting, error: connectError } = useWeb3();
  const { trials, loading } = useTrials(account || undefined);

  const discoverableTrials = trials.filter((trial) => !trial.isExpired);
  const appliedTrials = trials.filter((trial) => trial.applicationStatus !== null);
  const pendingResults = appliedTrials.filter((trial) => trial.applicationStatus === "Pending").length;
  const topTrials = discoverableTrials.slice(0, 3);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 md:px-8 lg:px-12 pb-20 space-y-10">
      <SectionTopBar
        title="Patient Overview"
        className="-mx-4 md:-mx-8 lg:-mx-12 px-4 md:px-8 lg:px-12"
        rightContent={
          <div className="flex items-center gap-3 md:gap-5">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Privacy Active</span>
            </div>
            {account ? (
              <div className="hidden md:flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 border border-slate-200">
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-mono text-xs text-slate-600">
                  {`${account.slice(0, 4)}...${account.slice(-4)}`}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void connect()}
                disabled={isConnecting}
                title={connectError ?? "Log in"}
                className="hidden md:inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 border border-teal-200 font-mono text-xs text-teal-800 hover:bg-teal-100 transition-colors disabled:opacity-60 disabled:pointer-events-none"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center shrink-0">
                  <Wallet className="h-3.5 w-3.5 text-white" />
                </div>
                {isConnecting ? "Connecting…" : "Log in"}
              </button>
            )}
            <button className="p-2 text-teal-700 hover:bg-slate-100 rounded-full transition-colors">
              <Lock className="h-4 w-4" />
            </button>
            <button className="relative p-2 text-teal-700 hover:bg-slate-100 rounded-full transition-colors">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Link to="/patient/applications" className="group">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 h-40 relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-28 h-28 bg-teal-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative flex flex-col justify-between h-full">
              <div>
                <p className="text-sm text-slate-500 mb-1">Active Applications</p>
                <h3 className="text-4xl font-bold text-slate-900">{appliedTrials.length}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                <TrendingUp className="h-4 w-4" />
                View Details
              </div>
            </div>
          </div>
        </Link>

        <Link to="/patient/find-trials" className="group">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 h-40 relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-28 h-28 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative flex flex-col justify-between h-full">
              <div>
                <p className="text-sm text-slate-500 mb-1">Eligible Trials</p>
                <h3 className="text-4xl font-bold text-slate-900">{discoverableTrials.length}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <Search className="h-4 w-4" />
                Explore Matches
              </div>
            </div>
          </div>
        </Link>

        <Link to="/patient/applications" className="group">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 h-40 relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 w-28 h-28 bg-violet-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
            <div className="relative flex flex-col justify-between h-full">
              <div>
                <p className="text-sm text-slate-500 mb-1">Pending Results</p>
                <h3 className="text-4xl font-bold text-slate-900">{pendingResults}</h3>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-violet-700">
                <Clock className="h-4 w-4" />
                Check Status
              </div>
            </div>
          </div>
        </Link>
      </section>

      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Browse Trials</h2>
            <p className="text-sm text-slate-500 mt-1">ZKP-verified clinical opportunities matched to your profile.</p>
          </div>
          <Link to="/patient/find-trials" className="text-sm font-semibold text-teal-700 hover:text-teal-600 flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading trials...</div>
        ) : topTrials.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No available trials yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {topTrials.map((trial) => (
              <div key={trial.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="h-10 w-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                    ZK Proof
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-xl font-bold text-slate-900 leading-tight">{trial.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sponsor: {trial.sponsor.name.startsWith("0x")
                      ? `${trial.sponsor.name.slice(0, 6)}...${trial.sponsor.name.slice(-4)}`
                      : trial.sponsor.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-lg p-3 mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Phase</p>
                    <p className="text-sm font-semibold text-slate-700">{trial.phase}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Compensation</p>
                    <p className="text-sm font-semibold text-slate-700">{summarizeCompensation(trial.compensation)}</p>
                  </div>
                </div>

                <Link
                  to="/patient/find-trials"
                  className="w-full inline-flex justify-center py-3 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Apply Anonymously
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
