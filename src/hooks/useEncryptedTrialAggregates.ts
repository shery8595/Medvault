import { useCallback, useEffect, useState } from "react";
import { getEncryptedScoreLeaderboard } from "../lib/contracts";
import { getZamaSDK } from "../lib/fhe";
import { normalizeFheHandle } from "../lib/criteriaSchema";
import { useWeb3 } from "../lib/Web3Context";

export type EncryptedTrialAggregate = {
    trialId: string;
    applicantCount: number | null;
    avgScore: number | null;
    error?: string;
};

function handleToHex(value: unknown): `0x${string}` {
    const n = normalizeFheHandle(value);
    if (n === 0n) return `0x${"0".repeat(64)}` as `0x${string}`;
    return (`0x${n.toString(16).padStart(64, "0")}`) as `0x${string}`;
}

export function useEncryptedTrialAggregates(trialIds: string[]) {
    const { readProvider, signer } = useWeb3();
    const [aggregates, setAggregates] = useState<EncryptedTrialAggregate[]>([]);
    const [loading, setLoading] = useState(false);
    const [decryptError, setDecryptError] = useState<string | null>(null);

    const decryptAggregates = useCallback(async () => {
        if (!readProvider || !signer || trialIds.length === 0) return;
        setLoading(true);
        setDecryptError(null);
        try {
            const sdk = getZamaSDK();
            const board = getEncryptedScoreLeaderboard(readProvider);
            const boardAddr = await board.getAddress();
            await sdk.permits.grantPermit([boardAddr as `0x${string}`]);

            const rows: EncryptedTrialAggregate[] = [];
            for (const rawId of trialIds.slice(0, 12)) {
                const trialId = BigInt(String(rawId).replace(/^#/, ""));
                try {
                    const countCt = await board.getAggregateApplicantCount(trialId);
                    const sumCt = await board.getAggregateScoreSum(trialId);
                    const countHandle = handleToHex(countCt);
                    const sumHandle = handleToHex(sumCt);

                    if (countHandle === `0x${"0".repeat(64)}`) {
                        rows.push({
                            trialId: rawId,
                            applicantCount: 0,
                            avgScore: null,
                        });
                        continue;
                    }

                    const decrypted = await sdk.decryption.decryptValues([
                        { encryptedValue: countHandle, contractAddress: boardAddr as `0x${string}` },
                        { encryptedValue: sumHandle, contractAddress: boardAddr as `0x${string}` },
                    ]);
                    const count = Number(decrypted[countHandle] ?? 0);
                    const sum = Number(decrypted[sumHandle] ?? 0);
                    rows.push({
                        trialId: rawId,
                        applicantCount: count,
                        avgScore: count > 0 ? Math.round((sum / count) * 10) / 10 : null,
                    });
                } catch (e) {
                    rows.push({
                        trialId: rawId,
                        applicantCount: null,
                        avgScore: null,
                        error: e instanceof Error ? e.message : "Decrypt failed",
                    });
                }
            }
            setAggregates(rows);
        } catch (e) {
            setDecryptError(e instanceof Error ? e.message : "FHE decrypt unavailable");
            setAggregates([]);
        } finally {
            setLoading(false);
        }
    }, [readProvider, signer, trialIds]);

    useEffect(() => {
        setAggregates([]);
        setDecryptError(null);
    }, [trialIds.join(",")]);

    return { aggregates, loading, decryptError, decryptAggregates };
}
