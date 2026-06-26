import { ETHEREUM_SEPOLIA_CHAIN_ID } from "./zamaChain";

export { ETHEREUM_SEPOLIA_CHAIN_ID };
export const ETHEREUM_SEPOLIA_NAME = "Ethereum Sepolia";
export const ETH_SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export const DEFAULT_PUBLIC_SEPOLIA_FAUCET_PAGE =
    "https://faucet.quicknode.com/ethereum/sepolia";

export const SEPOLIA_FAUCET_LINKS: { label: string; href: string }[] = [
    { label: "QuickNode", href: "https://faucet.quicknode.com/ethereum/sepolia" },
    { label: "Alchemy", href: "https://www.alchemy.com/faucets/ethereum-sepolia" },
    { label: "Chainlink", href: "https://faucets.chain.link/sepolia" },
];

export function txExplorerUrl(txHash: string): string {
    return `${ETH_SEPOLIA_EXPLORER}/tx/${txHash}`;
}

export function addressExplorerUrl(address: string): string {
    return `${ETH_SEPOLIA_EXPLORER}/address/${address}`;
}

export function chainDisplayName(chainId?: bigint | number | null): string {
    if (chainId == null) return "Not connected";
    const id = typeof chainId === "bigint" ? Number(chainId) : chainId;
    if (id === ETHEREUM_SEPOLIA_CHAIN_ID) return ETHEREUM_SEPOLIA_NAME;
    return `Chain ${id}`;
}

export function isEthereumSepolia(chainId?: bigint | number | null): boolean {
    if (chainId == null) return false;
    const id = typeof chainId === "bigint" ? Number(chainId) : chainId;
    return id === ETHEREUM_SEPOLIA_CHAIN_ID;
}
