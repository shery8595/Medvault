import { sepolia as sepoliaFhe, type FheChain } from "@zama-fhe/sdk/chains";
import { getZamaRelayerUrl } from "./mobile";

export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
export const ETHEREUM_SEPOLIA_HEX = "0xaa36a7";

export { getZamaRelayerUrl } from "./mobile";

export function getSepoliaRpcUrl(): string {
    return (
        import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
        import.meta.env.VITE_RPC_URL?.trim() ||
        "https://ethereum-sepolia-rpc.publicnode.com"
    );
}

export function buildZamaFheChain(rpcUrl?: string): FheChain {
    return {
        ...sepoliaFhe,
        network: rpcUrl ?? getSepoliaRpcUrl(),
        relayerUrl: getZamaRelayerUrl(),
    } as FheChain;
}
