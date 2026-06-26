import React, { useState } from "react";
import { MedicalReport } from "../../types";
import { ethers } from "ethers";
import { getStoredIdentity } from "../../lib/semaphore";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Activity,
  Fingerprint,
  Clock,
  Hash,
  ExternalLink,
  Cpu,
  Loader2,
  User,
  Heart,
  Scale,
  Ruler,
  Cigarette,
  Droplet,
} from "lucide-react";
import { useWeb3 } from "../../lib/Web3Context";
import { getAnonymousPatientRegistry } from "../../lib/contracts";
import { decryptPatientProfileWithEphemeral, EncryptedPatientData, DecryptedPatientData } from "../../lib/fhe";
import { txExplorerUrl } from "../../lib/network";

interface VaultCardProps {
  report: MedicalReport;
  signer?: Signer | null;
  account?: string | null;
  isFHEReady?: boolean;
}

const EncryptedField: React.FC<{ label: string; delay?: number }> = ({ label, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, delay }}
    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200"
  >
    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
    <div className="flex items-center gap-1.5">
      <Lock className="h-2.5 w-2.5 text-teal-600/80" />
      <span className="text-[10px] font-mono text-teal-700/90 tracking-tight">FHE-SEALED</span>
    </div>
  </motion.div>
);

/** On-chain: ebool gender — true = Male, false = Female (see AnonymousPatientRegistry). */
function formatDecryptedValue(
  value: string | number | boolean,
  type: "number" | "boolean" | "gender"
): string | number {
  if (type === "gender") return value ? "Male" : "Female";
  if (type === "boolean") return value ? "Yes" : "No";
  return value as string | number;
}

const DecryptedField: React.FC<{ 
  label: string; 
  value: string | number | boolean; 
  icon: React.ReactNode;
  delay?: number;
  type?: "number" | "boolean" | "gender";
}> = ({ label, value, icon, delay = 0, type = "number" }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay }}
    className="flex items-center justify-between py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200"
  >
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-emerald-100">
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">{label}</span>
    </div>
    <span className="text-sm font-bold text-emerald-900">
      {formatDecryptedValue(value, type)}
    </span>
  </motion.div>
);

