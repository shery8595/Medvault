import { ethers } from "ethers";
import { publicDecryptProof } from "./zama-client.mjs";
import { createBatchExitQueue } from "./batch-exit-queue.mjs";

const CONFIDENTIAL_ETH_ABI = [
    "event WithdrawRequested(address indexed user, bytes32 transferableHandle)",
    "event WithdrawToRequested(address indexed user, bytes32 transferableHandle)",
    "function completeWithdrawTo(address user, bytes transferableCleartexts, bytes transferableProof) external",
    "function completePublicExit(address owner, address stealthRecipient, uint8 exitMode, uint256 nonce, uint256 deadline, bytes signature, bytes transferableCleartexts, bytes transferableProof) external",
];

const STAKING_MANAGER_ABI = [
    "event PublicUnstakeRequested(address indexed user, bytes32 transferableHandle)",
    "event PrivateUnstakeRequested(address indexed user, bytes32 transferableHandle)",
    "function completeUnstake(bytes transferableCleartexts, bytes transferableProof) external",
    "function completePrivateUnstake(bytes transferableCleartexts, bytes transferableProof) external",
];

const DEFAULT_CONFIRMATION_DEPTH = Number(process.env.WATCHER_CONFIRMATION_DEPTH || 3);
const MAX_HANDLER_RETRIES = Number(process.env.WATCHER_MAX_RETRIES || 5);
const RETRY_BASE_MS = Number(process.env.WATCHER_RETRY_BASE_MS || 5_000);

/**
 * Poll v0.9 stage events and submit on-chain completions the relayer wallet can pay for.
 */
