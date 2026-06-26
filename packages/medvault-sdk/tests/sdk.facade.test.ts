import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { MedVaultSDK, serializeProofForRelay, NOT_ELIGIBLE_FOR_TRIAL_ERROR_MESSAGE } from "../src/index.js";

describe("MedVaultSDK", () => {
  it("throws when listing trials without subgraphUrl", async () => {
    const sdk = MedVaultSDK.create({
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      subgraphUrl: "",
    });
    await assert.rejects(
      () => sdk.trials.listActive(),
      /subgraphUrl is required/
    );
  });

  it("exposes protocol addresses for sepolia", () => {
    const sdk = MedVaultSDK.create({
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      subgraphUrl: "https://example.com/subgraph",
    });
    const addresses = sdk.protocol.getAddresses();
    assert.ok(addresses.TrialManager);
    assert.ok(addresses.MedVaultRegistry);
  });

  it("serializeProofForRelay stringifies bigint-like fields", () => {
    const serialized = serializeProofForRelay({
      merkleTreeDepth: 20,
      merkleTreeRoot: "123",
      nullifier: "456",
      message: "789",
      scope: "0",
      points: ["1", "2", "3", "4", "5", "6", "7", "8"],
    });
    assert.equal(serialized.merkleTreeDepth, 20);
    assert.equal(serialized.nullifier, "456");
    assert.equal(serialized.points.length, 8);
  });

  it("finalizeApply posts stageTxHash to relayer", async () => {
    const originalFetch = globalThis.fetch;
    let postedBody: Record<string, unknown> | undefined;
    globalThis.fetch = mock.fn(async (_url, init) => {
      postedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ success: true, txHash: "0xabc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const sdk = MedVaultSDK.create({
        relayerUrl: "https://relayer.test",
        subgraphUrl: "https://example.com/subgraph",
      });
      const txHash = await sdk.relayer.finalizeApply({
        trialId: 1,
        proof: {
          merkleTreeDepth: 20,
          merkleTreeRoot: "1",
          nullifier: "2",
          message: "3",
          scope: "4",
          points: ["0", "0", "0", "0", "0", "0", "0", "0"],
        },
        commitment: "99",
        permitRecipient: "0x0000000000000000000000000000000000000001",
        stageTxHash: "0xstage",
      });
      assert.equal(txHash, "0xabc");
      assert.equal(postedBody?.stageTxHash, "0xstage");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("relayer.health parses JSON from fetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ status: "ok", registry: "0xabc" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const sdk = MedVaultSDK.create({
        relayerUrl: "https://relayer.test",
        subgraphUrl: "https://example.com/subgraph",
      });
      const health = await sdk.relayer.health();
      assert.equal(health.status, "ok");
      assert.equal(health.registry, "0xabc");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("relayer.stageApply surfaces relayer error body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(async () => {
      return new Response(JSON.stringify({ error: "Invalid proof" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const sdk = MedVaultSDK.create({
        relayerUrl: "https://relayer.test",
        subgraphUrl: "https://example.com/subgraph",
      });
      await assert.rejects(
        () =>
          sdk.relayer.stageApply({
            trialId: 1,
            proof: {
              merkleTreeDepth: 20,
              merkleTreeRoot: "1",
              nullifier: "2",
              message: "3",
              scope: "4",
              points: ["0", "0", "0", "0", "0", "0", "0", "0"],
            },
            commitment: "99",
            permitRecipient: "0x0000000000000000000000000000000000000001",
          }),
        /Invalid proof/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
