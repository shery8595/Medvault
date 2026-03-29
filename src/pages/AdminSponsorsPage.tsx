import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
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
    Building
} from "lucide-react";
import { useWeb3 } from "../lib/Web3Context";
import { getSponsorRegistry } from "../lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { useSubgraph } from "../hooks/useSubgraph";
import { EncryptionService } from "../lib/EncryptionService";
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
                } catch (err) {
                    console.error("Error checking owner:", err);
                }
            }
        };
        checkOwner();
    }, [signer, account]);

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
            setStatus("Success! Sponsor revoked.");
            setSponsorAddress("");
        } catch (err: any) {
            console.error(err);
            setStatus(`Error: ${err.reason || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOwner) {
        if (isSubmitted) {
            return (
                <div className="max-w-2xl mx-auto py-20">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-12 rounded-[3rem] bg-slate-900 border border-emerald-500/20 text-center shadow-2xl relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full" />
                        <div className="relative z-10">
                            <div className="h-20 w-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 mx-auto mb-8">
                                <ClipboardCheck className="h-10 w-10" />
                            </div>
                            <h2 className="text-3xl font-bold mb-4">Application Received</h2>
                            <p className="text-slate-400 mb-8 leading-relaxed text-lg">
                                Your request to become a verified Sponsor has been logged. The MedVault team will review your institution's credentials and whitelist your wallet address shortly.
                            </p>
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Status: Verification Pending</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            );
        }

        return (
            <div className="max-w-2xl mx-auto space-y-10 py-10">
                <div className="text-center space-y-4">
                    <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 mx-auto">
                        <UserPlus className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Become a Sponsor</h1>
                    <p className="text-slate-500 text-lg max-w-lg mx-auto">
                        Apply for institutional verification to start launching clinical trials and accessing global patient data.
                    </p>
                </div>

                <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-xl shadow-2xl rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl flex items-center gap-2">
                             <FileText className="h-5 w-5 text-accent" />
                             Application Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <Building className="h-3 w-3" /> Institution Name
                                </label>
                                <Input 
                                    placeholder="e.g. Mayo Clinic"
                                    value={sponsorName}
                                    onChange={(e) => setSponsorName(e.target.value)}
                                    className="bg-slate-950 border-slate-800 h-12"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                    <User className="h-3 w-3" /> Lead Researcher
                                </label>
                                <Input 
                                    placeholder="Full Name"
                                    value={applicantData.researcher}
                                    onChange={(e) => setApplicantData({...applicantData, researcher: e.target.value})}
                                    className="bg-slate-950 border-slate-800 h-12"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Mail className="h-3 w-3" /> Professional Email
                            </label>
                            <Input 
                                type="email"
                                placeholder="name@institution.edu"
                                value={applicantData.email}
                                onChange={(e) => setApplicantData({...applicantData, email: e.target.value})}
                                className="bg-slate-950 border-slate-800 h-12"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Clinical Focus / Mission</label>
                            <textarea 
                                className="w-full min-h-[120px] rounded-xl bg-slate-950 border border-slate-800 p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-sans"
                                placeholder="Tell us about the trials you plan to run..."
                                value={applicantData.mission}
                                onChange={(e) => setApplicantData({...applicantData, mission: e.target.value})}
                            />
                        </div>

                        <Button 
                            className="w-full h-14 bg-accent hover:bg-accent/90 text-white font-bold rounded-2xl shadow-xl shadow-accent/20 transition-all group"
                            onClick={async () => {
                                if (!signer) return;
                                setLoading(true);
                                setStatus("Encrypting institutional data...");
                                try {
                                    const registry = getSponsorRegistry(signer);
                                    const owner = await registry.owner();
                                    
                                    // 1. Get encryption key for Admin
                                    // For this version, we use a simpler approach as eth_getEncryptionPublicKey 
                                    // requires the admin to be online. 
                                    // We'll use a standard encryption payload for the demo.
                                    const payload = {
                                        institution: sponsorName,
                                        researcher: applicantData.researcher,
                                        email: applicantData.email,
                                        mission: applicantData.mission
                                    };
                                    
                                    const encrypted = await EncryptionService.encryptData(payload, "ADMIN_KEY");
                                    const bytesData = ethers.toUtf8Bytes(encrypted);

                                    setStatus("Requesting sponsorship on-chain...");
                                    const tx = await registry.requestSponsorship(bytesData);
                                    await tx.wait();
                                    
                                    setLoading(false);
                                    setIsSubmitted(true);
                                    setStatus(null);
                                } catch (e: any) {
                                    console.error(e);
                                    setStatus(`Error: ${e.message}`);
                                    setLoading(false);
                                }
                            }}
                            disabled={loading || !sponsorName || !applicantData.researcher || !applicantData.email}
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Submit Application"}
                        </Button>
                        
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800/50">
                            <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
                            <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                Your secure wallet address <span className="text-slate-300 font-mono text-[10px]">{account?.slice(0, 10)}...</span> will be automatically linked to this institutional application.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20">
                    <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">Sponsor Registry</h2>
                    <p className="text-slate-500 dark:text-slate-400">Manage verified clinical trial partners and research institutions.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 shadow-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <UserPlus className="h-5 w-5 text-emerald-500" />
                            Verify New Sponsor
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Institution Name</label>
                            <Input
                                placeholder="Mayo Clinic, Pfizer, etc."
                                value={sponsorName}
                                onChange={(e) => setSponsorName(e.target.value)}
                                className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Wallet Address</label>
                            <Input
                                placeholder="0x..."
                                value={sponsorAddress}
                                onChange={(e) => setSponsorAddress(e.target.value)}
                                className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            onClick={handleAddSponsor}
                            disabled={loading || !sponsorAddress || !sponsorName}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                            Grant Verification
                        </Button>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 shadow-xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <UserMinus className="h-5 w-5 text-rose-500" />
                            Revoke Sponsor
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Wallet Address</label>
                            <Input
                                placeholder="0x..."
                                value={sponsorAddress}
                                onChange={(e) => setSponsorAddress(e.target.value)}
                                className="bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                            />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed italic">
                            Revoking a sponsor will immediately block them from creating new trials. Existing trials will remain active but cannot be updated.
                        </p>
                        <Button
                            variant="destructive"
                            className="w-full font-bold"
                            onClick={handleRemoveSponsor}
                            disabled={loading || !sponsorAddress}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                            Revoke Status
                        </Button>
                    </CardContent>
                </Card>
            </div>

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

            {/* Application Review Queue — ONLY for Admin */}
            <Card className="border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shadow-xl overflow-hidden mt-8">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between p-6">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                        Application Review Queue
                    </CardTitle>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[10px] font-black tracking-widest uppercase text-indigo-500">
                             {subgraphData?.sponsorshipRequests?.length || 0} Pending
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {subgraphData?.sponsorshipRequests?.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {subgraphData.sponsorshipRequests.map((req: any) => (
                                <ReviewItem 
                                    key={req.id} 
                                    request={req} 
                                    onProcess={(addr: string, name: string) => {
                                        setSponsorAddress(addr);
                                        setSponsorName(name);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    onReject={async (addr: string) => {
                                        if (!signer) return;
                                        setLoading(true);
                                        try {
                                            const registry = getSponsorRegistry(signer);
                                            const tx = await registry.rejectSponsorship(addr);
                                            await tx.wait();
                                            refetchRequests();
                                        } finally {
                                            setLoading(false);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-200 dark:text-slate-800 mx-auto">
                                <ClipboardCheck className="h-10 w-10" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-500 font-bold">Review Queue Empty</p>
                                <p className="text-slate-400 text-xs text-center max-w-[240px] mx-auto">Incoming sponsor applications will appear here for verification.</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ReviewItem({ request, onProcess, onReject }: { request: any, onProcess: any, onReject: any }) {
    const { account } = useWeb3();
    const [details, setDetails] = useState<any>(null);
    const [isDecrypting, setIsDecrypting] = useState(false);

    const handleDecrypt = async () => {
        if (!account) return;
        setIsDecrypting(true);
        try {
            // In a real dApp, request.encryptedData would be hex-encoded bytes
            const encryptedStr = ethers.toUtf8String(request.encryptedData);
            const decrypted = await EncryptionService.decryptData(encryptedStr, account);
            setDetails(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            alert("This application is encrypted for the Admin. Only the Admin can decrypt it.");
        } finally {
            setIsDecrypting(false);
        }
    };

    return (
        <div className="p-6 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold border border-indigo-500/20">
                            {details ? details.institution.slice(0, 1) : "?"}
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100">
                                {details ? details.institution : "Encrypted Institution"}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400">{request.id}</span>
                            </p>
                        </div>
                    </div>
                    
                    {details ? (
                        <div className="space-y-3">
                            <div className="p-4 rounded-xl bg-slate-100/30 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50">
                                <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed">"{details.mission}"</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {details.researcher}</span>
                                <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {details.email}</span>
                            </div>
                        </div>
                    ) : (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-[10px] font-bold h-8 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/5"
                            onClick={handleDecrypt}
                            disabled={isDecrypting}
                        >
                            {isDecrypting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <ShieldAlert className="h-3 w-3 mr-2" />}
                            Decrypt Application Details
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline"
                        className="h-11 px-6 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                        onClick={() => onProcess(request.id, details?.institution)}
                        disabled={!details}
                    >
                        Process Verification
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-11 w-11 p-0 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                        onClick={() => onReject(request.id)}
                    >
                        <XCircle className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
