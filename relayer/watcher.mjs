import { ethers } from "ethers";
import { publicDecryptProof } from "./zama-client.mjs";
import { createBatchExitQueue } from "./batch-exit-queue.mjs";

const CONFIDENTIAL_ETH_ABI = [
    "event WithdrawRequested(address indexed user, bytes32 sufficientHandle)",
    "event WithdrawToRequested(address indexed user, bytes32 sufficientHandle)",
    "event WithdrawAmountRevealed(address indexed user, bytes32 amountHandle)",
    "function revealWithdrawToAmountFor(address user, bytes sufficientCleartexts, bytes sufficientProof) returns (bytes32)",
    "function completeWithdrawTo(address user, bytes amountCleartexts, bytes amountProof) external",
    "function revealWithdrawAmountFor(address owner, bytes sufficientCleartexts, bytes sufficientProof) returns (bytes32)",
    "function completePublicExit(address owner, address stealthRecipient, uint8 exitMode, uint256 nonce, uint256 deadline, bytes signature, bytes sufficientCleartexts, bytes sufficientProof, bytes amountCleartexts, bytes amountProof) external",
];

const STAKING_MANAGER_ABI = [
    "event PublicUnstakeRequested(address indexed user, bytes32 sufficientHandle)",
    "event PrivateUnstakeRequested(address indexed user, bytes32 sufficientHandle)",
    "function completeUnstake(bytes sufficientCleartexts, bytes sufficientProof) external",
    "function completePrivateUnstake(bytes sufficientCleartexts, bytes sufficientProof) external",
];

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

    /** @type {Map<string, { cleartexts: string, proof: string, eligible: boolean }>} */
    const proofCache = new Map();
    const processed = new Set();
    let fromBlock = 0;
    let running = false;

    const batchQueue = createBatchExitQueue({
        minBatchSize: batchMinSize,
        maxWaitMs: batchMaxWaitMs,
        onFlush: async (batch) => {
            for (const item of batch) {
                try {
                    await executePublicExit(item);
                } catch (err) {
                    console.error("Batch public exit failed:", err?.message || err);
                }
            }
        },
    });

    async function initCursor() {
        const latest = await provider.getBlockNumber();
        fromBlock = Math.max(0, latest - lookbackBlocks);
    }

    function cacheKey(kind, user, handle) {
        return `${kind}:${user.toLowerCase()}:${handle.toLowerCase()}`;
    }

    async function cacheProof(kind, user, handle) {
        const key = cacheKey(kind, user, handle);
        if (proofCache.has(key)) return proofCache.get(key);

        const { eligible, cleartexts, proof } = await publicDecryptProof(zamaSdk, handle);
        const entry = { cleartexts, proof, eligible };
        proofCache.set(key, entry);
        return entry;
    }

    async function revealAndCompleteWithdrawTo(user, sufficientCleartexts, sufficientProof) {
        const revealTx = await cEth.revealWithdrawToAmountFor(user, sufficientCleartexts, sufficientProof);
        const revealRc = await revealTx.wait();
        const amountHandle = parseAmountHandle(revealRc);
        const amount = await publicDecryptProof(zamaSdk, amountHandle);
        const completeTx = await cEth.completeWithdrawTo(user, amount.cleartexts, amount.proof);
        const receipt = await completeTx.wait();
        return receipt.hash;
    }

    function parseAmountHandle(receipt) {
        for (const log of receipt.logs) {
            if (log.address?.toLowerCase() !== confidentialEthAddress.toLowerCase()) continue;
            try {
                const parsed = cEthIface.parseLog(log);
                if (parsed.name === "WithdrawAmountRevealed") {
                    return parsed.args.amountHandle;
                }
            } catch {
                /* ignore */
            }
        }
        throw new Error("WithdrawAmountRevealed not found");
    }

    async function executePublicExit(item) {
        const {
            owner,
            stealthRecipient,
            exitMode,
            nonce,
            deadline,
            signature,
            sufficientHandle,
        } = item;

        const { eligible, cleartexts: sufficientCleartexts, proof: sufficientProof } =
            await cacheProof("withdraw", owner, sufficientHandle);
        if (!eligible) throw new Error("Insufficient balance for public exit");

        const revealTx = await cEth.revealWithdrawAmountFor(
            owner,
            sufficientCleartexts,
            sufficientProof
        );
        const revealRc = await revealTx.wait();
        const amountHandle = parseAmountHandle(revealRc);
        const amount = await publicDecryptProof(zamaSdk, amountHandle);

        const tx = await cEth.completePublicExit(
            owner,
            stealthRecipient,
            exitMode,
            nonce,
            deadline,
            signature,
            sufficientCleartexts,
            sufficientProof,
            amount.cleartexts,
            amount.proof
        );
        const receipt = await tx.wait();
        return receipt.hash;
    }

    async function handleWithdrawTo(log) {
        const parsed = cEthIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.sufficientHandle;
        const id = `${log.transactionHash}:${log.index}`;

        const { eligible, cleartexts, proof } = await cacheProof("withdrawTo", user, handle);
        if (!eligible) {
            console.log(`Watcher: withdraw-to insufficient for ${user} (${id})`);
            return;
        }

        const hash = await revealAndCompleteWithdrawTo(user, cleartexts, proof);
        console.log(`Watcher: completeWithdrawTo for ${user} → ${hash}`);
    }

    async function handleWithdrawRequested(log) {
        const parsed = cEthIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.sufficientHandle;
        await cacheProof("withdraw", user, handle);
        console.log(`Watcher: cached withdraw proof for ${user} (user must call completeWithdraw)`);
    }

    async function handleUnstakeRequested(log, eventName) {
        const parsed = stakingIface.parseLog(log);
        const user = parsed.args.user;
        const handle = parsed.args.sufficientHandle;
        await cacheProof("unstake", user, handle);
        console.log(`Watcher: cached ${eventName} proof for ${user}`);
    }

    async function pollOnce() {
        if (running) return;
        running = true;
        try {
            const latest = await provider.getBlockNumber();
            if (fromBlock > latest) return;

            if (cEth && cEthIface) {
                const withdrawToFilter = cEth.filters.WithdrawToRequested();
                const withdrawFilter = cEth.filters.WithdrawRequested();
                const [withdrawToLogs, withdrawLogs] = await Promise.all([
                    cEth.queryFilter(withdrawToFilter, fromBlock, latest),
                    cEth.queryFilter(withdrawFilter, fromBlock, latest),
                ]);

                for (const log of withdrawToLogs) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id)) continue;
                    processed.add(id);
                    try {
                        await handleWithdrawTo(log);
                    } catch (err) {
                        console.error(`Watcher: withdraw-to failed (${id}):`, err?.message || err);
                    }
                }

                for (const log of withdrawLogs) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id)) continue;
                    processed.add(id);
                    try {
                        await handleWithdrawRequested(log);
                    } catch (err) {
                        console.error(`Watcher: withdraw cache failed (${id}):`, err?.message || err);
                    }
                }
            }

            if (staking && stakingIface) {
                const publicFilter = staking.filters.PublicUnstakeRequested();
                const privateFilter = staking.filters.PrivateUnstakeRequested();
                const [publicLogs, privateLogs] = await Promise.all([
                    staking.queryFilter(publicFilter, fromBlock, latest),
                    staking.queryFilter(privateFilter, fromBlock, latest),
                ]);
                for (const log of [...publicLogs, ...privateLogs]) {
                    const id = `${log.transactionHash}:${log.index}`;
                    if (processed.has(id)) continue;
                    processed.add(id);
                    try {
                        await handleUnstakeRequested(log, log.fragment?.name || "UnstakeRequested");
                    } catch (err) {
                        console.error(`Watcher: unstake cache failed (${id}):`, err?.message || err);
                    }
                }
            }

            fromBlock = latest + 1;
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
                        handle = parsed.args.sufficientHandle;
                    } else if (kind === "withdrawTo" && parsed.name === "WithdrawToRequested") {
                        user = parsed.args.user;
                        handle = parsed.args.sufficientHandle;
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
                        handle = parsed.args.sufficientHandle;
                    }
                } catch {
                    /* ignore */
                }
            }
        }

        if (!user || !handle) {
            throw new Error("Could not resolve user/handle for completion proof");
        }

        return cacheProof(kind, user, handle);
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
            console.log(`Watcher: polling from block ${fromBlock} every ${pollMs}ms`);
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
