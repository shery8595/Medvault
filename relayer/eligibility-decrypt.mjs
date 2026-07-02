/**
 * Relayer-side user-decrypt of staged eligibility ciphertext (P0.2 interim mitigation).
 * Relayer is permitRecipient from stageAnonymousEligibility; decrypt result is cached per
 * (nullifier, trialId) for STAGING_TTL and invalidated on cancel.
 */

/** @typedef {{ finalCt: string, stagedAtMs: number }} StageCacheEntry */
/** @typedef {{ eligible: boolean, finalCt: string, cachedAtMs: number }} DecryptCacheEntry */

export const STAGING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const stageCache = new Map();
const decryptCache = new Map();

function cacheKey(nullifier, trialId) {
    return `${BigInt(nullifier).toString()}:${BigInt(trialId).toString()}`;
}

export function cacheStageHandle(nullifier, trialId, finalCt, stagedAtMs = Date.now()) {
    stageCache.set(cacheKey(nullifier, trialId), {
        finalCt: toHandleHex(finalCt),
        stagedAtMs: Number(stagedAtMs),
    });
}

export function getCachedStage(nullifier, trialId) {
    return stageCache.get(cacheKey(nullifier, trialId)) ?? null;
}

export function invalidateEligibilityCaches(nullifier, trialId) {
    const key = cacheKey(nullifier, trialId);
    stageCache.delete(key);
    decryptCache.delete(key);
}

/** @internal Test helper — clears all in-memory caches. */
export function _resetCachesForTest() {
    stageCache.clear();
    decryptCache.clear();
}

export function toHandleHex(value) {
    if (typeof value === "string" && value.startsWith("0x")) {
        return value.length === 66 ? value : `0x${BigInt(value).toString(16).padStart(64, "0")}`;
    }
    if (typeof value === "bigint") {
        return `0x${value.toString(16).padStart(64, "0")}`;
    }
    return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

export function isStagingExpired(stagedAtMs, stagingTtlMs = STAGING_TTL_MS, nowMs = Date.now()) {
    return nowMs > Number(stagedAtMs) + stagingTtlMs;
}

/**
 * @param {import('@zama-fhe/sdk').ZamaSDK} sdk
 * @param {string} contractAddress
 * @param {`0x${string}`} handle
 */
export async function userDecryptOneWithSdk(sdk, contractAddress, handle) {
    await sdk.permits.grantPermit([contractAddress]);
    const values = await sdk.decryption.decryptValues([
        { encryptedValue: handle, contractAddress },
    ]);
    return values[handle];
}

export function coerceEligibleBit(value) {
    return value === true || value === 1n || value === 1 || value === "1";
}

/**
 * Resolve staged finalCt from in-memory stage cache or Noir public input index 5.
 * @param {{ nullifier: bigint | string | number, trialId: bigint | string | number, publicInputs?: string[] }} params
 */
export function resolveStagedFinalCt({ nullifier, trialId, publicInputs }) {
    const cached = getCachedStage(nullifier, trialId);
    if (cached?.finalCt) {
        return { finalCt: cached.finalCt, stagedAtMs: cached.stagedAtMs };
    }
    if (Array.isArray(publicInputs) && publicInputs[5] != null) {
        return { finalCt: toHandleHex(publicInputs[5]), stagedAtMs: null };
    }
    throw Object.assign(new Error("Staged eligibility ciphertext not found"), { code: "STAGING_NOT_FOUND" });
}

/**
 * User-decrypt staged eligibility; ignores client-supplied eligible.
 * @param {{
 *   sdk: import('@zama-fhe/sdk').ZamaSDK,
 *   eligibilityEngineAddress: string,
 *   nullifier: bigint | string | number,
 *   trialId: bigint | string | number,
 *   finalCt: string,
 *   stagedAtMs?: number | null,
 *   stagingTtlMs?: number,
 *   decryptFn?: (handleHex: string, contractAddress: string) => Promise<unknown>,
 * }} params
 */
export async function getRelayerEligible({
    sdk,
    eligibilityEngineAddress,
    nullifier,
    trialId,
    finalCt,
    stagedAtMs = null,
    stagingTtlMs = STAGING_TTL_MS,
    decryptFn,
}) {
    const key = cacheKey(nullifier, trialId);
    const handleHex = toHandleHex(finalCt);

    const resolvedStagedAt =
        stagedAtMs ??
        getCachedStage(nullifier, trialId)?.stagedAtMs ??
        null;

    if (resolvedStagedAt != null && isStagingExpired(resolvedStagedAt, stagingTtlMs)) {
        invalidateEligibilityCaches(nullifier, trialId);
        throw Object.assign(new Error("Staging expired"), { code: "STAGING_EXPIRED" });
    }

    const cachedDecrypt = decryptCache.get(key);
    if (cachedDecrypt && cachedDecrypt.finalCt === handleHex) {
        return cachedDecrypt.eligible;
    }

    const raw = decryptFn
        ? await decryptFn(handleHex, eligibilityEngineAddress)
        : await userDecryptOneWithSdk(sdk, eligibilityEngineAddress, handleHex);

    const eligible = coerceEligibleBit(raw);
    decryptCache.set(key, { eligible, finalCt: handleHex, cachedAtMs: Date.now() });
    return eligible;
}
