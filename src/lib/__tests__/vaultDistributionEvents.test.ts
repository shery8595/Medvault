import { describe, expect, it } from "vitest";
import { ethers } from "ethers";
import { decodeCreditFailureReason } from "../vaultDistributionEvents";

describe("decodeCreditFailureReason", () => {
  it("decodes Error(string) revert data", () => {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["Missing participant nullifier"]);
    const reason = ethers.concat(["0x08c379a0", ethers.dataSlice(encoded, 0)]);
    expect(decodeCreditFailureReason(reason)).to.equal("Missing participant nullifier");
  });

  it("returns unknown for empty bytes", () => {
    expect(decodeCreditFailureReason("0x")).to.equal("unknown error");
  });
});
