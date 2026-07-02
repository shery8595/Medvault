import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { OwnershipTransfer } from "../components/ui/OwnershipTransfer";
import {
    ShieldCheck,
    UserPlus,
    UserMinus,
    ShieldAlert,
    Loader2,
    CheckCircle2,
    XCircle,
    Copy,
    ExternalLink,
    FileText,
    Mail,
    User,
    ClipboardCheck,
    Building,
    Coins,
    RefreshCw,
} from "lucide-react";
import { useWeb3 } from "../lib/Web3Context";
import { getSponsorRegistry, getTrialManager } from "../lib/contracts";
import {
    claimReclaimedPool,
    getTrialPoolReclaimStatus,
    reclaimAbandonedToOwnerPool,
    type TrialPoolReclaimStatus,
} from "../lib/contracts/sponsorAdapters";
import { motion, AnimatePresence } from "framer-motion";
import { useSubgraph } from "../hooks/useSubgraph";
import { ethers } from "ethers";

const GET_PENDING_APPLICATIONS = `
  query GetPendingRequests {
    sponsorshipRequests(where: { status: "Pending" }, orderBy: requestedAt, orderDirection: desc) {
      id
      encryptedData
      requestedAt
    }
  }
`;

export default function AdminSponsorsPage() {
    const { signer, account } = useWeb3();
    const [sponsorAddress, setSponsorAddress] = useState("");
    const [sponsorName, setSponsorName] = useState("");
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [pendingOwner, setPendingOwner] = useState<string | null>(null);
    const [abandonedTrialId, setAbandonedTrialId] = useState("");
    const [abandonedStatus, setAbandonedStatus] = useState<TrialPoolReclaimStatus | null>(null);
    const [abandonedLoading, setAbandonedLoading] = useState(false);
    const [abandonedMessage, setAbandonedMessage] = useState<string | null>(null);
    
    // Application States
    const [applicantData, setApplicantData] = useState({
        researcher: "",
        email: "",
        mission: ""
    });

    const { data: subgraphData, refetch: refetchRequests } = useSubgraph(GET_PENDING_APPLICATIONS);
    const [decodedApplications, setDecodedApplications] = useState<any[]>([]);

    useEffect(() => {
        const checkSubmission = async () => {
            if (account && signer) {
                try {
                    const registry = getSponsorRegistry(signer);
                    const request = await registry.requests(account);
                    if (request.status !== 0) { // Not "None"
                        setIsSubmitted(true);
                    }
                } catch (e) {
                    console.error("Error checking submission status", e);
                }
            }
        };
        checkSubmission();
    }, [account, signer]);

    useEffect(() => {
        const checkOwner = async () => {
            if (signer && account) {
                try {
                    const registry = getSponsorRegistry(signer);
                    const owner = await registry.owner();
                    setIsOwner(owner.toLowerCase() === account.toLowerCase());
                    
                    // FINDING 11: Fetch pending owner for two-step ownership transfer
                    const pending = await registry.pendingOwner();
                    setPendingOwner(pending !== ethers.ZeroAddress ? pending : null);
                } catch (err) {
                    console.error("Error checking owner:", err);
                }
            }
        };
        checkOwner();
    }, [signer, account]);

    const refreshAbandonedStatus = async () => {
        if (!signer || !abandonedTrialId.trim()) {
            setAbandonedStatus(null);
            return;
        }
        setAbandonedLoading(true);
        setAbandonedMessage(null);
        try {
            const tm = getTrialManager(signer);
            const trial = await tm.getTrial(BigInt(abandonedTrialId.trim()));
            const reclaim = await getTrialPoolReclaimStatus(
                signer,
                abandonedTrialId.trim(),
                Number(trial.endTime)
            );
            setAbandonedStatus(reclaim);
        } catch (err: unknown) {
            console.error(err);
            setAbandonedStatus(null);
            const msg =
                err && typeof err === "object" && "message" in err
                    ? String((err as { message: string }).message)
                    : "Failed to load trial reclaim status";
            setAbandonedMessage(`Error: ${msg}`);
        } finally {
            setAbandonedLoading(false);
        }
    };

    const handleScheduleAbandonedReclaim = async () => {
        if (!signer || !abandonedTrialId.trim()) return;
        setAbandonedLoading(true);
        setAbandonedMessage("Scheduling abandoned pool reclaim to protocol owner...");
        try {
            await reclaimAbandonedToOwnerPool(signer, abandonedTrialId.trim());
            setAbandonedMessage("Reclaim scheduled. Claim ETH in the next step.");
            await refreshAbandonedStatus();
        } catch (err: unknown) {
            const msg =
                err && typeof err === "object" && "reason" in err
                    ? String((err as { reason: string }).reason)
                    : err && typeof err === "object" && "message" in err
                      ? String((err as { message: string }).message)
                      : "Schedule failed";
            setAbandonedMessage(`Error: ${msg}`);
        } finally {
            setAbandonedLoading(false);
        }
    };

    const handleClaimAbandonedReclaim = async () => {
        if (!signer || !abandonedTrialId.trim()) return;
        setAbandonedLoading(true);
        setAbandonedMessage("Claiming scheduled reclaim to owner wallet...");
        try {
            await claimReclaimedPool(signer, abandonedTrialId.trim());
            setAbandonedMessage("Success! Reclaimed ETH sent to the owner wallet.");
            await refreshAbandonedStatus();
        } catch (err: unknown) {
            const msg =
                err && typeof err === "object" && "reason" in err
                    ? String((err as { reason: string }).reason)
                    : err && typeof err === "object" && "message" in err
                      ? String((err as { message: string }).message)
                      : "Claim failed";
            setAbandonedMessage(`Error: ${msg}`);
        } finally {
            setAbandonedLoading(false);
        }
    };

    const canClaimAbandonedPending =
        Boolean(account) &&
        abandonedStatus?.pendingReclaimEth != null &&
        parseFloat(abandonedStatus.pendingReclaimEth) > 0 &&
        abandonedStatus.pendingReclaimRecipient?.toLowerCase() === account.toLowerCase();

    const handleAddSponsor = async () => {
        if (!signer || !sponsorAddress || !sponsorName) return;
        setLoading(true);
        setStatus("Approving sponsor on network...");
        try {
            const registry = getSponsorRegistry(signer);
            const tx = await registry.addSponsor(sponsorAddress, sponsorName);
            setStatus("Waiting for confirmation...");
            await tx.wait();
            refetchRequests();
            
            setStatus("Success! Sponsor verified.");
            setSponsorAddress("");
            setSponsorName("");
        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.reason || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSponsor = async () => {
        if (!signer || !sponsorAddress) return;
        setLoading(true);
        setStatus("Revoking sponsor privileges...");
        try {
            const registry = getSponsorRegistry(signer);
            const tx = await registry.removeSponsor(sponsorAddress);
            setStatus("Waiting for confirmation...");
            await tx.wait();
            setStatus("Success! Sponsor fully removed from registry (not just delisted).");
            setSponsorAddress("");
        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.reason || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Registry Management</h2>
                    <p className="text-slate-500 dark:text-slate-400">Manage contract ownership and system-level configuration.</p>
                    {isOwner && (
                        <Link to="/admin/wiring" className="text-xs text-violet-600 hover:underline font-semibold">
                            Protocol timelock wiring →
                        </Link>
                    )}
                </div>
            </div>

            {/* Two-step ownership transfer UI */}
            <OwnershipTransfer
                contractName="SponsorRegistry"
                initiateTransfer={async (newOwner: string) => {
                    if (!signer) throw new Error("No signer");
                    const registry = getSponsorRegistry(signer);
                    const tx = await registry.transferOwnership(newOwner);
                    await tx.wait();
                    const pending = await registry.pendingOwner();
                    setPendingOwner(pending !== ethers.ZeroAddress ? pending : null);
                    return tx.hash;
                }}
                acceptTransfer={async () => {
                    if (!signer) throw new Error("No signer");
                    const registry = getSponsorRegistry(signer);
                    const tx = await registry.acceptOwnership();
                    await tx.wait();
                    setPendingOwner(null);
                    setIsOwner(true);
                    return tx.hash;
                }}
                pendingOwner={pendingOwner}
                currentOwner={account || undefined}
                isCurrentOwner={isOwner}
            />

            <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-900">
                        <Building className="h-5 w-5 text-accent" />
                        Sponsor allowlist
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!isOwner ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Connect the SponsorRegistry owner wallet to approve or revoke sponsor access.
                        </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
                        <Input
                            value={sponsorAddress}
                            onChange={(e) => setSponsorAddress(e.target.value)}
                            placeholder="Sponsor wallet address"
                            disabled={!isOwner || loading}
                        />
                        <Input
                            value={sponsorName}
                            onChange={(e) => setSponsorName(e.target.value)}
                            placeholder="Sponsor name"
                            disabled={!isOwner || loading}
                        />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            onClick={handleAddSponsor}
                            disabled={!isOwner || loading || !sponsorAddress || !sponsorName}
                            className="gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Approve sponsor
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleRemoveSponsor}
                            disabled={!isOwner || loading || !sponsorAddress}
                            className="gap-2"
                        >
                            <UserMinus className="h-4 w-4" />
                            Revoke sponsor
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {isOwner ? (
                <Card className="border-violet-200 bg-white shadow-sm dark:border-violet-900/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                            <Coins className="h-5 w-5 text-violet-600" />
                            Abandoned pool recovery (P2)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            When a sponsor is revoked mid-trial, distribution and sponsor reclaim are blocked.
                            After the trial ends and the 90-day grace period, the vault owner can schedule recovery
                            to the protocol owner wallet, then claim in a second transaction.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Input
                                value={abandonedTrialId}
                                onChange={(e) => setAbandonedTrialId(e.target.value)}
                                placeholder="Trial ID"
                                disabled={abandonedLoading}
                            />
                            <Button
                                variant="outline"
                                onClick={() => void refreshAbandonedStatus()}
                                disabled={abandonedLoading || !abandonedTrialId.trim()}
                                className="gap-2 shrink-0"
                            >
                                {abandonedLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Check status
                            </Button>
                        </div>

                        {abandonedStatus ? (
                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs space-y-2 font-mono text-slate-700 dark:text-slate-300">
                                <p>Pool funded: {abandonedStatus.poolFunded ? "yes" : "no"}</p>
                                <p>Sponsor verified: {abandonedStatus.sponsorVerified ? "yes" : "no"}</p>
                                <p>Trial ended: {abandonedStatus.trialEnded ? "yes" : "no"}</p>
                                <p>Grace elapsed: {abandonedStatus.gracePeriodElapsed ? "yes" : "no"}</p>
                                <p>Participants: {abandonedStatus.participantCount}</p>
                                <p>Vault owner wallet: {abandonedStatus.vaultOwnerAuthorized ? "connected" : "not connected"}</p>
                                <p>Can schedule abandoned reclaim: {abandonedStatus.canAbandonedReclaim ? "yes" : "no"}</p>
                                {abandonedStatus.pendingReclaimEth ? (
                                    <p>
                                        Pending: {abandonedStatus.pendingReclaimEth} ETH →{" "}
                                        {abandonedStatus.pendingReclaimRecipient?.slice(0, 10)}…
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                onClick={() => void handleScheduleAbandonedReclaim()}
                                disabled={
                                    abandonedLoading ||
                                    !abandonedTrialId.trim() ||
                                    !abandonedStatus?.canAbandonedReclaim
                                }
                                className="gap-2"
                            >
                                <ShieldAlert className="h-4 w-4" />
                                Schedule abandoned reclaim
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => void handleClaimAbandonedReclaim()}
                                disabled={abandonedLoading || !canClaimAbandonedPending}
                                className="gap-2"
                            >
                                <Coins className="h-4 w-4" />
                                Claim reclaimed ETH
                            </Button>
                        </div>

                        {abandonedMessage ? (
                            <p
                                className={`text-sm font-semibold ${
                                    abandonedMessage.startsWith("Error")
                                        ? "text-rose-600"
                                        : "text-emerald-600"
                                }`}
                            >
                                {abandonedMessage}
                            </p>
                        ) : null}
                    </CardContent>
                </Card>
            ) : null}

            <AnimatePresence>
                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${status.startsWith("Error")
                                ? "bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20"
                            }`}
                    >
                        {status.startsWith("Error") ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {status}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
