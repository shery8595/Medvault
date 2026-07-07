import { ethers, type Provider } from 'ethers';
import type { Identity } from '@semaphore-protocol/identity';
import type { SemaphoreProof } from './semaphore';
import {
    generateAnonymousProof,
    getEphemeralSigner,
    hasAppliedToTrial,
    parseAnonymousApplyStagedFinalCt,
    findStagedAnonymousApplyFinalCt,
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
import { createAndPublishPendingRegisterAuthorization } from './pendingRegisterAuth';
import { createAndPublishPendingMilestoneAuths } from './pendingMilestoneAuth';
import { getRelayersInFailoverOrder, probeAllRelayerHealth } from './relayerRegistry';
import { resolveDocumentBindingForApply } from './patientDocumentUpload';
import { getPendingHybridDocument } from './pendingHybridDocument';
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

export function isAlreadyStagedApplyError(text: string | null | undefined): boolean {
    if (!text) return false;
    return /already staged/i.test(text);
}

async function postRelayOnce(
    path: string,
    body: Record<string, unknown>,
    baseUrl: string
): Promise<{ txHash: string; eligible?: boolean; cancelled?: boolean }> {
    const relayerUrl = baseUrl.replace(/\/$/, "");
    const response = await fetch(`${relayerUrl || ""}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body, (_key, val) => (typeof val === 'bigint' ? val.toString() : val))
    });

    const data = await response.json().catch(() => ({} as Record<string, unknown>));

    if (!response.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : 'Relayer request failed';
        if (errorMsg.includes('Only authorized relayer')) {
            throw new Error(
                'The MedVault relayer is not authorized on-chain yet. The protocol owner must schedule relayer authorization (6-hour timelock on Sepolia), then run finish-wiring. Check relayer health: relayerAuthorized should be true.'
            );
        }
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

function isRetryableRelayError(message: string): boolean {
    if (isNotEligibleForTrialMessage(message)) return false;
    if (message.includes('Only authorized relayer')) return false;
    if (message.includes('Not eligible for this trial')) return false;
    if (/missing .+ fields/i.test(message)) return false;
    return true;
}

type PostRelayOptions = {
    /** Try only this URL (no failover). */
    baseUrl?: string;
    /** Override failover sequence (e.g. prefer relayer that staged successfully). */
    failoverOrder?: string[];
    /** When user explicitly picked a relayer in the UI, try it first. */
    manualPreferred?: string | null;
};

async function postRelay(
    path: string,
    body: Record<string, unknown>,
    options?: PostRelayOptions | string
): Promise<{ txHash: string; relayerUrl: string; eligible?: boolean; cancelled?: boolean }> {
    const opts: PostRelayOptions =
        typeof options === 'string' ? { baseUrl: options } : (options ?? {});

    const urls = opts.baseUrl
        ? [opts.baseUrl.replace(/\/$/, "")]
        : opts.failoverOrder?.length
          ? opts.failoverOrder.map((u) => u.replace(/\/$/, ""))
          : getRelayersInFailoverOrder(opts.manualPreferred);

    let lastError = 'Relayer request failed';
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        try {
            const result = await postRelayOnce(path, body, url);
            return { ...result, relayerUrl: url };
        } catch (err: unknown) {
            lastError = (err as Error)?.message || lastError;
            const hasNext = i < urls.length - 1;
            if (!hasNext || !isRetryableRelayError(lastError)) {
                throw err;
            }
            console.warn(`[relayer] ${url || 'dev-proxy'} failed — trying next relayer…`, lastError);
        }
    }
    throw new Error(lastError);
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
    permitSignature: string,
    options?: { manualPreferred?: string | null }
): Promise<{ txHash: string; relayerUrl: string }> {
    const { txHash, relayerUrl } = await postRelay('/relay/apply-stage', {
        trialId: Number(trialId),
        proof: serializeProofForRelay(proof),
        commitment: commitment.toString(),
        permitRecipient,
        deadline: deadline.toString(),
        permitSignature,
    }, { manualPreferred: options?.manualPreferred });
    return { txHash, relayerUrl };
}

/**
 * HIGH-1: Submit finalize via authorized relayer (patient EOAs cannot call on-chain directly).
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
 * Reject relayer-wallet permitRecipient unless caller explicitly acknowledges visibility tradeoff.
 */
export async function assertPatientDecryptPermitRecipient(
    permitRecipient: string,
    options?: { acknowledgeRelayerVisibility?: boolean }
): Promise<void> {
    if (options?.acknowledgeRelayerVisibility) return;
    const normalized = ethers.getAddress(permitRecipient);
    const health = await probeAllRelayerHealth();
    for (const h of health) {
        if (!h.relayerWallet) continue;
        if (ethers.getAddress(h.relayerWallet) === normalized) {
            throw new Error(
                'Relayer-assisted decrypt (P0.2) gives the relayer visibility into the eligibility bit. ' +
                    'Use patient ephemeral permitRecipient (recommended default), or pass acknowledgeRelayerVisibility: true to opt in.'
            );
        }
    }
}

/**
 * Finalize relay with Noir proof (client generates proof after local FHE decrypt).
 * Optional gasless path when relayer is authorized and patient uses relayer as permitRecipient (P0.2 — visibility tradeoff).
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
    eligible: boolean,
    options?: { failoverOrder?: string[]; manualPreferred?: string | null; acknowledgeRelayerVisibility?: boolean }
): Promise<string> {
    await assertPatientDecryptPermitRecipient(permitRecipient, options);
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
        ...(options?.acknowledgeRelayerVisibility ? { acknowledgeRelayerVisibility: true } : {}),
    }, options);
    return txHash;
}

/**
 * Full anonymous apply: relayer stage → browser decrypt + Noir proof → relayer finalize (HIGH-1).
 *
 * Recommended default: patient ephemeral wallet is `permitRecipient` — browser decrypts locally;
 * relayer only relays transactions and never sees the eligibility bit.
 */
export async function submitViaRelayer(
    trialId: number | bigint,
    proof: SemaphoreProof,
    commitment: string,
    permitRecipient: string,
    ctx: { provider: Provider; identity: Identity; consentSigner: import('ethers').Signer },
    manualPreferredRelayer?: string | null,
    options?: { acknowledgeRelayerVisibility?: boolean }
): Promise<string> {
    await assertPatientDecryptPermitRecipient(permitRecipient, options);
    const provider = ctx.provider;
    const registry = getMedVaultRegistry(provider);
    const registryAddr = await registry.getAddress();
    const chainId = requireChainId(await resolveChainIdFrom(ctx.consentSigner));
    const ephemeralSigner = getEphemeralSigner(ctx.identity, provider);

    const engine = getEligibilityEngine(provider, chainId);
    const engineAddress = await engine.getAddress();

    const alreadyApplied = await hasAppliedToTrial(provider, trialId, proof.nullifier);
    if (alreadyApplied) {
        throw new Error("You have already applied to this trial. Check My Applications for status.");
    }

    const appStatus = Number(
        await engine.getAnonymousApplicationStatus(proof.nullifier, BigInt(trialId))
    );
    if (appStatus !== 0) {
        const label = appStatus === 1 ? "Pending" : appStatus === 2 ? "Accepted" : appStatus === 3 ? "Rejected" : "Submitted";
        throw new Error(`Application already on-chain (${label}). Check My Applications.`);
    }

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

    let stageTxHash: string;
    let stageRelayerUrl: string;
    let finalCt: bigint;

    try {
        const staged = await stageViaRelayer(
            trialId,
            proof,
            commitment,
            permitRecipient,
            stageDeadline,
            stagePermitSignature,
            { manualPreferred: manualPreferredRelayer }
        );
        stageTxHash = staged.txHash;
        stageRelayerUrl = staged.relayerUrl;
        const receipt = await provider.getTransactionReceipt(stageTxHash);
        if (!receipt) throw new Error('Stage receipt not found');
        finalCt = parseAnonymousApplyStagedFinalCt(receipt, registryAddr);
    } catch (err: unknown) {
        const msg = (err as Error)?.message || String(err);
        if (!isAlreadyStagedApplyError(msg)) throw err;

        const resumed = await findStagedAnonymousApplyFinalCt(
            provider,
            registryAddr,
            BigInt(trialId),
            proof.nullifier,
        );
        if (!resumed) {
            throw new Error(
                "Apply is already staged on-chain but the stage transaction could not be found. Wait a minute and retry."
            );
        }
        stageTxHash = resumed.stageTxHash;
        finalCt = resumed.finalCt;
        stageRelayerUrl =
            manualPreferredRelayer?.replace(/\/$/, "") ||
            (await probeAllRelayerHealth()).find((r) => r.ok)?.url ||
            getRelayersInFailoverOrder(manualPreferredRelayer)[0] ||
            "";
        console.info("[apply] Resuming finalize after on-chain Already staged", stageTxHash);
    }

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
    const pendingHybridDoc = getPendingHybridDocument(trialId);
    let documentBinding: DocumentBindingInputs | undefined;
    if (docStoreAddr) {
        // Bind using the same nullifier that was staged on-chain (`proof`), not a
        // freshly regenerated proof object, so PatientDocumentStore keys match the
        // subgraph AnonymousSubmission nullifier sponsors review.
        documentBinding = await resolveDocumentBindingForApply(
            ephemeralSigner,
            proof.nullifier,
            BigInt(trialId),
            docStoreAddr
        );
    }

    if (pendingHybridDoc?.aesKeyB64 && !pendingHybridDoc.recordedTxHash && !documentBinding?.hasDocument) {
        throw new Error(
            "Medical document was attached locally but could not be bound on-chain before apply. " +
                "Re-attach the file on the trial card and submit again."
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
        eligible,
        {
            failoverOrder: [
                stageRelayerUrl,
                ...getRelayersInFailoverOrder(manualPreferredRelayer).filter((u) => u !== stageRelayerUrl),
            ],
            acknowledgeRelayerVisibility: options?.acknowledgeRelayerVisibility,
        }
    ).then(async (txHash) => {
        const applied = await hasAppliedToTrial(provider, trialId, proofFresh.nullifier);
        if (!applied) {
            const outcome = await engine.silentApplyOutcome(proofFresh.nullifier, BigInt(trialId));
            if (Number(outcome) === 2) {
                throw new Error(NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE);
            }
            throw new Error(
                "Application finalize confirmed but trial enrollment was not recorded. Check Applied Trials or retry."
            );
        }

        // Pre-sign "enroll if accepted" so sponsor (or relayer) can register in the vault on accept.
        try {
            await createAndPublishPendingRegisterAuthorization({
                identity: ctx.identity,
                provider,
                trialId: BigInt(trialId),
                nullifier: proofFresh.nullifier,
                permitHolder: permitRecipient,
                relayerBaseUrl: stageRelayerUrl,
            });
        } catch (err) {
            console.warn("[apply] pending register auth failed (apply still succeeded):", err);
        }

        try {
            await createAndPublishPendingMilestoneAuths({
                identity: ctx.identity,
                provider,
                trialId: BigInt(trialId),
                nullifier: proofFresh.nullifier,
                permitHolder: permitRecipient,
                relayerBaseUrl: stageRelayerUrl,
            });
        } catch (err) {
            console.warn("[apply] pending milestone auth failed (apply still succeeded):", err);
        }

        return txHash;
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

async function fetchCompletionProofOnce(
    baseUrl: string,
    params: {
        kind: CompletionProofKind;
        stageTxHash: string;
        user?: string;
        handle?: string;
        callerSignature: string;
    }
): Promise<{
    eligible: boolean;
    cleartexts: string;
    decryptionProof: string;
    completeTxHash?: string;
    completeError?: string;
}> {
    const relayerUrl = baseUrl.replace(/\/$/, "");
    const response = await fetch(`${relayerUrl || ""}/relay/completion-proof`, {
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
        completeTxHash: typeof data.completeTxHash === 'string' ? data.completeTxHash : undefined,
        completeError: typeof data.completeError === 'string' ? data.completeError : undefined,
    };
}

export async function fetchCompletionProof(params: {
    kind: CompletionProofKind;
    stageTxHash: string;
    user?: string;
    handle?: string;
    callerSignature: string;
    manualPreferred?: string | null;
}): Promise<{
    eligible: boolean;
    cleartexts: string;
    decryptionProof: string;
    completeTxHash?: string;
    completeError?: string;
    relayerUrl: string;
}> {
    const urls = getRelayersInFailoverOrder(params.manualPreferred);
    let lastError = 'Failed to fetch completion proof';
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        try {
            const result = await fetchCompletionProofOnce(url, params);
            return { ...result, relayerUrl: url };
        } catch (err: unknown) {
            lastError = (err as Error)?.message || lastError;
            if (i < urls.length - 1) {
                console.warn(`[relayer] completion-proof via ${url || 'dev-proxy'} failed — trying next…`, lastError);
                continue;
            }
            throw err;
        }
    }
    throw new Error(lastError);
}

/** @deprecated Use finalizeViaRelayerWithProof */
export const finalizeViaRelayer = finalizeViaRelayerWithProof;
