import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { getEligibilityEngine, resolveChainIdFrom } from '../lib/contracts';
import { FheTypes, decryptForViewWithEphemeral } from '../lib/fhe';
import { getAnonymousNullifier, getStoredIdentity, getEphemeralSigner } from '../lib/semaphore';

/**
 * Optional post-finalize viewing of anonymous eligibility results (read-only userDecrypt).
 * Eligibility certification is enforced by Noir proof at finalize time; this hook is for post-apply viewing only.
 */
export function useAnonymousEligibility() {
    const [decrypting, setDecrypting] = useState<Record<string, boolean>>({});
    const [results, setResults] = useState<Record<string, boolean>>({});
    const [scores, setScores] = useState<Record<string, number>>({});
    const [error, setError] = useState<string | null>(null);

    const decryptResult = useCallback(async (trialId: string, signer: ethers.Signer) => {
        const nullifier = getAnonymousNullifier(BigInt(trialId));
        if (!nullifier) {
            setError('No nullifier found for this trial. Apply to the trial first.');
            return null;
        }

        const identity = getStoredIdentity();
        if (!identity || !signer.provider) {
            setError('Anonymous decrypt requires the local Semaphore identity.');
            return null;
        }

        try {
            setDecrypting(prev => ({ ...prev, [trialId]: true }));
            setError(null);

            const chainId = await resolveChainIdFrom(signer);
            const engine = getEligibilityEngine(signer, chainId);
            const engineAddress = await engine.getAddress();
            const encryptedResult = await engine.getAnonymousResult(nullifier, BigInt(trialId));

            const ephemeralSigner = getEphemeralSigner(identity, signer.provider);
            const isEligible = Boolean(
                await decryptForViewWithEphemeral(
                    ephemeralSigner,
                    encryptedResult,
                    FheTypes.Bool,
                    engineAddress
                )
            );
            setResults(prev => ({ ...prev, [trialId]: isEligible }));
            return isEligible;
        } catch (err: unknown) {
            const message = (err as Error).message || 'Failed to decrypt result';
            setError(message);
            console.error('Decryption failed:', err);
            return null;
        } finally {
            setDecrypting(prev => ({ ...prev, [trialId]: false }));
        }
    }, []);

    const decryptScore = useCallback(async (trialId: string, signer: ethers.Signer) => {
        const nullifier = getAnonymousNullifier(BigInt(trialId));
        if (!nullifier) {
            setError('No nullifier found for this trial. Apply to the trial first.');
            return null;
        }

        const identity = getStoredIdentity();
        if (!identity || !signer.provider) {
            setError('Anonymous decrypt requires the local Semaphore identity.');
            return null;
        }

        try {
            setDecrypting(prev => ({ ...prev, [trialId]: true }));
            setError(null);

            const chainId = await resolveChainIdFrom(signer);
            const engine = getEligibilityEngine(signer, chainId);
            const engineAddress = await engine.getAddress();
            const encryptedScore = await engine.getAnonymousScore(nullifier, BigInt(trialId));

            const ephemeralSigner = getEphemeralSigner(identity, signer.provider);
            const scoreVal = await decryptForViewWithEphemeral(
                ephemeralSigner,
                encryptedScore,
                FheTypes.Uint8,
                engineAddress
            );
            const score = Number(scoreVal);
            setScores(prev => ({ ...prev, [trialId]: score }));
            return score;
        } catch (err: unknown) {
            const message = (err as Error).message || 'Failed to decrypt score';
            setError(message);
            console.error('Score decryption failed:', err);
            return null;
        } finally {
            setDecrypting(prev => ({ ...prev, [trialId]: false }));
        }
    }, []);

    const getApplicationStatus = useCallback(async (
        trialId: string,
        nullifier: string,
        provider: ethers.Provider
    ): Promise<number | null> => {
        try {
            const chainId = await resolveChainIdFrom(provider);
            const engine = getEligibilityEngine(provider, chainId);
            const status = await engine.getAnonymousApplicationStatus(nullifier, trialId);
            return Number(status);
        } catch (err: unknown) {
            console.error('Failed to get application status:', err);
            return null;
        }
    }, []);

    return {
        decryptResult,
        decryptScore,
        getApplicationStatus,
        results,
        scores,
        decrypting,
        error
    };
}

export function useSponsorAnonymousView(provider?: ethers.Provider) {
    const getStatus = useCallback(async (nullifier: string, trialId: string): Promise<string> => {
        if (!provider) return 'Unknown';

        try {
            const chainId = await resolveChainIdFrom(provider);
            const engine = getEligibilityEngine(provider, chainId);
            const status = await engine.getAnonymousApplicationStatus(nullifier, trialId);

            switch (Number(status)) {
                case 0: return 'None';
                case 1: return 'Pending';
                case 2: return 'Accepted';
                case 3: return 'Rejected';
                default: return 'Unknown';
            }
        } catch (err) {
            console.error('Failed to get status:', err);
            return 'Unknown';
        }
    }, [provider]);

    return { getStatus };
}
