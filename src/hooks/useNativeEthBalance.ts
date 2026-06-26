import { useCallback, useEffect, useState } from "react";
import { useWeb3 } from "../lib/Web3Context";

const REFRESH_MS = 20_000;

/**
 * Native ETH balance for the active account on the read-only Ethereum Sepolia provider.
 * Used for gas / FHE tx prompts; not the confidential(vault) balance.
 */
export function useNativeEthBalance() {
  const { account, readOnlyProvider } = useWeb3();
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!readOnlyProvider || !account) {
      setBalanceWei(null);
      return;
    }
    setLoading(true);
    try {
      const wei = await readOnlyProvider.getBalance(account);
      setBalanceWei(wei);
    } catch {
      setBalanceWei(null);
    } finally {
      setLoading(false);
    }
  }, [readOnlyProvider, account]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => {
      void refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { balanceWei, loading, refresh };
}
