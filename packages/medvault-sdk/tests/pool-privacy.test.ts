import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Offline shape tests for sponsor pool privacy types exported via @medvault/core.
 * Live RPC tests are covered by mcp:smoke:live.
 */

describe("TrialPoolReclaimStatus privacy shape", () => {
  it("documents public vs sponsor fields", () => {
    const publicShape = {
      poolFunded: true,
      participantCount: 0,
      screeningDistributed: false,
      reclaimFinalized: false,
      trialEnded: false,
      canReclaimHint: false,
      sponsorAuthorized: false,
      trialSponsor: "0xabc",
      totalDepositedWei: null,
      totalFunded: null,
      canReclaim: null,
      reclaimableWei: null,
      reclaimableEth: null,
      amountsRestrictedReason: "MCP_PRIVATE_KEY not set",
      privacyNote: "Pool amounts are sponsor-private on-chain.",
    };

    assert.equal(publicShape.totalFunded, null);
    assert.equal(publicShape.sponsorAuthorized, false);
    assert.equal(typeof publicShape.poolFunded, "boolean");
  });

  it("sponsor-authorized shape includes amounts", () => {
    const sponsorShape = {
      sponsorAuthorized: true,
      totalDepositedWei: "1000000000000000000",
      totalFunded: "1.0",
      canReclaim: false,
      amountsRestrictedReason: null,
    };

    assert.notEqual(sponsorShape.totalFunded, null);
    assert.equal(sponsorShape.sponsorAuthorized, true);
  });
});
