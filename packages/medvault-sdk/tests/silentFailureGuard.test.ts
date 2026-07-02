import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import {
    SilentFailureDetected,
    assertConfidentialTransferSucceeded,
    captureRecipientBalanceBefore,
} from "../src/modules/silentFailureGuard.js";

describe("silentFailureGuard", () => {
    const tokenAddress = "0x00000000000000000000000000000000000000c1";
    const recipient = "0x00000000000000000000000000000000000000b1";

    function mockProvider(): ethers.Provider {
        let call = 0;
        return {
            async call() {
                const handle = ethers.zeroPadValue(ethers.toBeHex(call), 32);
                call++;
                return handle;
            },
        } as unknown as ethers.Provider;
    }

    function mockSdk(sequence: bigint[]) {
        let idx = 0;
        return {
            permits: { grantPermit: async () => {} },
            decryption: {
                decryptValues: async (items: { encryptedValue: string }[]) => ({
                    [items[0]!.encryptedValue]: sequence[idx++] ?? 0n,
                }),
            },
        };
    }

    it("detects silent failure when intendedAmount > 0 and delta === 0", async () => {
        const provider = mockProvider();
        const sdk = mockSdk([0n, 0n]);
        const before = await captureRecipientBalanceBefore(sdk, tokenAddress, recipient, provider);
        await assert.rejects(
            () =>
                assertConfidentialTransferSucceeded({
                    tokenAddress,
                    recipient,
                    intendedAmount: 5n,
                    provider,
                    sdk,
                    balanceBefore: before,
                }),
            SilentFailureDetected
        );
    });

    it("no false-positive when handles differ but plaintext increased", async () => {
        const provider = mockProvider();
        const sdk = mockSdk([1n, 4n]);
        const before = await captureRecipientBalanceBefore(sdk, tokenAddress, recipient, provider);
        const delta = await assertConfidentialTransferSucceeded({
            tokenAddress,
            recipient,
            intendedAmount: 3n,
            provider,
            sdk,
            balanceBefore: before,
        });
        assert.equal(delta, 3n);
    });
});
