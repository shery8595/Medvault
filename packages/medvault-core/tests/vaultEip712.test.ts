import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveEphemeralAddress, signRegisterAuthorization, VAULT_EIP712_DOMAIN } from "../src/sponsor/vaultEip712.js";

describe("vaultEip712", () => {
  const identitySecret = 1234567890123456789012345678901234567890123456789012345678901234n;
  const vaultAddress = "0x00000000000000000000000000000000000000ab";
  const chainId = 11155111n;

  it("derives stable ephemeral address from identity secret", async () => {
    const a = await deriveEphemeralAddress(identitySecret);
    const b = await deriveEphemeralAddress(identitySecret.toString());
    assert.equal(a, b);
    assert.match(a, /^0x[0-9a-fA-F]{40}$/);
  });

  it("signs RegisterAuthorization typed data", async () => {
    const signature = await signRegisterAuthorization(identitySecret, chainId, vaultAddress, {
      trialId: 7n,
      nullifier: 42n,
      permitHolder: "0x0000000000000000000000000000000000000001",
      nonce: 1n,
      deadline: 9999999999n,
    });
    assert.match(signature, /^0x[0-9a-fA-F]+$/);
    assert.equal(VAULT_EIP712_DOMAIN.name, "MedVault SponsorIncentiveVault");
  });
});
