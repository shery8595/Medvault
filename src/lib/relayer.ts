import { ethers, type Provider } from 'ethers';
import type { Identity } from '@semaphore-protocol/identity';
import type { SemaphoreProof } from './semaphore';
import {
    generateAnonymousProof,
    getEphemeralSigner,
    hasAppliedToTrial,
    parseAnonymousApplyStagedFinalCt,
    toContractSemaphoreProof,
    signAnonymousApplyPermit,
    signAnonymousApplyCancelPermit,
    signConsentWalletBinding,
} from './semaphore';
import { getMedVaultRegistry, getEligibilityEngine, getTrialManager, resolveChainIdFrom, requireChainId } from './contracts';
import { FheTypes, decryptForViewWithEphemeral } from './fhe';
import { generateEligibilityProof } from './noir';
import { BN254_FIELD_ORDER } from './criteriaSchema';
import { fetchTrialCriteria } from './trialCriteria';
import { getStoredPatientProfilePlain } from './profileStorage';
import { getMedVaultRelayerUrl } from './mobile';
import { resolveDocumentBindingForApply } from './patientDocumentUpload';
import { tryGetPatientDocumentStoreAddress } from './contracts';
import type { DocumentBindingInputs } from './noir';

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

export { isStaleStagePermitError, friendlyContractError } from "./contractErrors";

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

/** Cancel staged anonymous apply via authorized relayer (`onlyAuthorizedRelayer`). */
export async function cancelViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    deadline: bigint,
    permitSignature: string,
    cancelSignature: string
): Promise<string> {
    const { txHash } = await postRelay('/relay/cancel-stage', {
        trialId: Number(trialId),
        proof: serializeProofForRelay(proof),
        commitment,
        permitRecipient,
        deadline: deadline.toString(),
        permitSignature,
        cancelSignature,
    });
    return txHash;
}

export async function stageViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    deadline: bigint,
    permitSignature: string
): Promise<string> {
    const { txHash } = await postRelay('/relay/apply-stage', {
        trialId: Number(trialId),
        proof: serializeProofForRelay(proof),
        commitment: commitment.toString(),
        permitRecipient,
        deadline: deadline.toString(),
        permitSignature,
    });
    return txHash;
}

/**
 * P3.2: Submit finalize directly from patient wallet (open finalize; payout integrity is FHE.select-gated).
 */
export async function finalizeAnonymousApplyDirect(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    consentSigner: import('ethers').Signer,
    consentWallet: string,
    deadline: bigint,
    permitSignature: string,
    consentWalletSignature: string,
    noirProof: string,
    publicInputs: string[]
): Promise<string> {
    const registry = getMedVaultRegistry(consentSigner);
    const tx = await registry
        .connect(consentSigner)
        .finalizeAnonymousApplyWithProof(
            BigInt(trialId),
            toContractSemaphoreProof(proof),
            BigInt(commitment),
            permitRecipient,
            consentWallet,
            deadline,
            permitSignature,
            consentWalletSignature,
            noirProof,
            publicInputs
        );
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Finalize receipt not found');
    return receipt.hash;
}

/**
 * Finalize relay with Noir proof (client generates proof after local FHE decrypt).
 * Optional gasless path when relayer is authorized and patient uses relayer as permitRecipient.
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
    publicInputs: string[]
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
    });
    return txHash;
}

/**
 * Full anonymous apply: relayer stage → browser decrypt + Noir proof → patient direct finalize (P3.2).
 */
