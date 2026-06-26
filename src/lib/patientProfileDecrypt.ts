import type { Signer } from "ethers";
import { getAnonymousPatientRegistry, resolveChainIdFrom } from "./contracts";
import { decryptForView, FheTypes } from "./fhe";

function ctHandle(h: bigint | string): bigint {
  if (typeof h === "bigint") return h;
  return BigInt(h);
}

export type DecryptedPatientProfile = {
  age: number;
  genderMale: boolean;
  weight: number;
  height: number;
  hasDiabetes: boolean;
  hbLevel: number;
  isSmoker: boolean;
  hasHypertension: boolean;
};

/**
 * Loads ciphertext handles from AnonymousPatientRegistry and decrypts them for UI display.
 */
export async function fetchAndDecryptPatientProfile(
  signer: Signer,
  commitment: bigint | string
): Promise<DecryptedPatientProfile> {
  const chainId = await resolveChainIdFrom(signer);
  const registry = getAnonymousPatientRegistry(signer, chainId);
  const aprAddress = await registry.getAddress();
  const p = await registry.getPatient.staticCall(commitment);
  if (!p.exists) {
    throw new Error("No encrypted profile on-chain.");
  }

  const age = await decryptForView(ctHandle(p.age), FheTypes.Uint8, aprAddress);
  const gender = await decryptForView(ctHandle(p.gender), FheTypes.Bool, aprAddress);
  const weight = await decryptForView(ctHandle(p.weight), FheTypes.Uint16, aprAddress);
  const height = await decryptForView(ctHandle(p.height), FheTypes.Uint8, aprAddress);
  const hasDiabetes = await decryptForView(ctHandle(p.hasDiabetes), FheTypes.Bool, aprAddress);
  const hbLevel = await decryptForView(ctHandle(p.hbLevel), FheTypes.Uint16, aprAddress);
  const isSmoker = await decryptForView(ctHandle(p.isSmoker), FheTypes.Bool, aprAddress);
  const hasHypertension = await decryptForView(ctHandle(p.hasHypertension), FheTypes.Bool, aprAddress);

  return {
    age: Number(age),
    genderMale: Boolean(gender),
    weight: Number(weight),
    height: Number(height),
    hasDiabetes: Boolean(hasDiabetes),
    hbLevel: Number(hbLevel),
    isSmoker: Boolean(isSmoker),
    hasHypertension: Boolean(hasHypertension),
  };
}
