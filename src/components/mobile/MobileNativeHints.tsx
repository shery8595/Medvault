import { AlertCircle } from "lucide-react";
import { useWeb3 } from "../../lib/Web3Context";
import { isNativeApp } from "../../lib/mobile";

/**
 * Native APK helper: surfaces wallet/FHE setup issues with mobile-specific guidance.
 */
export function MobileNativeHints() {
  const { error, isFHEReady, isConnecting, account } = useWeb3();

  if (!isNativeApp()) return null;

  if (isConnecting) {
    return (
      <div className="mx-4 mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:mx-5">
        Connecting wallet and FHE on device… first launch can take a minute while crypto modules load.
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mx-4 mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 md:mx-5"
      >
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Wallet setup failed</p>
          <p className="mt-0.5 text-red-800">{error}</p>
          <p className="mt-1 text-red-700/90">
            Use Privy email login and an embedded wallet. Add <code className="text-[10px]">https://localhost</code> in
            your Privy dashboard allowed origins.
          </p>
        </div>
      </div>
    );
  }

  if (account && !isFHEReady) {
    return (
      <div
        role="status"
        className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 md:mx-5"
      >
        Zama FHE is still initializing. Encrypted vault actions unlock once setup completes.
      </div>
    );
  }

  return null;
}
