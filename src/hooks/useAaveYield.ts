import { useState, useEffect } from "react";
import { useWeb3 } from "../lib/Web3Context";
import { fetchAaveWethSupplyAprPercent } from "../lib/aaveLiquidity";

import { ETHEREUM_SEPOLIA_CHAIN_ID } from "../lib/zamaChain";

const ETHEREUM_SEPOLIA = BigInt(ETHEREUM_SEPOLIA_CHAIN_ID);

/** Conservative static headline when RPC / pool reads fail — not randomly jittered (clearly labeled in UI). */
export const FALLBACK_REFERENCE_APY_PCT = 2.92;

export type AaveYieldSource = "protocol" | "fallback" | "wrong_chain";

export function useAaveYield() {
    const { readOnlyProvider, chainId } = useWeb3();
    const [apy, setApy] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<AaveYieldSource>("protocol");
    const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!readOnlyProvider) {
                setApy(null);
                setLoading(false);
                setError(null);
                setSource("fallback");
                return;
            }

            try {
                setLoading(true);
                setError(null);

                if (chainId !== null && chainId !== ETHEREUM_SEPOLIA) {
                    setApy(FALLBACK_REFERENCE_APY_PCT);
                    setSource("wrong_chain");
                    setLastUpdatedMs(Date.now());
                    return;
                }

                const pct = await fetchAaveWethSupplyAprPercent(readOnlyProvider);
                if (pct != null && Number.isFinite(pct)) {
                    setApy(Math.round(pct * 100) / 100);
                    setSource("protocol");
                } else {
                    setApy(FALLBACK_REFERENCE_APY_PCT);
                    setSource("fallback");
                    setError(null);
                }
                setLastUpdatedMs(Date.now());
            } catch (err) {
                console.error("Failed to fetch Aave yield:", err);
                setApy(FALLBACK_REFERENCE_APY_PCT);
                setSource("fallback");
                setError("Pool read failed — showing conservative reference rate.");
            } finally {
                setLoading(false);
            }
        };

        void load();
        const interval = setInterval(load, 120_000);
        return () => clearInterval(interval);
    }, [readOnlyProvider, chainId]);

    return { apy, loading, error, source, lastUpdatedMs };
}
