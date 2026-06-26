import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { WifiOff } from "lucide-react";
import { isNativeApp } from "../../lib/mobile";

export function MobileNetworkBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;

    void Network.getStatus().then((status) => {
      if (!cancelled) setOffline(!status.connected);
    });

    const listener = Network.addListener("networkStatusChange", (status) => {
      setOffline(!status.connected);
    });

    return () => {
      cancelled = true;
      void listener.then((handle) => handle.remove());
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] flex items-center justify-center gap-2 border-b border-amber-300/40 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      No internet connection. MedVault needs network access for wallet, FHE, and relayer calls.
    </div>
  );
}
