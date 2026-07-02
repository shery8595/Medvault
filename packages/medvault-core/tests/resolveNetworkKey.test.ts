import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveNetworkKey, getContract } from "../src/contracts/index.js";
import { ethers } from "ethers";

describe("resolveNetworkKey", () => {
  it("RNK-01: maps sepolia and hardhat", () => {
    assert.equal(resolveNetworkKey(11155111), "sepolia");
    assert.equal(resolveNetworkKey(31337), "hardhat");
  });

  it("RNK-02: throws on unknown chainId", () => {
    assert.throws(() => resolveNetworkKey(1), /Unsupported chainId/);
  });

  it("RNK-03: getContract rejects zero address entries", () => {
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    const contract = getContract("MedVaultRegistry", provider, "hardhat");
    assert.notEqual(String(contract.target).toLowerCase(), ethers.ZeroAddress.toLowerCase());
  });
});
