import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wallet,
  Copy,
  Check,
  Download,
  Upload,
  AlertTriangle,
  UserCheck,
  Lock,
  ArrowLeftRight,
  Fingerprint,
  FileJson,
} from "lucide-react";
import { motion } from "framer-motion";
import { SectionTopBar } from "../components/layout/SectionTopBar";
import { Button } from "../components/ui/Button";
import { Link } from "react-router-dom";
import { useWeb3 } from "../lib/Web3Context";
import { PatientConnectPrompt } from "../components/dashboard/PatientConnectPrompt";
import { cn } from "../lib/utils";
import {
  getStoredIdentity,
  generateEphemeralAddress,
  parseIdentityBackupPayload,
  restoreIdentityFromBackup,
} from "../lib/semaphore";
import { WalletSendCard } from "../components/identity/WalletSendCard";
import { PrivacyTimeline, buildDefaultPrivacyTimeline } from "../components/privacy/PrivacyTimeline";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { useConsent } from "../hooks/useConsent";

const NULLIFIERS_KEY = "medvault_anon_nullifiers";

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 5)}…${addr.slice(-4)}`;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

export function PatientIdentityPage() {
  const { account } = useWeb3();
  const { hasProfile } = usePatientProfile(account || undefined);
  const { consents, applications } = useConsent(account || undefined);
  const [ephemeralAddress, setEphemeralAddress] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshIdentityState = useCallback(async () => {
    const id = getStoredIdentity();
    setHasIdentity(!!id);
    if (!id) {
      setEphemeralAddress(null);
      return;
    }
    const addr = await generateEphemeralAddress(id);
    setEphemeralAddress(addr);
  }, []);

  useEffect(() => {
    void refreshIdentityState();
  }, [refreshIdentityState]);

  const copyEphemeral = useCallback(async () => {
    if (!ephemeralAddress) return;
    try {
      await navigator.clipboard.writeText(ephemeralAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [ephemeralAddress]);

  const downloadBackup = useCallback(() => {
    const identity = getStoredIdentity();
    if (!identity) return;
    setExporting(true);
    try {
      let nullifiers: Record<string, string> | undefined;
      try {
        const raw = localStorage.getItem(NULLIFIERS_KEY);
        if (raw) nullifiers = JSON.parse(raw) as Record<string, string>;
      } catch {
        nullifiers = undefined;
      }

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        identity: identity.export(),
        ...(nullifiers && Object.keys(nullifiers).length > 0 ? { anonymousNullifiers: nullifiers } : {}),
        note:
          "MedVault Semaphore identity backup. Store offline — anyone with this file can impersonate your anonymous trial presence.",
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medvault-identity-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, []);

  const restoreFromBackupFile = useCallback(
    async (file: File) => {
      setRestoreMessage(null);
      setRestoreError(null);

      if (hasIdentity) {
        const ok = window.confirm(
          "Restoring will replace the Semaphore identity in this browser. Continue only if this backup belongs to you."
        );
        if (!ok) return;
      }

      setImporting(true);
      try {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        const backup = parseIdentityBackupPayload(parsed);
        restoreIdentityFromBackup(backup, { mergeNullifiers: hasIdentity });
        await refreshIdentityState();
        const nullifierCount = backup.anonymousNullifiers
          ? Object.keys(backup.anonymousNullifiers).length
          : 0;
        setRestoreMessage(
          nullifierCount > 0
            ? `Identity restored (${nullifierCount} trial nullifier${nullifierCount === 1 ? "" : "s"}).`
            : "Identity restored."
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Could not read backup file.";
        setRestoreError(msg);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [hasIdentity, refreshIdentityState]
  );

  const onBackupFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void restoreFromBackupFile(file);
    },
    [restoreFromBackupFile]
  );

  const privacyLayers = [
    {
      title: "Semaphore identity",
      body: "Proves you are a verified participant in the trial group without revealing which specific member you are.",
      icon: UserCheck,
      circle: "bg-teal-100 text-teal-700",
    },
    {
      title: "Zama FHE data",
      body: "Fully homomorphic encryption lets researchers compute on your clinical signals while data stays ciphertext on-chain.",
      icon: Lock,
      circle: "bg-violet-100 text-violet-700",
    },
    {
      title: "Relayer transactions",
      body: "Sensitive calls can be routed through relayers so your wallet IP and timing are harder to correlate with trial actions.",
      icon: ArrowLeftRight,
      circle: "bg-orange-100 text-orange-700",
    },
  ];

  if (!account) {
    return (
      <div className="mx-auto max-w-6xl space-y-8 pb-16">
        <SectionTopBar
          title="Identity & Privacy Controls"
          rightContent={
            <Link
              to="/patient/medical-vault"
              className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800 transition-colors"
            >
              Medical Vault
            </Link>
          }
        />
        <p className="-mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Manage your zero-knowledge proofs and secure data enclaves.
        </p>
        <PatientConnectPrompt
          title="Connect to manage identity & privacy"
          description="Ephemeral keys, Semaphore backup, and clinical privacy controls are available after you connect the wallet tied to your vault."
          showBrowseTrials={false}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <SectionTopBar
        title="Identity & Privacy Controls"
        rightContent={
          <Link
            to="/patient/medical-vault"
            className="text-xs font-bold uppercase tracking-widest text-teal-700 hover:text-teal-800 transition-colors"
          >
            Medical Vault
          </Link>
        }
      />

      <motion.p {...fadeUp(0)} className="-mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
        Manage your zero-knowledge proofs and secure data enclaves.
      </motion.p>

      <motion.div {...fadeUp(0.04)}>
        <PrivacyTimeline
          events={buildDefaultPrivacyTimeline({
            hasProfile: Boolean(hasProfile),
            hasConsent: consents.length > 0,
            hasSemaphoreIdentity: hasIdentity,
            hasApplied: applications.length > 0,
            applicationAccepted: applications.some((a: { status?: string }) => a.status === "Accepted"),
            rewardClaimed: false,
          })}
        />
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left column */}
        <div className="lg:col-span-5 space-y-6">
          <motion.section
            {...fadeUp(0.05)}
            className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)] overflow-hidden border-t-4 border-t-teal-500"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 border border-violet-200/80">
                  <Wallet className="h-5 w-5 text-violet-700" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Ephemeral wallet</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your temporary address for FHE permits and trial-facing cryptography. Deterministic from your Semaphore
                identity — not your connected wallet address.
              </p>
              {hasIdentity && ephemeralAddress ? (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <code
                    className="flex-1 text-sm font-mono text-slate-800 truncate"
                    title={ephemeralAddress}
                  >
                    {shortAddr(ephemeralAddress)}
                  </code>
                  <button
                    type="button"
                    onClick={copyEphemeral}
                    className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition-colors"
                    aria-label="Copy full address"
                  >
                    {copied ? <Check className="h-4 w-4 text-teal-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                  No local identity yet.{" "}
                  <Link className="font-semibold text-teal-700 hover:underline" to="/patient/medical-vault">
                    Complete Medical Vault registration
                  </Link>{" "}
                  to create your Semaphore identity and ephemeral keys.
                </div>
              )}
            </div>
          </motion.section>

          <motion.section
            {...fadeUp(0.1)}
            className="rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
                  <FileJson className="h-5 w-5 text-slate-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Identity backup</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  disabled={!hasIdentity || exporting}
                  onClick={downloadBackup}
                  className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold h-12 gap-2 shadow-md border-0"
                >
                  {exporting ? (
                    "Preparing…"
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> Download backup
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 rounded-xl h-12 gap-2 border-slate-200 font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {importing ? (
                    "Restoring…"
                  ) : (
                    <>
                      <Upload className="h-4 w-4" /> Restore from backup
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  aria-hidden
                  onChange={onBackupFileSelected}
                />
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use the same JSON file you downloaded here — includes your Semaphore secret and optional trial
                nullifiers for anonymous applications.
              </p>
              {restoreMessage ? (
                <p className="text-sm font-medium text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                  {restoreMessage}
                </p>
              ) : null}
              {restoreError ? (
                <p className="text-sm font-medium text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {restoreError}
                </p>
              ) : null}
              <div className="rounded-xl border border-rose-100 bg-rose-50/90 px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-bold">Critical warning</span>
                </div>
                <p className="text-xs sm:text-sm text-rose-900/90 leading-relaxed pl-0">
                  Store this backup in a secure offline location. Losing it without another copy can mean permanent loss
                  of access to your anonymous trial presence for this browser profile.
                </p>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Right column */}
        <div className="lg:col-span-7 space-y-4">
          <motion.div {...fadeUp(0.08)}>
            <WalletSendCard />
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="flex items-center gap-2 text-slate-900">
            <Fingerprint className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-bold tracking-tight sm:text-lg">Clinical privacy layers</h2>
          </motion.div>

          <div className="space-y-4">
            {privacyLayers.map((layer, i) => (
              <motion.div
                key={layer.title}
                {...fadeUp(0.14 + i * 0.05)}
                className="flex gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                    layer.circle
                  )}
                >
                  <layer.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">{layer.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">{layer.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
