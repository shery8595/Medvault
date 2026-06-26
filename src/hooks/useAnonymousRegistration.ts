import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import {
    getOrCreateIdentity,
    getStoredIdentity,
    createNewIdentity,
    isPatientRegistered,
    generateAnonymousProof,
    hasAppliedToTrial,
    generateEphemeralAddress,
    storeAnonymousNullifier,
    type SemaphoreProof
} from '../lib/semaphore';
import { submitViaRelayer } from '../lib/relayer';
import { getMedVaultRegistry } from '../lib/contracts';

interface RegistrationState {
    isRegistered: boolean;
    isChecking: boolean;
    isRegistering: boolean;
    error: string | null;
}

interface ApplicationState {
    semaphoreProof: SemaphoreProof | null;
    isGeneratingSemaphore: boolean;
    isSubmitting: boolean;
    hasApplied: boolean | null;
    error: string | null;
}

export function useAnonymousRegistration(signer?: ethers.Signer) {
    const [registration, setRegistration] = useState<RegistrationState>({
        isRegistered: false,
        isChecking: false,
        isRegistering: false,
        error: null
    });

    const [application, setApplication] = useState<ApplicationState>({
        semaphoreProof: null,
        isGeneratingSemaphore: false,
        isSubmitting: false,
        hasApplied: null,
        error: null
    });

    /**
     * Check if the connected wallet is already registered.
     */
    const checkRegistration = useCallback(async () => {
        if (!signer) return;

        setRegistration(prev => ({ ...prev, isChecking: true, error: null }));
        try {
            const registered = await isPatientRegistered(signer);
            setRegistration(prev => ({ ...prev, isRegistered: registered }));
        } catch (err: any) {
            setRegistration(prev => ({ ...prev, error: err.message || 'Failed to check registration' }));
        } finally {
            setRegistration(prev => ({ ...prev, isChecking: false }));
        }
    }, [signer]);


    /**
     * Generate a new identity (warning: old identity will be lost!)
     */
    const regenerateIdentity = useCallback(() => {
        const identity = createNewIdentity();
        return identity.commitment.toString();
    }, []);

    return {
        // Registration
        checkRegistration,
        regenerateIdentity,
        isRegistered: registration.isRegistered,
        isChecking: registration.isChecking,
        isRegistering: registration.isRegistering,
        registrationError: registration.error,

        // Application (separate hook below for more granular control)
        application,
        setApplication
    };
}