export const VaultCard: React.FC<VaultCardProps> = ({ report }) => {
  const { signer, account, provider } = useWeb3();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedPatientData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shortTx = report.txHash
    ? `${report.txHash.slice(0, 6)}…${report.txHash.slice(-4)}`
    : "—";
  const etherscanUrl = report.txHash ? txExplorerUrl(report.txHash) : "#";

  const handleViewClick = async () => {
    if (!signer || !account || !provider) return;

    if (decryptedData) {
      setDecryptedData(null);
      setError(null);
      return;
    }

    setIsDecrypting(true);
    setError(null);
    
    try {
      // Load Semaphore identity from localStorage
      const identity = getStoredIdentity();
      if (!identity) {
        throw new Error("No local anonymous identity found for decrypting this vault.");
      }
      const commitment = identity.commitment;

      // Re-derive the ephemeral private key from the identity secret.
      // This is the SAME derivation used during registration, so the resulting
      // address is what AnonymousPatientRegistry called FHE.allow() with.
      // NEVER touches the wallet — no on-chain linkage.
      const identitySecret = identity.secretScalar.toString();
      const ephemeralPrivateKey = ethers.keccak256(
        ethers.toUtf8Bytes(`medvault:ephemeral:${identitySecret}`)
      );
      const ephemeralWallet = new ethers.Wallet(ephemeralPrivateKey, provider);

      const registry = getAnonymousPatientRegistry(signer);
      const aprAddress = await registry.getAddress();
      const encryptedPatient = await registry.getPatientProfile(commitment);

      const encryptedData: EncryptedPatientData = {
        age: encryptedPatient.age,
        gender: encryptedPatient.gender,
        weight: encryptedPatient.weight,
        height: encryptedPatient.height,
        hasDiabetes: encryptedPatient.hasDiabetes,
        hbLevel: encryptedPatient.hbLevel,
        isSmoker: encryptedPatient.isSmoker,
        hasHypertension: encryptedPatient.hasHypertension,
      };

      const decrypted = await decryptPatientProfileWithEphemeral(
        ephemeralWallet,
        encryptedData,
        aprAddress
      );
      setDecryptedData(decrypted);
    } catch (err: any) {
      console.error("Failed to decrypt profile:", err);
      setError(err.message || "Failed to decrypt profile data");
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    className="group relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl"
    >
      {/* ── Animated background decorations ── */}
      <div className="absolute top-0 right-0 h-72 w-72 -translate-y-1/3 translate-x-1/4 rounded-full bg-teal-100/70 blur-[90px] pointer-events-none transition-all group-hover:bg-teal-100" />
      <div className="absolute bottom-0 left-0 h-56 w-56 translate-y-1/3 -translate-x-1/4 rounded-full bg-emerald-100/60 blur-[80px] pointer-events-none transition-all group-hover:bg-emerald-100/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(20,184,166,0.06),transparent_60%)] pointer-events-none" />

      <div className="relative z-10 p-7">
        <div className="flex items-start justify-between mb-7">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 backdrop-blur-sm">
                <Fingerprint className="h-7 w-7 text-teal-700" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.45)]"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Encrypted Health Record</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">FHE-Protected Medical Data</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Secured</span>
          </div>
        </div>

        {/* ── Encrypted Fields Grid ── */}
        <AnimatePresence mode="wait">
          {decryptedData ? (
            <motion.div
              key="decrypted-grid"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="grid grid-cols-2 gap-2 mb-6"
            >
              <DecryptedField
                label="Age"
                value={decryptedData.age}
                icon={<User className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.05}
              />
              <DecryptedField
                label="Gender"
                value={decryptedData.gender}
                icon={<User className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.1}
                type="gender"
              />
              <DecryptedField
                label="Weight (kg)"
                value={decryptedData.weight}
                icon={<Scale className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.15}
              />
              <DecryptedField
                label="Height (cm)"
                value={decryptedData.height}
                icon={<Ruler className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.2}
              />
              <DecryptedField
                label="Diabetes"
                value={decryptedData.hasDiabetes}
                icon={<Heart className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.25}
                type="boolean"
              />
              <DecryptedField
                label="HB Level"
                value={decryptedData.hbLevel}
                icon={<Droplet className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.3}
              />
              <DecryptedField
                label="Smoker"
                value={decryptedData.isSmoker}
                icon={<Cigarette className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.35}
                type="boolean"
              />
              <DecryptedField
                label="Hypertension"
                value={decryptedData.hasHypertension}
                icon={<Activity className="h-3.5 w-3.5 text-emerald-600" />}
                delay={0.4}
                type="boolean"
              />
            </motion.div>
          ) : (
            <motion.div
              key="encrypted-grid"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="grid grid-cols-2 gap-2 mb-6"
            >
              <EncryptedField label="Age" delay={0.1} />
              <EncryptedField label="Gender" delay={0.15} />
              <EncryptedField label="Weight" delay={0.2} />
              <EncryptedField label="Height" delay={0.25} />
              <EncryptedField label="Diabetes" delay={0.3} />
              <EncryptedField label="HB Level" delay={0.35} />
              <EncryptedField label="Smoker" delay={0.4} />
              <EncryptedField label="Blood Pressure" delay={0.45} />
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {/* ── Security Pulse Bar ── */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50">
              <Cpu className="h-3.5 w-3.5 text-teal-700" />
            </div>
            <span className="text-xs font-semibold text-slate-700">Security Pulse</span>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.3], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.1, ease: "easeInOut" }}
                className="w-[3px] h-4 rounded-full bg-teal-500"
              />
            ))}
          </div>
        </div>

        {/* ── Metadata Footer ── */}
        <div className="flex items-center justify-between pt-5 border-t border-slate-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-3 w-3" />
              <span className="text-[11px] font-medium">{report.timestamp || "—"}</span>
            </div>
            <a
              href={etherscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-500 hover:text-teal-700 transition-colors group/link"
            >
              <Hash className="h-3 w-3" />
              <span className="text-[11px] font-mono">{shortTx}</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
            </a>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleViewClick}
              disabled={isDecrypting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDecrypting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : decryptedData ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )} 
              {isDecrypting ? "Decrypting..." : decryptedData ? "Hide" : "View"}
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 bg-slate-50 hover:text-teal-700 hover:border-teal-200 hover:bg-teal-50 transition-all">
              <Activity className="h-3.5 w-3.5" /> Audit
            </button>
          </div>
        </div>
      </div>

    </motion.div>
  );
};
