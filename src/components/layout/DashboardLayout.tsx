import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "patient" | "sponsor";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { pathname } = useLocation();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <div className={cn(
      "flex min-h-screen relative overflow-hidden dark transition-colors duration-500",
      role === "patient" ? "bg-[#020617]" : "bg-slate-950",
      "text-slate-50"
    )}>
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 blur-[100px] rounded-full pointer-events-none" />
      <aside className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-white/5 z-10 w-64 lg:w-72 hidden md:block transition-colors duration-500",
        role === "patient" ? "bg-[#020617]" : "glass-panel !rounded-none !border-y-0 !border-l-0"
      )}>
        <Sidebar role={role} />
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        <Header role={role} />
        <main ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10 scrollbar-hide">
          {children}
        </main>
      </div>
    </div>
  );
}
