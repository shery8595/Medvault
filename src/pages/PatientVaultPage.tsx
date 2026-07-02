import { motion, AnimatePresence } from "framer-motion";
import { useWeb3 } from "../lib/Web3Context";
import { PatientRecordForm } from "../components/dashboard/PatientRecordForm";
import React, { useState, useEffect, useRef } from "react";
import { Portal } from "../components/ui/Portal";
import { VaultCard } from "../components/dashboard/VaultCard";
import { PatientVaultHeader } from "../components/dashboard/PatientVaultHeader";
import { PatientVaultHero } from "../components/dashboard/PatientVaultHero";
import { VaultStatusStrip } from "../components/dashboard/VaultStatusStrip";
import { FinancialEnclaveSection } from "../components/dashboard/FinancialEnclaveSection";
import { VaultQuickActions } from "../components/dashboard/VaultQuickActions";
import { Button } from "../components/ui/Button";
import { usePatientProfile } from "../hooks/usePatientProfile";
import { getContractAddressForChain } from "../lib/contracts";
import { getSubgraphQueryPath } from "../lib/subgraph";
import { getStoredIdentity, isMemberRegistered } from "../lib/semaphore";
import {
  Plus,
  ShieldCheck,
  History,
  Sparkles,
  SearchX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { importFhirJson, type FhirImportIssue, type FhirMappedProfile } from "../lib/fhirImport";
import { SepoliaGasBanner } from "../components/ui/SepoliaGasBanner";
import { HybridDocumentUploader } from "../components/dashboard/HybridDocumentUploader";
import { useSearchParams } from "react-router-dom";

/* ─── Animation helpers ───────────────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as any, delay },
});

const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.4, delay },
});

export function PatientVaultPage() {
  const { account, provider, signer, isFHEReady, connect, isConnecting, error: connectError, chainId } = useWeb3();
  const [searchParams] = useSearchParams();
  const vaultTrialId = searchParams.get("trialId") ?? undefined;
  const [showUploadForm, setShowUploadForm] = useState(false);
  const {
    profile,
    loading,
    hasProfile,
    hasProfileFromGraph,
    error: profileError,
    refetch: refetchPatient,
  } = usePatientProfile(account || undefined);
  const [fhirPrefill, setFhirPrefill] = useState<FhirMappedProfile | null>(null);
  const [fhirIssues, setFhirIssues] = useState<FhirImportIssue[]>([]);
  const fhirInputRef = useRef<HTMLInputElement>(null);
  const [uploadNonce, setUploadNonce] = useState(0);
  // On-chain registration state (supplement subgraph — catches cases where the subgraph lags)
  const [onChainRegistered, setOnChainRegistered] = useState<boolean | null>(null);

  useEffect(() => {
    if (!provider) {
      console.debug("[PatientVault] provider unavailable; skipping on-chain registration check");
      return;
    }
    const identity = getStoredIdentity();
    if (!identity) {
      console.debug("[PatientVault] no local Semaphore identity found");
      setOnChainRegistered(false);
      return;
    }
    console.debug("[PatientVault] checking on-chain member registration", {
      account: account ?? null,
      commitment: identity.commitment.toString(),
    });
    isMemberRegistered(provider, identity.commitment)
      .then((registered) => {
        console.debug("[PatientVault] on-chain member registration result", {
          account: account ?? null,
          registered,
        });
        setOnChainRegistered(registered);
      })
      .catch((err) => {
        console.error("[PatientVault] on-chain member check failed", err);
        setOnChainRegistered(null);
      });
  }, [provider, account]);

  // Subgraph often lags the confirmed registerPatient tx; poll briefly while on-chain says "member" but Patient entity is missing.
  useEffect(() => {
    if (!account || onChainRegistered !== true || hasProfileFromGraph || loading) return;
    let cancelled = false;
    let n = 0;
    console.debug("[PatientVault] starting subgraph polling for patient profile", {
      account,
      onChainRegistered,
      hasProfileFromGraph,
    });
    const tick = async () => {
      if (cancelled || n >= 30) return;
      n += 1;
      console.debug("[PatientVault] subgraph poll attempt", { attempt: n, account });
      const data = await refetchPatient();
      if (!cancelled && data?.patient) {
        console.debug("[PatientVault] subgraph patient profile found", {
          attempt: n,
          patientId: data.patient.id,
        });
        return;
      }
      if (!cancelled) {
        console.debug("[PatientVault] subgraph patient still missing", { attempt: n });
      }
      if (!cancelled && n < 30) {
        setTimeout(tick, 4000);
      } else if (!cancelled) {
        console.warn("[PatientVault] polling stopped after max attempts without profile", {
          attempts: n,
          account,
        });
      }
    };
    const id = window.setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      console.debug("[PatientVault] stopped subgraph polling loop");
    };
  }, [account, onChainRegistered, hasProfileFromGraph, loading, refetchPatient]);

  const openManualUpload = () => {
    setUploadNonce((n) => n + 1);
    setFhirPrefill(null);
    setFhirIssues([]);
    setShowUploadForm(true);
  };

  const triggerFhirImport = () => {
    fhirInputRef.current?.click();
  };

  const onFhirFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadNonce((n) => n + 1);
    try {
      const text = await file.text();
      const res = importFhirJson(text);
      if (!res.ok) {
        setFhirPrefill(null);
        setFhirIssues(res.issues);
        setShowUploadForm(true);
        return;
      }
      setFhirPrefill(res.profile);
      setFhirIssues(res.issues);
      setShowUploadForm(true);
    } catch {
      setFhirIssues([{ path: "$", message: "Could not read that file — try exporting UTF-8 JSON from your EHR." }]);
      setShowUploadForm(true);
    }
  };

  const isRegistered = hasProfile || onChainRegistered === true;

  const subgraphQueryPath = getSubgraphQueryPath(import.meta.env.VITE_SUBGRAPH_URL as string | undefined);
  const medVaultRegistryAddress =
    chainId != null ? getContractAddressForChain("MedVaultRegistry", chainId) : getContractAddressForChain("MedVaultRegistry");

  useEffect(() => {
    console.debug("[PatientVault] render state", {
      account: account ?? null,
      loading,
      hasProfile,
      onChainRegistered,
      isRegistered,
      profileError: profileError?.message ?? null,
    });
  }, [account, loading, hasProfile, onChainRegistered, isRegistered, profileError]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 pb-24">
      <motion.div {...fadeIn(0)} className="space-y-6">
        <PatientVaultHeader
          account={account}
          connect={connect}
          isConnecting={isConnecting}
          connectError={connectError}
          onChainActive={Boolean(account && isRegistered)}
        />

        <SepoliaGasBanner />

        <PatientVaultHero
          account={account}
          isRegistered={isRegistered}
          connect={connect}
          isConnecting={isConnecting}
          connectError={connectError}
          onUpload={openManualUpload}
          onNewVisit={openManualUpload}
          onFhirImport={triggerFhirImport}
        />

        <input
          ref={fhirInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(ev) => void onFhirFile(ev)}
        />

        <VaultStatusStrip
          account={account}
          isRegistered={isRegistered}
          onUploadClick={account ? openManualUpload : undefined}
        />
      </motion.div>

      {/* ── Upload Modal Overlay ── */}
      <AnimatePresence>
        {showUploadForm && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl custom-scrollbar relative z-[110] space-y-4"
              >
                {fhirIssues.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
                    <p className="font-semibold mb-1">FHIR import notes</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
                      {fhirIssues.map((i) => (
                        <li key={`${i.path}-${i.message.slice(0, 40)}`}>{i.message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <PatientRecordForm
                  key={`vault-upload-${uploadNonce}`}
                  prefillProfile={fhirPrefill ?? undefined}
                  onSuccess={async () => {
                    setShowUploadForm(false);
                    setFhirPrefill(null);
                    setFhirIssues([]);
                    for (let i = 0; i < 20; i++) {
                      const fresh = await refetchPatient();
                      if (fresh?.patient) break;
                      await new Promise((r) => setTimeout(r, 3000));
                    }
                  }}
                  onCancel={() => {
                    setShowUploadForm(false);
                    setFhirPrefill(null);
                    setFhirIssues([]);
                  }}
                />
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      <motion.div {...fadeUp(0.1)}>
        <FinancialEnclaveSection />
      </motion.div>

      <motion.div {...fadeUp(0.15)}>
        <VaultQuickActions onUpload={openManualUpload} />
      </motion.div>

      {vaultTrialId ? (
        <motion.div {...fadeUp(0.17)} className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Hybrid document for trial #{vaultTrialId}</h3>
          <p className="text-xs text-slate-600">
            Encrypt a medical file locally, pin ciphertext to IPFS, and bind it to your anonymous application proof.
          </p>
          <HybridDocumentUploader trialId={vaultTrialId} />
        </motion.div>
      ) : null}

      {/* ── Vault Grid ── */}
      <div className="flex items-center justify-between px-2 mb-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-teal-600" />
            Medical Enclave
          </h2>
          <p className="text-sm text-slate-500">Your FHE-protected health records and diagnostic data.</p>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-2">
        {loading ? (
          <div className="col-span-full h-64 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-teal-600 animate-pulse" />
          </div>
        ) : profile ? (
          <motion.div {...fadeUp(0.2)}>
            <VaultCard
              signer={signer}
              account={account}
              isFHEReady={isFHEReady}
              report={{
              id: profile.id,
              patientAddress: account || "",
              age: 0,
              hasDiabetes: false,
              hbLevel: 0,
              timestamp: new Date(parseInt(profile.profileUpdatedAt, 10) * 1000).toLocaleString(),
              txHash: profile.profileTxHash
            }} />
          </motion.div>
        ) : isRegistered && !profile ? (
          /* On-chain Semaphore member via MedVaultRegistry, but Patient(wallet) missing in this subgraph deployment */
          <motion.div
            {...fadeUp(0.2)}
            className="col-span-full py-16 flex flex-col items-center justify-center gap-4 bg-teal-50 rounded-[2.5rem] border-2 border-teal-200 px-6 "
          >
            <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div className="text-center max-w-md">
              <h3 className="text-xl font-bold text-slate-900">Identity Registered</h3>
              <p className="text-slate-600 mx-auto mt-2 text-sm leading-relaxed">
                Your Semaphore commitment is registered on <strong>MedVaultRegistry</strong>, but the indexer returned{" "}
                <strong>no Patient</strong> for this wallet. That usually means either the subgraph deployment is behind or{" "}
                <code className="text-xs bg-white/80 px-1 rounded border border-teal-200">VITE_SUBGRAPH_URL</code> points at a different Studio version than
                the one where your <code className="text-xs bg-white/80 px-1 rounded border border-teal-200">patient(id: …)</code> query works. If you registered
                this identity from <em>another</em> wallet, connect that wallet — the subgraph keys Patient by transaction sender.
              </p>
              {subgraphQueryPath ? (
                <p className="text-slate-500 text-xs mt-3 font-mono break-all text-left max-w-xl mx-auto">
                  Active indexer path: <span className="text-teal-800">{subgraphQueryPath}</span>
                  {medVaultRegistryAddress ? (
                    <>
                      {" "}
                      · Expected registry: <span className="text-teal-800">{String(medVaultRegistryAddress).toLowerCase()}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {profileError ? (
                <p className="text-rose-600 text-xs mt-3 font-medium">{profileError.message}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="mt-4 border-teal-300 text-teal-800 hover:bg-teal-100"
                onClick={() => void refetchPatient()}
              >
                Refresh profile from indexer
              </Button>
            </div>
            <Sparkles className="h-5 w-5 text-teal-400 animate-pulse" />
          </motion.div>
        ) : account && (
          <motion.div
            {...fadeUp(0.2)}
            className="col-span-full py-20 flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-[2.5rem] border-2 border-dotted border-black/40"
          >
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <SearchX className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900">Vault is currently empty</h3>
              <p className="text-slate-500 max-w-xs mx-auto mt-2">Initialize your secure health record to start matching with clinical trials.</p>
            </div>
          </motion.div>
        )}

        {account && (
          <motion.button
            {...fadeUp(0.3)}
            onClick={openManualUpload}
            className="group flex flex-col items-center justify-center gap-4 p-8 rounded-[2rem] border-2 border-dotted border-black/40 hover:border-black/60 hover:bg-teal-50/40 transition-all min-h-[280px]"
          >
            <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all">
              <Plus className="h-8 w-8" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-900 mb-1">{profile ? "Add Additional Records" : "Upload First Record"}</p>
              <p className="text-xs text-slate-400 font-medium">Self-reported metrics, encrypted on your device</p>
            </div>
          </motion.button>
        )}
      </div>

      {/* ── Footer / Activity ── */}
      <motion.div
        {...fadeUp(0.5)}
        className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 text-slate-400">
          <History className="h-4 w-4" />
          <span className="text-sm font-medium">Security Status: <span className="text-emerald-500 font-bold">Active</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">FHE Protocol Active</span>
          </div>
          <Link to="/patient/find-trials" className="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
            Find Trials
          </Link>
          <Link to="/patient/identity" className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            Identity & Privacy
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
