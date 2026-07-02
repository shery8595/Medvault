/**
 * Private-exit batch queue: holds signed public exits until minBatchSize or maxWaitMs.
 */

export function createBatchExitQueue({
    minBatchSize = 2,
    maxWaitMs = 120_000,
    onFlush,
}) {
    /** @type {Array<Record<string, unknown>>} */
    const queue = [];
    let flushTimer = null;

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flush().catch((err) => console.error("Batch exit flush error:", err?.message || err));
        }, maxWaitMs);
    }

    async function flush() {
        if (queue.length === 0) return;
        const batch = queue.splice(0, queue.length);
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }

        const failed = [];
        for (const item of batch) {
            try {
                await onFlush(item);
            } catch (err) {
                console.error("Batch exit item failed, re-enqueueing:", err?.message || err);
                failed.push(item);
            }
        }
        if (failed.length > 0) {
            queue.unshift(...failed);
            scheduleFlush();
        }
    }

    return {
        enqueue(item) {
            queue.push({ ...item, queuedAt: Date.now() });
            if (queue.length >= minBatchSize) {
                return flush();
            }
            scheduleFlush();
            return Promise.resolve();
        },
        size() {
            return queue.length;
        },
        flush,
    };
}
