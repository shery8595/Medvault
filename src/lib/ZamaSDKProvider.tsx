import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider, useZamaSDK } from "@zama-fhe/react-sdk";
import { createConfig } from "@zama-fhe/sdk/ethers";
import { indexedDBStorage, type ZamaConfig } from "@zama-fhe/sdk";
import { web } from "@zama-fhe/sdk/web";
import type { EIP1193Provider } from "viem";
import { useWeb3 } from "./Web3Context";
import { buildZamaFheChain, getSepoliaRpcUrl } from "./zamaChain";
import { setMainZamaSDK } from "./fhe";

type ZamaSDKProviderProps = {
    children: ReactNode;
};

function ZamaSdkBridge({ children }: { children: ReactNode }) {
    const sdk = useZamaSDK();
    useEffect(() => {
        setMainZamaSDK(sdk);
        return () => setMainZamaSDK(null);
    }, [sdk]);
    return <>{children}</>;
}

export function ZamaSDKProvider({ children }: ZamaSDKProviderProps) {
    const { account, ethereum, readOnlyProvider } = useWeb3();
    const [config, setConfig] = useState<ZamaConfig | null>(null);
    const queryClient = useMemo(() => new QueryClient(), []);

    useEffect(() => {
        if (!account || !ethereum) {
            setConfig(null);
            setMainZamaSDK(null);
            return;
        }

        const rpcUrl = getSepoliaRpcUrl();
        const chain = buildZamaFheChain(rpcUrl);
        const next = createConfig({
            chains: [chain],
            ethereum: ethereum as EIP1193Provider,
            provider: readOnlyProvider ?? undefined,
            relayers: { [chain.id]: web() },
            storage: indexedDBStorage,
        });
        setConfig(next);

        return () => {
            setConfig(null);
            setMainZamaSDK(null);
        };
    }, [account, ethereum, readOnlyProvider]);

    if (!config) {
        return <>{children}</>;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ZamaProvider config={config}>
                <ZamaSdkBridge>{children}</ZamaSdkBridge>
            </ZamaProvider>
        </QueryClientProvider>
    );
}
