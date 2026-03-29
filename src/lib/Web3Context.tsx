/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { getFHEInstance, connectFHE } from "./fhe";

interface Web3ContextType {
    account: string | null;
    signer: ethers.Signer | null;
    provider: ethers.Provider | null;
    readOnlyProvider: ethers.Provider | null;
    connect: () => Promise<void>;
    isFHEReady: boolean;
    isConnecting: boolean;
    error: string | null;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
    const [account, setAccount] = useState<string | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [provider, setProvider] = useState<ethers.Provider | null>(null);
    const [readOnlyProvider, setReadOnlyProvider] = useState<ethers.Provider | null>(null);
    const [isFHEReady, setIsFHEReady] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const SEPOLIA_CHAIN_ID = "0x66eee"; // 421614 (Arbitrum Sepolia)
    const RPC_URL = import.meta.env.VITE_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

    useEffect(() => {
        const rp = new ethers.JsonRpcProvider(RPC_URL);
        setReadOnlyProvider(rp);
    }, []);

    const connect = async () => {
        if (typeof window.ethereum === "undefined") {
            setError("MetaMask not found");
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Enforce Network
            const chainId = await window.ethereum.request({ method: "eth_chainId" });
            if (chainId !== SEPOLIA_CHAIN_ID) {
                try {
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: SEPOLIA_CHAIN_ID }],
                    });
                } catch (switchError: any) {
                    if (switchError.code === 4902) {
                        await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: SEPOLIA_CHAIN_ID,
                                chainName: "Arbitrum Sepolia",
                                nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
                                rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
                                blockExplorerUrls: ["https://sepolia.arbiscan.io"],
                            }],
                        });
                    } else {
                        throw switchError;
                    }
                }
            }

            const ethProvider = new ethers.BrowserProvider(window.ethereum);
            const ethSigner = await ethProvider.getSigner();
            const address = await ethSigner.getAddress();

            setProvider(ethProvider);
            setSigner(ethSigner);
            setAccount(address);

            // Initialize FHE
            console.log("Web3Context: Initializing FHE...");
            await connectFHE(ethProvider, ethSigner);
            console.log("Web3Context: FHE Ready.");
            setIsFHEReady(true);
        } catch (err: any) {
            console.error("Connection error:", err);
            setError(err.message || "Failed to connect wallet");
        } finally {
            setIsConnecting(false);
        }
    };

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", (accounts: string[]) => {
                if (accounts.length > 0) {
                    connect();
                } else {
                    setAccount(null);
                    setSigner(null);
                }
            });

            window.ethereum.on("chainChanged", () => {
                window.location.reload();
            });
        }
    }, []);

    return (
        <Web3Context.Provider
            value={{
                account,
                signer,
                provider,
                readOnlyProvider,
                connect,
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
