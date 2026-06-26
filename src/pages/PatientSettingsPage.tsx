import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  ShieldCheck,
  Fingerprint,
  Database,
  LogOut,
  Globe,
  Bell,
  ExternalLink,
} from "lucide-react";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { SettingsRow } from "../components/settings/SettingsRow";
import { useWeb3 } from "../lib/Web3Context";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { getConsentManager } from "../lib/contracts";
import { chainDisplayName, ETH_SEPOLIA_EXPLORER } from "../lib/network";
import { ConsentRightsCenter } from "../components/privacy/ConsentRightsCenter";
import { useConsent } from "../hooks/useConsent";

const cardShell =
  "rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.05)]";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export function PatientSettingsPage() {
  const navigate = useNavigate();
  const { account, connect, isConnecting, error: connectError, logout, chainId, signer } = useWeb3();
  const { hasProfile, loading: profileLoading } = usePatientProfile(account || undefined);
  const { consents, refetch: refetchConsent } = useConsent(account || undefined);

  const networkLabel = chainDisplayName(chainId);

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <SectionTopBar title="Settings" />

      <motion.div {...fadeUp}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">Patient console</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-slate-900">Account & preferences</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Manage your wallet connection, privacy tools, and vault access from one place.
        </p>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }}>
        <div className={`${cardShell} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">Connected wallet</h2>
          </div>
          <div className="space-y-4 p-5">
            {account ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 text-white shadow-sm">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-slate-800 break-all">{account}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{networkLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Vault profile</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {profileLoading ? "Checking…" : hasProfile ? "Registered" : "Not registered"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Privacy</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Active
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">Connect a wallet to manage your encrypted health profile and trial applications.</p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
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
        <div className={`${cardShell} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">Privacy & data</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingsRow
              to="/patient/medical-vault"
              icon={Database}
              label="Medical vault"
              description="Upload, import FHIR, and manage your encrypted health record."
            />
            <SettingsRow
              to="/patient/identity"
              icon={Fingerprint}
              label="Identity & privacy"
              description="Download or restore Semaphore identity backup, ephemeral address."
            />
            <SettingsRow
              to="/patient/consent-logs"
              icon={ShieldCheck}
              label="Consent logs"
              description="Review sponsor access grants and revocations."
            />
          </div>
        </div>
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.12 }}>
        <ConsentRightsCenter
          account={account}
          onRevokeAll={
            signer
              ? async () => {
                  const cm = getConsentManager(signer);
                  const tx = await cm.revokeAllConsent();
                  await tx.wait();
                  await refetchConsent();
                }
              : undefined
          }
          onExportLog={() => {
            const blob = new Blob([JSON.stringify(consents, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "medvault-consent-log.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        />
      </motion.div>

      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <div className={`${cardShell} overflow-hidden`}>
          <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">Support & network</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <SettingsRow
              to="/docs/security-model"
              icon={Globe}
              label="Security model"
              description="How MedVault handles encryption, consent, and zero-knowledge proofs."
            />
            <SettingsRow
              to={`${ETH_SEPOLIA_EXPLORER}/address/${account}`}
              icon={ExternalLink}
              label="Etherscan (Sepolia)"
              description="Inspect transactions and contract interactions on testnet."
              external
            />
            <div className="flex items-start gap-4 px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
                <Bell className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Application notifications</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Status updates appear in My Applications and on your dashboard. On-chain events sync from the subgraph.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {account ? (
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}>
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
