import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  User,
  Save,
  Loader2,
  CheckCircle2,
  Shield,
  Activity,
  Users,
  Database,
  ShieldCheck,
  ClipboardCheck,
  LogOut,
  Globe,
  ExternalLink,
} from "lucide-react";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { SettingsRow } from "../components/settings/SettingsRow";
import { useWeb3 } from "../lib/Web3Context";
import { useSponsorProfile } from "../hooks/useSponsorProfile";
import { useSponsorVerification } from "../hooks/useSponsorVerification";
import { sponsorCardHeader, sponsorCardShell } from "../lib/sponsorUi";
import { cn } from "../lib/utils";
import { chainDisplayName, ETH_SEPOLIA_EXPLORER } from "../lib/network";

const sponsorIcon = "bg-[#1D2634]/10 text-[#1D2634] ring-[#1D2634]/15";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function SponsorSettingsPage() {
  const navigate = useNavigate();
  const { account, connect, isConnecting, error: connectError, logout, chainId } = useWeb3();
  const { isVerified, isLoading: verifyLoading } = useSponsorVerification();
  const [name, setName] = useState("");
  const { currentName, loadingCurrentName, isSaving, success, error, updateSponsorName } = useSponsorProfile();

  useEffect(() => {
    if (currentName !== null) {
      setName(currentName);
    }
  }, [currentName]);

  const networkLabel = chainDisplayName(chainId);

  const handleSave = async () => {
    await updateSponsorName(name);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <SectionTopBar
        title="Profile settings"
        rightContent={
          <Link
            to="/sponsor/verification"
            className="text-xs font-semibold text-[#1D2634] hover:underline"
          >
            Verification
          </Link>
        }
      />

      <motion.div {...fadeUp}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1D2634]">Sponsor console</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Account & organization
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Manage your wallet, on-chain sponsor display name, and shortcuts across the sponsor portal.
        </p>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <div className={cn(sponsorCardShell, "overflow-hidden")}>
          <div className={cn(sponsorCardHeader, "px-5 py-4")}>
            <h2 className="font-display text-sm font-semibold text-slate-900">Connected wallet</h2>
          </div>
          <div className="space-y-4 p-5">
            {account ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1D2634] text-white shadow-sm">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-slate-800 break-all">{account}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{networkLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Registry</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {verifyLoading ? "Checking…" : isVerified ? "Verified" : "Not verified"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Display name</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {loadingCurrentName ? "…" : currentName || "Not set"}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Connect a wallet to manage sponsor profile and trials.</p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1D2634] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2a3545] disabled:opacity-60"
                >
                  <Wallet className="h-4 w-4" />
                  {isConnecting ? "Connecting…" : "Log in"}
                </button>
                {connectError ? <p className="text-xs text-rose-600">{connectError}</p> : null}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}>
        <div className={cn(sponsorCardShell, "overflow-hidden")}>
          <div className={cn(sponsorCardHeader, "px-5 py-4")}>
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${sponsorIcon}`}>
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900">Professional identity</h2>
                <p className="text-xs text-slate-500">On-chain name shown on your trials</p>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <label htmlFor="sponsor-name" className="text-sm font-semibold text-slate-700">
                Organization name
              </label>
              <input
                id="sponsor-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Clinical Research"
                disabled={isSaving || !account}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium outline-none transition focus:border-[#1D2634] focus:ring-2 focus:ring-[#1D2634]/15 disabled:opacity-60"
              />
            </div>

            {error ? <p className="text-xs text-rose-600">{error}</p> : null}

            {currentName ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Registered as <strong className="ml-1">{currentName}</strong>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !name.trim() || name.trim() === currentName || !account}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D2634] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2a3545] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving on-chain…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save professional name
                </>
              )}
            </button>

            {success ? (
              <p className="text-center text-xs font-medium text-emerald-600">
                Name updated on TrialManager.
              </p>
            ) : null}

            <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              Stored on-chain via <code className="rounded bg-white px-1">setSponsorName</code>. Gas applies on Ethereum
              Sepolia.
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <div className={cn(sponsorCardShell, "overflow-hidden")}>
          <div className={cn(sponsorCardHeader, "px-5 py-4")}>
            <h2 className="font-display text-sm font-semibold text-slate-900">Portal shortcuts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingsRow
              to="/sponsor/active-trials"
              icon={Activity}
              label="Active protocols"
              description="View trials, incentive pools, and phased payouts."
              iconClassName={sponsorIcon}
            />
            <SettingsRow
              to="/sponsor/patient-matches"
              icon={Users}
              label="Patient matches"
              description="Review candidates and enrollment decisions."
              iconClassName={sponsorIcon}
            />
            <SettingsRow
              to="/sponsor/analytics"
              icon={Database}
              label="Analytics"
              description="Recruitment funnel, weekly activity, and portfolio metrics."
              iconClassName={sponsorIcon}
            />
            <SettingsRow
              to="/sponsor/audit-logs"
              icon={ShieldCheck}
              label="Audit logs"
              description="Immutable access and compliance trail."
              iconClassName={sponsorIcon}
            />
            <SettingsRow
              to="/sponsor/verification"
              icon={ClipboardCheck}
              label="Sponsor verification"
              description="Registry allowlist status and application."
              iconClassName={sponsorIcon}
            />
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
        <div className={cn(sponsorCardShell, "overflow-hidden")}>
          <div className={cn(sponsorCardHeader, "px-5 py-4")}>
            <h2 className="font-display text-sm font-semibold text-slate-900">Support & network</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingsRow
              to="/docs/sponsor-system"
              icon={Globe}
              label="Sponsor system docs"
              description="Allowlist flow, trial creation, and incentive vault."
              iconClassName={sponsorIcon}
            />
            <SettingsRow
              to={account ? `${ETH_SEPOLIA_EXPLORER}/address/${account}` : ETH_SEPOLIA_EXPLORER}
              icon={ExternalLink}
              label="Etherscan (Sepolia)"
              description="Inspect transactions and contract calls."
              external
              iconClassName={sponsorIcon}
            />
          </div>
        </div>
      </motion.div>

      {account ? (
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.25 }}>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await logout();
                navigate("/");
              })();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </motion.div>
      ) : null}
    </div>
  );
}
