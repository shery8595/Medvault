import { Bell, User, Wallet, ShieldCheck, Loader2, BookOpen } from "lucide-react";
import { Button } from "../ui/Button";
import { useWeb3 } from "../../lib/Web3Context";
import { cn } from "../../lib/utils";

interface HeaderProps {
  role?: "patient" | "sponsor";
}

export function Header({ role }: HeaderProps) {
  const { account, connect, isConnecting, isFHEReady } = useWeb3();

  // Helper to format address
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className={cn(
      "flex h-16 items-center justify-between border-b border-white/5 px-6 z-20 sticky top-0 transition-colors duration-500",
      role === "patient" ? "bg-[#020617]" : "glass-panel !rounded-none !border-t-0 !border-x-0"
    )}>
      <div className="flex items-center gap-0 group cursor-pointer md:hidden" onClick={() => window.location.href = '/'}>
        <div className="flex h-12 w-20 items-center justify-center transition-all duration-300 group-hover:scale-110 -mr-2">
          <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain drop-shadow-xl" />
        </div>
        <h1 className="text-xl font-bold text-slate-50 tracking-tight">
          Med<span className="text-accent">Vault</span>
        </h1>
      </div>
      
      {/* Spacer for desktop since sidebar has logo */}
      <div className="hidden md:block flex-1" />

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => window.location.href = '/docs'} className="text-slate-400 hover:text-accent hover:bg-white/5 transition-colors" title="Documentation">
          <BookOpen className="h-5 w-5" />
        </Button>

        <div className="h-8 w-px bg-white/10 hidden md:block" />

        {!account ? (
          <Button
            onClick={connect}
            disabled={isConnecting}
            className="bg-accent text-white font-black text-[10px] uppercase tracking-widest px-4 h-9 rounded-xl shadow-[0_0_15px_var(--color-accent)] transition-all hover:scale-105 active:scale-95 border border-accent/50"
          >
            {isConnecting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-2" />
            ) : (
              <Wallet className="h-3 w-3 mr-2" />
            )}
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Connected</span>
              <span className="text-xs font-mono font-bold text-slate-200 tracking-tight">
                {formatAddress(account)}
              </span>
            </div>
            <div className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center font-bold relative transition-all",
              isFHEReady
                ? "bg-accent/20 text-accent border border-accent/30 shadow-[0_0_10px_var(--color-accent)]"
                : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
            )}>
              <User className="h-4 w-4" />
              {isFHEReady && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent border-2 border-slate-950 shadow-[0_0_8px_var(--color-accent)]" />
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
