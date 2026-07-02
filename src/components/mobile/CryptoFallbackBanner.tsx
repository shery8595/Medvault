import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { isUsingCryptoFallback } from "../../lib/mobile";

/**
 * Shown when WebCrypto AES-256-GCM is unavailable and the @noble/ciphers fallback is active.
 */
export function CryptoFallbackBanner() {
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void isUsingCryptoFallback().then((active) => {
      if (!cancelled) setFallbackActive(active);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!fallbackActive) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[99] flex items-center justify-center gap-2 border-b border-sky-300/40 bg-sky-50 px-4 py-2 text-center text-xs font-medium text-sky-950"
    >
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      Secure document encryption is using the compatibility fallback on this device. Your data remains
      AES-256-GCM encrypted.
    </div>
  );
}
