/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PRIVY_APP_ID?: string;
    readonly VITE_RPC_URL?: string;
    readonly VITE_SEPOLIA_RPC_URL?: string;
    readonly VITE_SUBGRAPH_URL?: string;
    readonly VITE_TESTNET_FAUCET_URL?: string;
    /** Public faucet web page (opens in new tab). Not a JSON API. */
    readonly VITE_TESTNET_FAUCET_PAGE_URL?: string;
    /** Zama fhEVM relayer base URL (default: same-origin `/api/relayer/11155111` behind host proxy). */
    readonly VITE_ZAMA_RELAYER_URL?: string;
    /** MedVault anonymous-apply relayer HTTP origin. */
    readonly VITE_RELAYER_URL?: string;
    readonly VITE_RECLAIM_APP_ID?: string;
    readonly VITE_RECLAIM_APP_SECRET?: string;
    readonly VITE_RECLAIM_PROVIDER_ID?: string;
    readonly VITE_RECLAIM_ALLOW_SKIP?: string;
    readonly VITE_SPONSOR_OPEN_ACCESS?: string;
    readonly VITE_CAPACITOR_BUILD?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
