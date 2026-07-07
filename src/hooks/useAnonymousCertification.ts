import { useEffect, useState } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { getContractAddressForChain } from "../lib/contracts";
import { fetchCertificationStatus } from "../lib/certificationStatus";
import { ETHEREUM_SEPOLIA_CHAIN_ID } from "../lib/zamaChain";
import { getSepoliaReadOnlyProvider } from "../lib/sepoliaReadOnlyProvider";

export type AnonymousCertificationSubgraph = {
    noirCertified?: boolean;
    noirEligible?: boolean | null;
    fhePropensityCommittedAt?: string | null;
};

/**
 * On-chain anonymous seal status: certified flag + eligible bit (from subgraph or RPC logs).
 */
export function useAnonymousCertification(
    nullifier: string | undefined,
    trialId: string | undefined,
    subgraph?: AnonymousCertificationSubgraph
): {
    certified: boolean;
    eligible: boolean | null;
    fheCommitted: boolean;
    loading: boolean;
} {
    const { chainId } = useWeb3();
    const [certified, setCertified] = useState(false);
    const [eligible, setEligible] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    const fheCommitted = Boolean(
        subgraph?.fhePropensityCommittedAt && subgraph.fhePropensityCommittedAt !== "0"
    );

    const subgraphCertified = subgraph?.noirCertified === true;
    const subgraphEligible =
        subgraph?.noirEligible === true || subgraph?.noirEligible === false
            ? subgraph.noirEligible
            : null;

    /**
     * Encrypted-criteria trials emit `eligible: false` on EligibilityProofVerified
     * (Noir binds identity only; FHE is the eligibility authority). When propensity
     * was committed, or the event eligible bit is true, show eligible in UI.
     */
    const displayEligible = !certified
        ? eligible
        : fheCommitted || eligible === true
          ? true
          : eligible;

    useEffect(() => {
        if (!nullifier || !trialId) {
            setCertified(false);
            setEligible(null);
            setLoading(false);
            return;
        }

        if (subgraphCertified && subgraphEligible !== null) {
            setCertified(true);
            setEligible(subgraphEligible);
            setLoading(false);
            return;
        }

        // Anonymous certifications are Sepolia-only; use the read-only fallback
        // provider instead of the wallet provider so a CORS/429 failure on the
        // wallet's configured RPC (e.g. rpc.sepolia.org, Privy) can't block the
        // patient-matches page. chainId from useWeb3 is only used to resolve the
        // engine address; fall back to Sepolia when unknown.
        const resolvedChainId = chainId ? Number(chainId) : ETHEREUM_SEPOLIA_CHAIN_ID;
        const engineAddress = getContractAddressForChain("EligibilityEngine", resolvedChainId);
        if (!engineAddress) {
            setCertified(false);
            setEligible(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);

        readCertification(engineAddress, resolvedChainId, nullifier, trialId)
            .then((status) => {
                if (cancelled) return;
                setCertified(status.certified);
                setEligible(status.eligible);
            })
            .catch(() => {
                if (!cancelled) {
                    setCertified(subgraphCertified);
                    setEligible(subgraphCertified ? subgraphEligible : null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        nullifier,
        trialId,
        chainId,
        subgraphCertified,
        subgraphEligible,
    ]);

    return { certified, eligible: displayEligible, fheCommitted, loading };
}

// --- Per-key dedup + short TTL cache -------------------------------------
// Like documentExists, certification reads fire once per match row. Dedup
// collapses identical concurrent reads into one request so a busy matches page
// doesn't exhaust the read-only RPCs.

type CacheEntry = { value: { certified: boolean; eligible: boolean | null }; expires: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<{ certified: boolean; eligible: boolean | null }>>();
const CACHE_TTL_MS = 15_000;

function cacheKey(engineAddress: string, chainId: number, nullifier: string, trialId: string): string {
    return `${chainId}:${engineAddress.toLowerCase()}:${nullifier}:${trialId}`;
}

async function readCertification(
    engineAddress: string,
    chainId: number,
    nullifier: string,
    trialId: string
): Promise<{ certified: boolean; eligible: boolean | null }> {
    const key = cacheKey(engineAddress, chainId, nullifier, trialId);

    const cachedEntry = cache.get(key);
    if (cachedEntry && cachedEntry.expires > Date.now()) {
        return cachedEntry.value;
    }

    const existing = inFlight.get(key);
    if (existing) return existing;

    const task = (async () => {
        try {
            const provider = getSepoliaReadOnlyProvider(chainId);
            const status = await fetchCertificationStatus(provider, engineAddress, nullifier, trialId);
            cache.set(key, { value: status, expires: Date.now() + CACHE_TTL_MS });
            return status;
        } finally {
            inFlight.delete(key);
        }
    })();

    inFlight.set(key, task);
    return task;
}

/** @deprecated Prefer useAnonymousCertification for eligible + certified. */
export function useIsNullifierCertified(
    nullifier: string | undefined,
    trialId: string | undefined
): { certified: boolean; loading: boolean } {
    const { certified, loading } = useAnonymousCertification(nullifier, trialId);
    return { certified, loading };
}
