import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { arbSepolia } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";

declare global {
    interface Window {
        ethereum: any;
    }
}

// Global client instance
let client: any = null;

export async function getFHEClient() {
    if (client) return client;

    if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("Ethereum provider not available");
    }

    const config = createCofheConfig({
        supportedChains: [arbSepolia],
        useWorkers: false,
    });
    client = createCofheClient(config);

    return client;
}

export async function connectFHE(provider: any, signer: any) {
    const c = await getFHEClient();
    if (c && !c.connected) {
        const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);
        await c.connect(publicClient, walletClient);
    }
}

export async function getFHEInstance() {
    return getFHEClient();
}

// --- ENCRYPTION --- //

export async function encryptUint8(contractAddress: string, userAddress: string, value: number) {
    const c = await getFHEClient();
    const [encryptedAmount] = await c.encryptInputs([Encryptable.uint8(BigInt(value))]).execute();
    return encryptedAmount;
}

export async function encryptUint16(contractAddress: string, userAddress: string, value: number) {
    const c = await getFHEClient();
    const [encryptedAmount] = await c.encryptInputs([Encryptable.uint16(BigInt(value))]).execute();
    return encryptedAmount;
}

export async function encryptBool(contractAddress: string, userAddress: string, value: boolean) {
    const c = await getFHEClient();
    const [encryptedAmount] = await c.encryptInputs([Encryptable.bool(value)]).execute();
    return encryptedAmount;
}

// --- DECRYPTION --- //

export async function publicDecrypt(ciphertext: string) {
    // Usually public read state variables don't need decryption if they are plaintext on-chain,
    // but if it's an encrypted view, we use decryptForView.
    return { value: 0, proof: "" }; 
}

async function genericReencrypt(contractAddress: string, ciphertext: string, type: any) {
    const c = await getFHEClient();
    
    // Ensure we have a permit for the current account/chain
    // This will trigger a signature if not already present or active
    const permit = await c.permits.getOrCreateSelfPermit();
    
    // Use Fhenix async decryption view protocol with the signed permit
    const result = await c.decryptForView(ciphertext, type)
        .withPermit(permit)
        .execute();
    return result;
}

export async function reencryptUint8(contractAddress: string, userAddress: string, handle: string) {
    return genericReencrypt(contractAddress, handle, FheTypes.Uint8);
}

export async function reencryptUint32(contractAddress: string, userAddress: string, handle: string) {
    return genericReencrypt(contractAddress, handle, FheTypes.Uint32);
}

export async function reencryptUint64(contractAddress: string, userAddress: string, handle: string) {
    return genericReencrypt(contractAddress, handle, FheTypes.Uint64);
}

export function toHex(bytes: Uint8Array | string) {
    if (typeof bytes === "string") {
        return bytes.startsWith("0x") ? bytes : "0x" + bytes;
    }
    return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
