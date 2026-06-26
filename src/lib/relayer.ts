import type { Provider } from 'ethers';
import type { Identity } from '@semaphore-protocol/identity';
import type { SemaphoreProof } from './semaphore';
import {
    generateAnonymousProof,
    getEphemeralSigner,
    parseAnonymousApplyStagedFinalCt,
    toContractSemaphoreProof,
    signAnonymousApplyPermit,
    signConsentWalletBinding,
} from './semaphore';
import { getMedVaultRegistry, getEligibilityEngine, getTrialManager, resolveChainIdFrom } from './contracts';
import { FheTypes, decryptForViewWithEphemeral } from './fhe';
import { generateEligibilityProof } from './noir';
import { BN254_FIELD_ORDER } from './criteriaSchema';
import { fetchTrialCriteria } from './trialCriteria';
import { getStoredPatientProfilePlain } from './profileStorage';
import { getMedVaultRelayerUrl } from './mobile';

function serializeProofForRelay(proof: SemaphoreProof) {
    return {
        merkleTreeDepth: Number(proof.merkleTreeDepth),
        merkleTreeRoot: proof.merkleTreeRoot.toString(),
        nullifier: proof.nullifier.toString(),
        message: proof.message.toString(),
        scope: proof.scope.toString(),
        points: proof.points.map((p) => p.toString())
    };
}

export const NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE =
    "You don't meet this trial's eligibility requirements. Your profile was evaluated privately on-chain—you won't be able to submit this application. Try another trial, or update your encrypted health profile if your situation changes.";

export function isNotEligibleForTrialMessage(text: string | null | undefined): boolean {
    if (!text) return false;
    return (
        text === NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE ||
        text.includes('Not eligible for this trial') ||
        text.includes('FHE finalResult is false') ||
        text.includes('decryptedEligible must be true') ||
        text.includes('NOT_ELIGIBLE') ||
        text.includes('cancelled on-chain')
    );
}

