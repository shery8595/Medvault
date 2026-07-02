import { expect } from "chai";

describe("Unit: watcher retry scheduling", function () {
    it("WR-01: batch queue re-enqueues after failed timed flush", async function () {
        const { createBatchExitQueue } = await import("../../relayer/batch-exit-queue.mjs");
        let attempts = 0;
        const queue = createBatchExitQueue({
            minBatchSize: 5,
            maxWaitMs: 30,
            onFlush: async () => {
                attempts += 1;
                if (attempts < 2) throw new Error("transient");
            },
        });

        await queue.enqueue({ id: "solo" });
        await new Promise((resolve) => setTimeout(resolve, 80));
        expect(attempts).to.be.greaterThan(1);
        expect(queue.size()).to.equal(0);
    });
});