export async function submitViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    ctx: { provider: Provider; identity: Identity; consentSigner: import('ethers').Signer }
): Promise<string> {
    const provider = ctx.provider;
    const registry = getMedVaultRegistry(provider);
    const registryAddr = await registry.getAddress();
    const chainId = requireChainId(await resolveChainIdFrom(ctx.consentSigner));
    const ephemeralSigner = getEphemeralSigner(ctx.identity, provider);

    const stageDeadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const stagePermitSignature = await signAnonymousApplyPermit(
        ephemeralSigner,
        registryAddr,
        chainId,
        {
            trialId: BigInt(trialId),
            commitment: BigInt(commitment),
            nullifier: proof.nullifier,
            permitRecipient,
            deadline: stageDeadline,
        }
    );

    const stageTxHash = await stageViaRelayer(
        trialId,
        proof,
        commitment,
        permitRecipient,
        stageDeadline,
        stagePermitSignature
    );

    const receipt = await provider.getTransactionReceipt(stageTxHash);
    if (!receipt) throw new Error('Stage receipt not found');

    const finalCt = parseAnonymousApplyStagedFinalCt(receipt, registryAddr);
    const engine = getEligibilityEngine(provider, chainId);
    const engineAddress = await engine.getAddress();

    const eligible = Boolean(
        await decryptForViewWithEphemeral(ephemeralSigner, finalCt, FheTypes.Bool, engineAddress)
    );

    const proofFresh = await generateAnonymousProof(ctx.identity, provider, trialId, permitRecipient);

    const trialManager = getTrialManager(provider, chainId);
    const trial = await trialManager.getTrial(BigInt(trialId));
    const encryptedCriteria = Boolean(trial.encryptedCriteria);

    if (!eligible && !encryptedCriteria) {
        const cancelSignature = await signAnonymousApplyCancelPermit(
            ephemeralSigner,
            registryAddr,
            chainId,
            {
                trialId: BigInt(trialId),
                nullifier: proofFresh.nullifier,
                permitRecipient,
                deadline: stageDeadline,
            }
        );
        await cancelViaRelayer(
            trialId,
            proofFresh,
            commitment,
            permitRecipient,
            stageDeadline,
            stagePermitSignature,
            cancelSignature
        );
        throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
    }

    const profile = getStoredPatientProfilePlain();
    if (!profile) {
        throw new Error('Patient profile not found locally. Re-register your health vault first.');
    }

    const criteria = await fetchTrialCriteria(provider, BigInt(trialId), chainId);
    const proofOptions = encryptedCriteria
        ? {
              criteriaMode: 1 as const,
              encryptedCriteriaBindingHash:
                  BigInt(await getEligibilityEngine(provider, chainId).encryptedCriteriaBindingHash(BigInt(trialId))) %
                  BN254_FIELD_ORDER,
          }
        : { criteriaMode: 0 as const };

    const docStoreAddr = tryGetPatientDocumentStoreAddress(chainId);
    let documentBinding: DocumentBindingInputs | undefined;
    if (docStoreAddr) {
        documentBinding = await resolveDocumentBindingForApply(
            ephemeralSigner,
            proofFresh.nullifier,
            BigInt(trialId),
            docStoreAddr
        );
    }

    const { proofBytes, publicInputs } = await generateEligibilityProof(
        ctx.identity,
        BigInt(commitment),
        BigInt(trialId),
        profile,
        criteria,
        encryptedCriteria ? true : eligible,
        finalCt,
        {
            ...proofOptions,
            ...(documentBinding ? { documentBinding } : {}),
        }
    );

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
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

    return finalizeAnonymousApplyDirect(
        trialId,
        proofFresh,
        commitment,
        permitRecipient,
        ctx.consentSigner,
        consentWallet,
        deadline,
        permitSignature,
        consentWalletSignature,
        proofBytes,
        publicInputs
    ).then(async (txHash) => {
        const applied = await hasAppliedToTrial(provider, trialId, proofFresh.nullifier);
        if (applied) return txHash;

        const outcome = await engine.silentApplyOutcome(proofFresh.nullifier, BigInt(trialId));
        if (Number(outcome) === 2) {
            throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
        }
        throw new Error(
            "Application finalize confirmed but trial enrollment was not recorded. Check Applied Trials or retry."
        );
    });
}

export type CompletionProofKind = 'withdraw' | 'unstake' | 'withdrawTo';

export function buildCompletionProofDigest(params: {
    kind: CompletionProofKind;
    user: string;
    handle?: string;
    stageTxHash?: string;
}): string {
    return ethers.solidityPackedKeccak256(
        ['string', 'address', 'bytes32', 'string'],
        [
            params.kind,
            ethers.getAddress(params.user),
            params.handle ?? ethers.ZeroHash,
            params.stageTxHash ?? '',
        ]
    );
}

export async function signCompletionProofRequest(
    signer: import('ethers').Signer,
    params: {
        kind: CompletionProofKind;
        user: string;
        handle?: string;
        stageTxHash?: string;
    }
): Promise<string> {
    const digest = buildCompletionProofDigest(params);
    return signer.signMessage(ethers.getBytes(digest));
}

export async function fetchCompletionProof(params: {
    kind: CompletionProofKind;
    stageTxHash: string;
    user?: string;
    handle?: string;
    callerSignature: string;
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
