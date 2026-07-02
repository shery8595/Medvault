import { expect } from "chai";

describe("Unit: batch exit queue", function () {
    it("BEX-01: flushes immediately when minBatchSize reached", async function () {
        const { createBatchExitQueue } = await import("../../relayer/batch-exit-queue.mjs");
        const flushed: unknown[] = [];
        const queue = createBatchExitQueue({
            minBatchSize: 2,
            maxWaitMs: 60_000,
            onFlush: async (item) => {
                flushed.push(item);
            },
        });

        await queue.enqueue({ id: "a" });
        expect(flushed.length).to.equal(0);
        expect(queue.size()).to.equal(1);

        await queue.enqueue({ id: "b" });
        expect(flushed.length).to.equal(2);
        expect(queue.size()).to.equal(0);
    });

    it("BEX-02: flushes after maxWaitMs timeout", async function () {
        const { createBatchExitQueue } = await import("../../relayer/batch-exit-queue.mjs");
        const flushed: unknown[] = [];
        const queue = createBatchExitQueue({
            minBatchSize: 5,
            maxWaitMs: 30,
            onFlush: async (item) => {
                flushed.push(item);
            },
        });

        await queue.enqueue({ id: "solo" });
        expect(flushed.length).to.equal(0);

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(flushed.length).to.equal(1);
    });

    it("BEX-03: manual flush drains queue", async function () {
        const { createBatchExitQueue } = await import("../../relayer/batch-exit-queue.mjs");
        const flushed: unknown[] = [];
        const queue = createBatchExitQueue({
            minBatchSize: 10,
            maxWaitMs: 120_000,
            onFlush: async (item) => {
                flushed.push(item);
            },
        });

        await queue.enqueue({ id: "x" });
        await queue.enqueue({ id: "y" });
        await queue.flush();
        expect(flushed.length).to.equal(2);
        expect(queue.size()).to.equal(0);
    });

    it("BEX-04: failed items are re-enqueued", async function () {
        const { createBatchExitQueue } = await import("../../relayer/batch-exit-queue.mjs");
        let attempts = 0;
        const queue = createBatchExitQueue({
            minBatchSize: 2,
            maxWaitMs: 60_000,
            onFlush: async () => {
                attempts += 1;
                throw new Error("flush failed");
            },
        });

        await queue.enqueue({ id: "a" });
        await queue.enqueue({ id: "b" });
        expect(attempts).to.equal(2);
        expect(queue.size()).to.equal(2);
    });
});
