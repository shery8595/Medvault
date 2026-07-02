import { ZamaSDK, memoryStorage } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/ethers";
import { node } from "@zama-fhe/sdk/node";
import { sepolia } from "@zama-fhe/sdk/chains";

export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;

/**
 * @param {import('ethers').Wallet} relayerWallet
 * @param {string} rpcUrl
 * @param {string | undefined} zamaRelayerUrl
 */
export async function createZamaClient(relayerWallet, rpcUrl, zamaRelayerUrl) {
    const chain = {
        ...sepolia,
        id: ETHEREUM_SEPOLIA_CHAIN_ID,
        network: rpcUrl,
        relayerUrl: zamaRelayerUrl || sepolia.relayerUrl,
    };

    const config = createConfig({
        chains: [chain],
        signer: relayerWallet,
        relayers: { [chain.id]: node() },
        storage: memoryStorage,
    });

    return new ZamaSDK(config);
}

function toHandleHex(value) {
    if (typeof value === "string" && value.startsWith("0x")) {
        return value.length === 66 ? value : `0x${BigInt(value).toString(16).padStart(64, "0")}`;
    }
    if (typeof value === "bigint") {
        return `0x${value.toString(16).padStart(64, "0")}`;
    }
    return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

/**
 * KMS public decrypt for handles marked `makePubliclyDecryptable` on-chain.
 * Returns uint64 transferable units (0 when insufficient).
 * @param {ZamaSDK} sdk
 * @param {string | bigint} handle
 */
export async function publicDecryptProof(sdk, handle) {
    const handleHex = toHandleHex(handle);
    const result = await sdk.decryption.decryptPublicValues([handleHex]);
    const first = Object.values(result.clearValues)[0];
    const units =
        typeof first === "boolean"
            ? first
                ? 1n
                : 0n
            : BigInt(first);

    return {
        units,
        /** @deprecated use `units > 0n` — kept for watcher compatibility */
        eligible: units > 0n,
        transferable: units > 0n,
        cleartexts: result.abiEncodedClearValues,
        proof: result.decryptionProof,
    };
}