async function postRelay(path: string, body: Record<string, unknown>): Promise<{ txHash: string; eligible?: boolean; cancelled?: boolean }> {
    const relayerUrl = getMedVaultRelayerUrl();
    const response = await fetch(`${relayerUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body, (_key, val) => (typeof val === 'bigint' ? val.toString() : val))
    });

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : 'Relayer request failed';
        if (data.code === 'NOT_ELIGIBLE' || isNotEligibleForTrialMessage(errorMsg)) {
            throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
        }
        throw new Error(errorMsg);
    }

    if (!data.success || !data.txHash) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Relayer returned invalid response');
    }
    return {
        txHash: data.txHash as string,
        eligible: data.eligible as boolean | undefined,
        cancelled: data.cancelled as boolean | undefined,
    };
}

/** Stage-only relay (tx 1). */
export async function stageViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string
): Promise<string> {
    const { txHash } = await postRelay('/relay/apply-stage', {
        trialId: Number(trialId),
        proof: serializeProofForRelay(proof),
        commitment: commitment.toString(),
        permitRecipient
    });
    return txHash;
}

/**
 * Finalize relay with Noir proof (client generates proof after local FHE decrypt).
 */
export async function finalizeViaRelayerWithProof(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    consentWallet: string,
    deadline: bigint,
    permitSignature: string,
    consentWalletSignature: string,
    noirProof: string,
    publicInputs: string[],
    eligible: boolean
): Promise<string> {
    const { txHash } = await postRelay('/relay/apply-finalize', {
        trialId: Number(trialId),
        proof: serializeProofForRelay(proof),
        commitment: commitment.toString(),
        permitRecipient,
        consentWallet,
        deadline: deadline.toString(),
        permitSignature,
        consentWalletSignature,
        noirProof,
        publicInputs,
        eligible,
    });
    return txHash;
}

/**
 * Full anonymous apply: relayer stage → browser decrypt + Noir proof → relayer finalize.
 */
export async function submitViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    ctx: { provider: Provider; identity: Identity; consentSigner: import('ethers').Signer }
): Promise<string> {
    const stageTxHash = await stageViaRelayer(trialId, proof, commitment, permitRecipient);

    const provider = ctx.provider;
    const receipt = await provider.getTransactionReceipt(stageTxHash);
    if (!receipt) throw new Error('Stage receipt not found');

    const registry = getMedVaultRegistry(provider);
    const registryAddr = await registry.getAddress();
    const finalCt = parseAnonymousApplyStagedFinalCt(receipt, registryAddr);
    const chainId = await resolveChainIdFrom(provider);
    const engine = getEligibilityEngine(provider, chainId);
    const engineAddress = await engine.getAddress();

    const ephemeralSigner = getEphemeralSigner(ctx.identity, provider);
    const eligible = Boolean(
        await decryptForViewWithEphemeral(ephemeralSigner, finalCt, FheTypes.Bool, engineAddress)
    );

    const proofFresh = await generateAnonymousProof(ctx.identity, provider, trialId, permitRecipient);

    if (!eligible) {
        await registry.cancelAnonymousApplyStage(
            BigInt(trialId),
            toContractSemaphoreProof(proofFresh),
            BigInt(commitment),
            permitRecipient
        );
        throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
    }

    const profile = getStoredPatientProfilePlain();
    if (!profile) {
        throw new Error('Patient profile not found locally. Re-register your health vault first.');
    }

    const criteria = await fetchTrialCriteria(provider, BigInt(trialId), chainId);
    const trialManager = getTrialManager(provider, chainId);
    const trial = await trialManager.getTrial(BigInt(trialId));
    const proofOptions = trial.encryptedCriteria
        ? {
              criteriaMode: 1 as const,
              encryptedCriteriaBindingHash:
                  BigInt(await getEligibilityEngine(provider, chainId).encryptedCriteriaBindingHash(BigInt(trialId))) %
                  BN254_FIELD_ORDER,
          }
        : { criteriaMode: 0 as const };
    const { proofBytes, publicInputs } = await generateEligibilityProof(
        ctx.identity,
        BigInt(commitment),
        BigInt(trialId),
        profile,
        criteria,
        true,
        finalCt,
        proofOptions
    );

    const registryAddr = await registry.getAddress();
    const chainId = await resolveChainIdFrom(ctx.consentSigner);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const ephemeralSigner = getEphemeralSigner(ctx.identity, provider);
    const permitSignature = await signAnonymousApplyPermit(
        ephemeralSigner,
        registryAddr,
        chainId,
        {
            trialId: BigInt(trialId),
            commitment: BigInt(commitment),
            nullifier: proofFresh.nullifier,
            permitRecipient,
            deadline,
        }
    );
    const consentWallet = await ctx.consentSigner.getAddress();
    const consentWalletSignature = await signConsentWalletBinding(
        ctx.consentSigner,
        registryAddr,
        chainId,
        {
            nullifier: proofFresh.nullifier,
            trialId: BigInt(trialId),
            consentWallet,
            deadline,
        }
    );

    return finalizeViaRelayerWithProof(
        trialId,
        proofFresh,
        commitment,
        permitRecipient,
        consentWallet,
        deadline,
        permitSignature,
        consentWalletSignature,
        proofBytes,
        publicInputs,
        true
    );
}

export type CompletionProofKind = 'withdraw' | 'unstake' | 'withdrawTo';

export async function fetchCompletionProof(params: {
    kind: CompletionProofKind;
    stageTxHash: string;
    user?: string;
    handle?: string;
}): Promise<{ eligible: boolean; cleartexts: string; decryptionProof: string }> {
    const relayerUrl = getMedVaultRelayerUrl();
    const response = await fetch(`${relayerUrl}/relay/completion-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok || !data.success) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to fetch completion proof');
    }
    return {
        eligible: Boolean(data.eligible),
        cleartexts: data.cleartexts as string,
        decryptionProof: data.decryptionProof as string,
    };
}

/** @deprecated Use finalizeViaRelayerWithProof */
export const finalizeViaRelayer = finalizeViaRelayerWithProof;