export function startV09Watcher({
    provider,
    relayerWallet,
    zamaSdk,
    confidentialEthAddress,
    stakingManagerAddress,
    pollMs = 15_000,
    lookbackBlocks = 2_000,
    batchMinSize = Number(process.env.BATCH_EXIT_MIN_SIZE || 2),
    batchMaxWaitMs = Number(process.env.BATCH_EXIT_MAX_WAIT_MS || 120_000),
    confirmationDepth = DEFAULT_CONFIRMATION_DEPTH,
}) {
    if (!confidentialEthAddress) {
        console.warn("Watcher: CONFIDENTIAL_ETH_ADDRESS unset — withdraw-to auto-complete disabled");
    }

    const cEth = confidentialEthAddress
        ? new ethers.Contract(confidentialEthAddress, CONFIDENTIAL_ETH_ABI, relayerWallet)
        : null;
    const cEthIface = confidentialEthAddress ? new ethers.Interface(CONFIDENTIAL_ETH_ABI) : null;

    const staking = stakingManagerAddress
        ? new ethers.Contract(stakingManagerAddress, STAKING_MANAGER_ABI, provider)
        : null;
    const stakingIface = stakingManagerAddress ? new ethers.Interface(STAKING_MANAGER_ABI) : null;

    /** @type {Map<string, { cleartexts: string, proof: string, units: bigint, transferable: boolean }>} */
    const proofCache = new Map();
    const processed = new Set();
    /** @type {Map<string, { handler: () => Promise<void>, attempts: number, nextRetryAt: number }>} */
    const retryQueue = new Map();
    let fromBlock = 0;
    let lastCanonicalHash = null;
    let running = false;

    const batchQueue = createBatchExitQueue({
        minBatchSize: batchMinSize,
        maxWaitMs: batchMaxWaitMs,
        onFlush: async (item) => {
            await executePublicExit(item);
        },
    });

    async function initCursor() {
        const latest = await provider.getBlockNumber();
        fromBlock = Math.max(0, latest - lookbackBlocks);
    }

    function cacheKey(kind, user, handle, stageTxHash) {
        const base = `${kind}:${user.toLowerCase()}:${handle.toLowerCase()}`;
        if (stageTxHash) return `${base}:${stageTxHash.toLowerCase()}`;
        return base;
    }

    async function cacheProof(kind, user, handle, stageTxHash) {
        const key = cacheKey(kind, user, handle, stageTxHash);
        if (proofCache.has(key)) return proofCache.get(key);

        const { units, transferable, cleartexts, proof } = await publicDecryptProof(zamaSdk, handle);
        const entry = { cleartexts, proof, units, transferable, eligible: transferable };
        proofCache.set(key, entry);
        return entry;
    }

    function scheduleRetry(id, handler, attempts) {
        const delay = RETRY_BASE_MS * 2 ** Math.min(attempts, 6);
        retryQueue.set(id, {
            handler,
            attempts,
            nextRetryAt: Date.now() + delay,
        });
    }

    async function drainRetryQueue() {
        const now = Date.now();
        for (const [id, entry] of [...retryQueue.entries()]) {
            if (entry.nextRetryAt > now) continue;
            retryQueue.delete(id);
            try {
                await entry.handler();
                processed.add(id);
            } catch (err) {
                const nextAttempts = entry.attempts + 1;
                if (nextAttempts >= MAX_HANDLER_RETRIES) {
                    console.error(`Watcher: giving up on ${id} after ${nextAttempts} attempts:`, err?.message || err);
                } else {
                    console.error(`Watcher: retry ${nextAttempts}/${MAX_HANDLER_RETRIES} for ${id}:`, err?.message || err);
                    scheduleRetry(id, entry.handler, nextAttempts);
                }
            }
        }
    }

    async function runHandler(id, handler) {
        try {
            await handler();
            processed.add(id);
        } catch (err) {
            console.error(`Watcher: handler failed (${id}), scheduling retry:`, err?.message || err);
            scheduleRetry(id, handler, 1);
        }
    }

    function rollbackForReorg(safeBlock) {
        processed.clear();
        retryQueue.clear();
        proofCache.clear();
        fromBlock = Math.max(0, safeBlock - lookbackBlocks);
        lastCanonicalHash = null;
        console.warn(`Watcher: reorg detected — re-scanning from block ${fromBlock}`);
    }

    async function detectReorg(safeHead) {
        if (fromBlock <= 0) return false;
        const anchor = fromBlock - 1;
        const block = await provider.getBlock(anchor);
        if (!block) return false;
        if (lastCanonicalHash && block.hash !== lastCanonicalHash) {
            rollbackForReorg(safeHead);
            return true;
        }
        lastCanonicalHash = block.hash;
        return false;
    }

    async function completeWithdrawToWithProof(user, transferableCleartexts, transferableProof) {
        const completeTx = await cEth.completeWithdrawTo(user, transferableCleartexts, transferableProof);
        const receipt = await completeTx.wait();
        return receipt.hash;
    }

    async function executePublicExit(item) {
        const {
            owner,
            stealthRecipient,
            exitMode,
            nonce,
            deadline,
            signature,
            transferableHandle,
        } = item;

        const handle = transferableHandle;
        const { cleartexts: transferableCleartexts, proof: transferableProof } = await cacheProof(
            "withdraw",
            owner,
            handle
        );

        const tx = await cEth.completePublicExit(
            owner,
            stealthRecipient,
            exitMode,
            nonce,
            deadline,
            signature,
            transferableCleartexts,
            transferableProof
        );
        const receipt = await tx.wait();
        return receipt.hash;
    }

    async function handleWithdrawTo(log) {
        const parsed = cEthIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.transferableHandle;
        const id = `${log.transactionHash}:${log.index}`;

        const { transferable, cleartexts, proof } = await cacheProof(
            "withdrawTo",
            user,
            handle,
            log.transactionHash
        );
        if (!transferable) {
            console.log(`Watcher: withdraw-to insufficient noop for ${user} (${id})`);
            const noopTx = await cEth.completeWithdrawTo(user, cleartexts, proof);
            await noopTx.wait();
            return;
        }

        const hash = await completeWithdrawToWithProof(user, cleartexts, proof);
        console.log(`Watcher: completeWithdrawTo for ${user} → ${hash}`);
    }

    async function handleWithdrawRequested(log) {
        const parsed = cEthIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.transferableHandle;
        await cacheProof("withdraw", user, handle, log.transactionHash);
        console.log(`Watcher: cached withdraw proof for ${user} (user must call completeWithdraw)`);
    }

    async function handleUnstakeRequested(log, eventName) {
        const parsed = stakingIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.transferableHandle;
        await cacheProof("unstake", user, handle, log.transactionHash);
        console.log(`Watcher: cached ${eventName} proof for ${user}`);
    }

    async function pollOnce() {
        if (running) return;
        running = true;
        try {
            const latest = await provider.getBlockNumber();
            const safeHead = Math.max(0, latest - confirmationDepth);

            if (fromBlock > safeHead) {
                await drainRetryQueue();
                return;
            }

            let headChanged = await detectReorg(safeHead);

            if (!headChanged && cEth && cEthIface) {
                const withdrawToFilter = cEth.filters.WithdrawToRequested();
                const withdrawFilter = cEth.filters.WithdrawRequested();
                const [withdrawToLogs, withdrawLogs] = await Promise.all([
                    cEth.queryFilter(withdrawToFilter, fromBlock, safeHead),
                    cEth.queryFilter(withdrawFilter, fromBlock, safeHead),
                ]);

                for (const log of withdrawToLogs) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id) || retryQueue.has(id)) continue;
                    await runHandler(id, () => handleWithdrawTo(log));
                }

                for (const log of withdrawLogs) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id) || retryQueue.has(id)) continue;
                    await runHandler(id, () => handleWithdrawRequested(log));
                }
            }

            if (!headChanged && staking && stakingIface) {
                const publicFilter = staking.filters.PublicUnstakeRequested();
                const privateFilter = staking.filters.PrivateUnstakeRequested();
                const [publicLogs, privateLogs] = await Promise.all([
                    staking.queryFilter(publicFilter, fromBlock, safeHead),
                    staking.queryFilter(privateFilter, fromBlock, safeHead),
                ]);
                for (const log of [...publicLogs, ...privateLogs]) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id) || retryQueue.has(id)) continue;
                    await runHandler(id, () => handleUnstakeRequested(log, log.fragment?.name || "UnstakeRequested"));
                }
            }

            fromBlock = safeHead + 1;
            await drainRetryQueue();
        } finally {
            running = false;
        }
    }

    async function lookupCompletionProof({ kind, user, handle, stageTxHash }) {
        if (stageTxHash && cEth && cEthIface) {
            const receipt = await provider.getTransactionReceipt(stageTxHash);
            if (!receipt) throw new Error("Stage transaction not found");

            for (const log of receipt.logs) {
                if (log.address?.toLowerCase() !== confidentialEthAddress.toLowerCase()) continue;
                try {
                    const parsed = cEthIface.parseLog(log);
                    if (kind === "withdraw" && parsed.name === "WithdrawRequested") {
                        user = parsed.args.user;
                        handle = parsed.args.transferableHandle;
                    } else if (kind === "withdrawTo" && parsed.name === "WithdrawToRequested") {
                        user = parsed.args.user;
                        handle = parsed.args.transferableHandle;
                    }
                } catch {
                    /* ignore */
                }
            }
        }

        if (kind === "unstake" && stageTxHash && stakingIface) {
            const receipt = await provider.getTransactionReceipt(stageTxHash);
            if (!receipt) throw new Error("Stage transaction not found");
            for (const log of receipt.logs) {
                if (log.address?.toLowerCase() !== stakingManagerAddress.toLowerCase()) continue;
                try {
                    const parsed = stakingIface.parseLog(log);
                    if (
                        parsed.name === "PublicUnstakeRequested" ||
                        parsed.name === "PrivateUnstakeRequested"
                    ) {
                        user = parsed.args.user;
                        handle = parsed.args.transferableHandle;
                    }
                } catch {
                    /* ignore */
                }
            }
        }

        if (!user || !handle) {
            throw new Error("Could not resolve user/handle for completion proof");
        }

        return cacheProof(kind, user, handle, stageTxHash);
    }

    async function submitPublicExit(item) {
        const exitMode = Number(item.exitMode ?? 0);
        if (exitMode === 1) {
            await batchQueue.enqueue(item);
            return { queued: true, queueSize: batchQueue.size() };
        }
        const txHash = await executePublicExit(item);
        return { queued: false, txHash };
    }

    return {
        async start() {
            await initCursor();
            console.log(
                `Watcher: polling from block ${fromBlock} every ${pollMs}ms (confirmations=${confirmationDepth})`
            );
            setInterval(() => {
                pollOnce().catch((err) => console.error("Watcher poll error:", err?.message || err));
            }, pollMs);
            await pollOnce();
        },
        lookupCompletionProof,
        submitPublicExit,
        batchQueue,
    };
}
