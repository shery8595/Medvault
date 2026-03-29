import { useSubgraph } from './useSubgraph';
import { useWeb3 } from '../lib/Web3Context';
import { getEligibilityEngine } from '../lib/contracts';
import { publicDecrypt } from '../lib/fhe';
import { useState, useCallback } from 'react';

const GET_MATCHES = `
  query GetMatches($patient: Bytes!) {
    eligibilityResults(where: { patient: $patient }) {
      id
      trial {
        id
        name
      }
      computedAt
      txHash
    }
  }
`;

export function useEligibility(address?: string) {
    const { signer } = useWeb3();
    const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
    const [results, setResults] = useState<Record<string, boolean>>({});

    const { data, loading, error, refetch } = useSubgraph(GET_MATCHES, {
        patient: address?.toLowerCase()
    });

    const decryptResult = useCallback(async (trialId: string) => {
        if (!signer || !address) return;

        try {
            setDecrypting(prev => ({ ...prev, [trialId]: true }));

            const engine = getEligibilityEngine(signer);
            const encryptedResult = await engine.getEncryptedResult(address, trialId);

            // In the hardened plan, result is NOT public. 
            // We use the FHE library's decrypt utility which handles the Fhenix reveal process.
            const decrypted = await publicDecrypt(encryptedResult);

            setResults(prev => ({ ...prev, [trialId]: decrypted.value === 1 }));
        } catch (err) {
            console.error("Decryption failed:", err);
        } finally {
            setDecrypting(prev => ({ ...prev, [trialId]: false }));
        }
    }, [signer, address]);

    return {
        matches: data?.eligibilityResults || [],
        decryptResult,
        decryptedResults: results,
        decrypting,
        loading,
        error,
        refetch
    };
}