export function useAnonymousApplication(signer?: ethers.Signer, provider?: ethers.Provider) {
    const [state, setState] = useState<ApplicationState>({
        semaphoreProof: null,
        isGeneratingSemaphore: false,
        isSubmitting: false,
        hasApplied: null,
        error: null
    });

    /**
     * Check if already applied to a specific trial.
     */
    const checkApplicationStatus = useCallback(async (trialId: number | bigint) => {
        if (!provider || !state.semaphoreProof) return;

        try {
            const applied = await hasAppliedToTrial(provider, trialId, state.semaphoreProof.nullifier);
            setState(prev => ({ ...prev, hasApplied: applied }));
        } catch (err: any) {
            console.error('Failed to check application status:', err);
        }
    }, [provider, state.semaphoreProof]);

    /**
     * Generate Semaphore proof for anonymous identity.
     * This happens in the browser and takes ~1-2 seconds.
     */
    const generateSemaphoreProof = useCallback(async (trialId: number | bigint) => {
        if (!provider) return;

        setState(prev => ({ ...prev, isGeneratingSemaphore: true, error: null, semaphoreProof: null }));
        try {
            const identity = getOrCreateIdentity();
            const permitRecipient = await generateEphemeralAddress(identity);
            
            const proof = await generateAnonymousProof(identity, provider, trialId, permitRecipient);
            
            setState(prev => ({ ...prev, semaphoreProof: proof }));
            return proof;
        } catch (err: any) {
            const message = err.message || 'Semaphore proof generation failed';
            setState(prev => ({ ...prev, error: message }));
            throw err;
        } finally {
            setState(prev => ({ ...prev, isGeneratingSemaphore: false }));
        }
    }, [provider]);

    /**
     * Submit the anonymous application with Semaphore proof.
     * FHE eligibility computation happens automatically on-chain.
     * FINDING 4: Now passes commitment parameter to verify consent encoding.
     * H-2: Generates ephemeral permit recipient from identity secret for anonymity.
     *
     * IMPORTANT: Always regenerates proof fresh at submit time to avoid Semaphore__MerkleTreeRootIsExpired errors.
     * The stored semaphoreProof in state is for preview only and is NOT used for submission.
     */
    const submitApplication = useCallback(async (trialId: number | bigint) => {
        if (!provider) {
            throw new Error('Provider is required');
        }
        if (!signer) {
            throw new Error('Wallet signer is required for consent binding');
        }

        setState(prev => ({ ...prev, isSubmitting: true, error: null }));
        try {
            const identity = getStoredIdentity();
            if (!identity) {
                throw new Error(
                    'No local anonymous identity found on this browser. Open the same browser/profile used during registration, or re-register with a new wallet.'
                );
            }
            const commitment = identity.commitment;
            const permitRecipient = await generateEphemeralAddress(identity);

            // CRITICAL: Always regenerate proof fresh at submit time
            // This ensures the Merkle root is current even if user waited after generating preview
            const proof = await generateAnonymousProof(identity, provider, trialId, permitRecipient);

            // Manually serialize all BigInt fields before passing to relayer
            const serializedProof = {
                merkleTreeDepth: Number(proof.merkleTreeDepth),
                merkleTreeRoot: String(proof.merkleTreeRoot),
                nullifier: String(proof.nullifier),
                message: String(proof.message),
                scope: String(proof.scope),
                points: proof.points.map((p: any) => String(p))
            } as unknown as SemaphoreProof;

            const txHash = await submitViaRelayer(
                trialId,
                serializedProof,
                commitment.toString(),
                permitRecipient,
                { provider, identity, consentSigner: signer }
            );

            // Persist per-trial nullifier so patient-side views can resolve
            // anonymous application status updates from the contract.
            storeAnonymousNullifier(trialId, proof.nullifier);

            setState(prev => ({ ...prev, hasApplied: true }));
            return txHash;
        } catch (err: any) {
            const message = err.message || 'Application submission failed';
            setState(prev => ({ ...prev, error: message }));
            throw err;
        } finally {
            setState(prev => ({ ...prev, isSubmitting: false }));
        }
    }, [provider, signer]);

    /**
     * Reset the application state (e.g., for retrying).
     */
    const reset = useCallback(() => {
        setState({
            semaphoreProof: null,
            isGeneratingSemaphore: false,
            isSubmitting: false,
            hasApplied: null,
            error: null
        });
    }, []);

    return {
        // Proof generation
        generateSemaphoreProof,

        // Submission method
        submitApplication,

        // Status checking
        checkApplicationStatus,
        reset,

        // State
        semaphoreProof: state.semaphoreProof,
        isGeneratingSemaphore: state.isGeneratingSemaphore,
        isSubmitting: state.isSubmitting,
        hasApplied: state.hasApplied,
        error: state.error
    };
}

// Combined hook for convenience
export function useAnonymousTrialWorkflow(signer?: ethers.Signer, provider?: ethers.Provider) {
    const registration = useAnonymousRegistration(signer);
    const application = useAnonymousApplication(signer, provider);

    return {
        // Registration phase
        ...registration,

        // Application phase
        application,

        // Full workflow methods
        applyToTrial: application.submitApplication,
        generateSemaphoreProof: application.generateSemaphoreProof,
        checkApplicationStatus: application.checkApplicationStatus
    };
}
