import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { ethers } from "ethers";
import { usePrivy, useWallets, useCreateWallet, getEmbeddedConnectedWallet } from "@privy-io/react-auth";
import type { ConnectedWallet } from "@privy-io/react-auth";
import { resetZamaSDK } from "./fhe";
import { ETHEREUM_SEPOLIA_HEX, getSepoliaRpcUrl } from "./zamaChain";

interface Web3ContextType {
    account: string | null;
    signer: ethers.Signer | null;
    provider: ethers.Provider | null;
    readOnlyProvider: ethers.Provider | null;
    /** Raw EIP-1193 provider for Zama SDK wiring. */
    ethereum: unknown | null;
    chainId: bigint | null;
    connect: () => Promise<void>;
    logout: () => Promise<void>;
    isFHEReady: boolean;
    isConnecting: boolean;
    error: string | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

function pickEthereumWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
    return getEmbeddedConnectedWallet(wallets) ?? wallets[0];
}

async function ensureEthereumSepolia(eip1193: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}) {
    const chainId = await eip1193.request({ method: "eth_chainId" });
    if (typeof chainId === "string" && chainId.toLowerCase() === ETHEREUM_SEPOLIA_HEX.toLowerCase()) {
        return;
    }
    try {
        await eip1193.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ETHEREUM_SEPOLIA_HEX }],
        });
    } catch (switchError: unknown) {
        const code = (switchError as { code?: number })?.code;
        if (code === 4902) {
            await eip1193.request({
                method: "wallet_addEthereumChain",
                params: [
                    {
                        chainId: ETHEREUM_SEPOLIA_HEX,
                        chainName: "Ethereum Sepolia",
                        nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                        rpcUrls: [getSepoliaRpcUrl()],
                        blockExplorerUrls: ["https://sepolia.etherscan.io"],
                    },
                ],
            });
        } else {
            throw switchError;
        }
    }
}

export function Web3Provider({ children }: { children: ReactNode }) {
    const { ready: privyReady, authenticated, login, logout: privyLogout } = usePrivy();
    const { wallets, ready: walletsReady } = useWallets();
    const { createWallet } = useCreateWallet();

    const [account, setAccount] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [provider, setProvider] = useState<ethers.Provider | null>(null);
    const [ethereum, setEthereum] = useState<unknown | null>(null);
    const [readOnlyProvider, setReadOnlyProvider] = useState<ethers.Provider | null>(null);
    const [chainId, setChainId] = useState<bigint | null>(null);
    const [isFHEReady, setIsFHEReady] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const RPC_URL = getSepoliaRpcUrl();

    useEffect(() => {
        const rp = new ethers.JsonRpcProvider(RPC_URL);
        setReadOnlyProvider(rp);
    }, [RPC_URL]);

    const walletKey = useMemo(
        () => (authenticated ? wallets.map((w) => w.address).sort().join(",") : ""),
        [authenticated, wallets]
    );

    const connect = useCallback(async () => {
        setError(null);
        if (!privyReady) return;

        if (authenticated) {
            if (!walletsReady) {
                setIsConnecting(true);
                return;
            }
            if (wallets.length === 0) {
                setIsConnecting(true);
                try {
                    await createWallet();
                } catch (err: unknown) {
                    const msg = (err as Error)?.message || "";
                    console.error("createWallet failed:", err);
                    if (/already have an embedded wallet|already has/i.test(msg)) {
                        setError("Wallet exists but isn’t visible yet. Refresh the page or try again in a few seconds.");
                    } else {
                        setError(msg || "Could not create embedded wallet. You can try linking a wallet instead.");
                    }
                } finally {
                    setIsConnecting(false);
                }
                return;
            }
            return;
        }

        setIsConnecting(true);
        try {
            await login();
        } catch (err: unknown) {
            setError((err as Error)?.message || "Sign-in cancelled or failed");
            setIsConnecting(false);
        }
    }, [privyReady, authenticated, walletsReady, wallets.length, login, createWallet]);

    const logout = useCallback(async () => {
        setAccount(null);
        setSigner(null);
        setProvider(null);
        setEthereum(null);
        setChainId(null);
        setIsFHEReady(false);
        setError(null);
        resetZamaSDK();
        await privyLogout();
    }, [privyLogout]);

    useEffect(() => {
        if (!privyReady || !walletsReady) {
            return;
        }

        if (!authenticated) {
            setAccount(null);
            setSigner(null);
            setProvider(null);
            setEthereum(null);
            setChainId(null);
            setIsFHEReady(false);
            setIsConnecting(false);
            resetZamaSDK();
            return;
        }

        let cancelled = false;

        (async () => {
            setIsConnecting(true);
            setError(null);
            try {
                const w = pickEthereumWallet(wallets);
                if (!w) {
                    if (!cancelled) {
                        setError(
                            "No Ethereum wallet on this account. Click Log in and link or create a wallet (embedded or external)."
                        );
                    }
                    return;
                }
                const eip1193 = await w.getEthereumProvider();
                if (cancelled) return;

                await ensureEthereumSepolia(eip1193);
                if (cancelled) return;

                const ethProvider = new ethers.BrowserProvider(eip1193);
                const ethSigner = await ethProvider.getSigner();
                const address = await ethSigner.getAddress();
                const network = await ethProvider.getNetwork();

                if (cancelled) return;

                setEthereum(eip1193);
                setProvider(ethProvider);
                setSigner(ethSigner);
                setAccount(address);
                setChainId(network.chainId);
                setIsFHEReady(true);
            } catch (err: unknown) {
                if (!cancelled) {
                    console.error("Web3 / Zama connect error:", err);
                    setError((err as Error)?.message || "Failed to connect wallet for FHE");
                    setIsFHEReady(false);
                }
            } finally {
                if (!cancelled) {
                    setIsConnecting(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [privyReady, walletsReady, authenticated, walletKey, wallets]);

    return (
        <Web3Context.Provider
            value={{
                account,
                signer,
                provider,
                readOnlyProvider,
                ethereum,
                chainId,
                connect,
                logout,
                isFHEReady,
                isConnecting,
                error,
            }}
        >
            {children}
        </Web3Context.Provider>
    );
}

export function useWeb3() {
    const context = useContext(Web3Context);
    if (context === undefined) {
        throw new Error("useWeb3 must be used within a Web3Provider");
    }
    return context;
}
