import { useState, useEffect } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { getContract } from "../lib/contracts";

/** When not the string "false", any connected wallet can use the Sponsor Portal (testnet / hackathon). Set VITE_SPONSOR_OPEN_ACCESS=false to require on-chain verification. */
export const SPONSOR_OPEN_ACCESS = import.meta.env.VITE_SPONSOR_OPEN_ACCESS !== "false";

interface UseSponsorVerificationResult {
    isVerified: boolean;
    isAdmin: boolean;
    isLoading: boolean;
    sponsorName: string | null;
    error: string | null;
}

export function useSponsorVerification(): UseSponsorVerificationResult {
    const { account, provider, readOnlyProvider } = useWeb3();
    const [isVerified, setIsVerified] = useState(SPONSOR_OPEN_ACCESS);
    const [isAdmin, setIsAdmin] = useState(SPONSOR_OPEN_ACCESS);
    const [isLoading, setIsLoading] = useState(!SPONSOR_OPEN_ACCESS);
    const [sponsorName, setSponsorName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (SPONSOR_OPEN_ACCESS) {
            setIsVerified(true);
            setIsAdmin(true);
            setSponsorName(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        if (!account || !readOnlyProvider) {
            setIsVerified(false);
            setIsAdmin(false);
            setIsLoading(false);
            setSponsorName(null);
            return;
        }

        let cancelled = false;

        const checkVerification = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const registry = getContract("SponsorRegistry", readOnlyProvider);
                const [verified, sponsorData, owner] = await Promise.all([
                    registry.isVerifiedSponsor(account) as Promise<boolean>,
                    registry.sponsors(account) as Promise<{ name: string; verified: boolean; addedAt: bigint }>,
                    registry.owner() as Promise<string>
                ]);
                
                if (!cancelled) {
                    setIsAdmin(owner.toLowerCase() === account.toLowerCase());
                    const hasRecord =
                        sponsorData.name &&
                        sponsorData.name.length > 0 &&
                        sponsorData.addedAt > 0n;
                    setIsVerified(verified && hasRecord);
                    setSponsorName(verified && hasRecord ? sponsorData.name : null);
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error("useSponsorVerification error:", err);
                    setError(err.message || "Failed to verify sponsor status");
                    setIsVerified(false);
                    setIsAdmin(false);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        checkVerification();
        return () => {
            cancelled = true;
        };
    }, [account, provider, readOnlyProvider]);

    return { isVerified, isAdmin, isLoading, sponsorName, error };
}
