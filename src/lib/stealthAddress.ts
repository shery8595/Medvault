import { ethers } from "ethers";

/** One-time stealth recipient for public ETH exits (user controls private key). */
export function generateStealthRecipient(): {
  address: string;
  privateKey: string;
} {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}
