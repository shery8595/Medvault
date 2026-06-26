import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

type Props = {
  subgraphUrl?: string;
  className?: string;
};

/**
 * Warns when The Graph indexer meta block lags behind a simple eth_blockNumber read.
 */
export function IndexerHealthBanner({ subgraphUrl, className }: Props) {
  const [lagBlocks, setLagBlocks] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const url =
    subgraphUrl?.trim() ||
    (import.meta.env.VITE_SUBGRAPH_URL as string | undefined)?.trim() ||
    "";

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    const check = async () => {
      setChecking(true);
      try {
        const rpc =
          import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
          import.meta.env.VITE_RPC_URL?.trim() ||
          "https://ethereum-sepolia-rpc.publicnode.com";

        const [metaRes, blockRes] = await Promise.all([
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `{ _meta { block { number } } }`,
            }),
          }),
          fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_blockNumber",
              params: [],
            }),
          }),
        ]);

        const metaJson = await metaRes.json();
        const blockJson = await blockRes.json();
        const indexed = Number(metaJson?.data?._meta?.block?.number ?? 0);
        const head = parseInt(String(blockJson?.result ?? "0x0"), 16);
        if (!cancelled && indexed > 0 && head > 0) {
          setLagBlocks(Math.max(0, head - indexed));
        }
      } catch {
        if (!cancelled) setLagBlocks(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url]);

  if (!url || lagBlocks === null || lagBlocks < 30) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900",
        className
      )}
      role="status"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-bold">Indexer may be behind chain head</p>
        <p className="mt-0.5 text-amber-800/90">
          Subgraph is ~{lagBlocks} blocks behind Ethereum Sepolia. Dashboard counts may be stale until the indexer catches up.
          {checking ? " Refreshing…" : null}
        </p>
      </div>
      <RefreshCw className={cn("h-3.5 w-3.5 shrink-0 opacity-50", checking && "animate-spin")} aria-hidden />
    </div>
  );
}
