import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Search,
  LogOut,
  Activity,
  ShieldCheck,
  Users,
  User,
  Database,
  ChevronRight,
  Shield,
  Zap,
  Lock,
  FlaskConical,
  ShieldAlert,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

const patientNavItems = [
  {
    title: "Dashboard",
    href: "/patient",
    icon: LayoutDashboard,
  },
  {
    title: "Medical Vault",
    href: "/patient/vault",
    icon: ShieldCheck,
  },
  {
    title: "Find Trials",
    href: "/patient/trials",
    icon: Search,
  },
  {
    title: "Consent Logs",
    href: "/patient/consent",
    icon: FileText,
  },
];

const sponsorNavItems = [
  {
    title: "Dashboard",
    href: "/sponsor",
    icon: LayoutDashboard,
  },
  {
    title: "Active Trials",
    href: "/sponsor/trials",
    icon: Activity,
  },
  {
    title: "Patient Matches",
    href: "/sponsor/matches",
    icon: Users,
  },
  {
    title: "Analytics",
    href: "/sponsor/analytics",
    icon: Database,
  },
  {
    title: "Audit Logs",
    href: "/sponsor/audit",
    icon: ShieldCheck,
  },
  {
    title: "Profile Settings",
    href: "/sponsor/settings",
    icon: User,
  },
  {
    title: "Sponsor Verification",
    href: "/admin/sponsors",
    icon: ShieldAlert,
  },
];

interface SidebarProps {
  role: "patient" | "sponsor";
}

export function Sidebar({ role }: SidebarProps) {
  const location = useLocation();
  const navItems = role === "patient" ? patientNavItems : sponsorNavItems;
  const homeLink = role === "patient" ? "/patient" : "/sponsor";
  const portalName = role === "patient" ? "Patient Interface" : "Sponsor Console";

  return (
    <div className="flex h-full w-[280px] flex-col bg-transparent transition-all duration-300">
      {/* ─── Premium Branding Header ─── */}
      <div className="relative flex h-24 items-center px-8">
        <Link to={homeLink} className="group flex items-center gap-0">
          <div className="relative flex h-14 w-24 items-center justify-center transition-transform duration-300 group-hover:scale-110 -mr-2">
            <img src="/logo.png" alt="MedVault Logo" className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-display text-lg font-bold tracking-tight text-white mt-1.5 drop-shadow-sm">
              Med<span className="text-accent">Vault</span>
            </span>
          </div>
        </Link>
      </div>

      {/* ─── Portal Indicator ─── */}
      <div className="px-8 mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-950/50 px-3 py-1 border border-white/5 shadow-inner">
          <div className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse shadow-[0_0_8px_var(--color-accent)]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
            {portalName}
          </span>
        </div>
      </div>

      {/* ─── Main Navigation ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-8 custom-scrollbar">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.05 } }
          }}
          className="space-y-6"
        >
          {/* Main Nav Section */}
          <motion.div variants={{
            hidden: { opacity: 0, x: -10 },
            visible: { opacity: 1, x: 0 }
          }}>
            <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 opacity-80">
              Main Menu
            </p>
            <div className="space-y-1.5">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || (item.href !== "/patient" && item.href !== "/sponsor" && location.pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={index}
                    to={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300",
                      isActive
                        ? "text-white bg-accent/20 border border-accent/20 shadow-[0_0_15px_rgba(var(--color-accent),0.2)]"
                        : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className="absolute left-0 w-1 h-6 bg-accent rounded-r-full shadow-[0_0_10px_var(--color-accent)]"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Icon className={cn(
                      "h-5 w-5 transition-all duration-300",
                      isActive ? "text-accent drop-shadow-[0_0_8px_var(--color-accent)]" : "text-slate-500 group-hover:text-accent/70"
                    )} />
                    <span className="flex-1 tracking-tight">{item.title}</span>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-accent/20 p-1 rounded-md border border-accent/20"
                      >
                        <ChevronRight className="h-3 w-3 text-accent" />
                      </motion.div>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* User Specific Section */}
          {role === "patient" && (
            <motion.div variants={{
              hidden: { opacity: 0, x: -10 },
              visible: { opacity: 1, x: 0 }
            }}>
              <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 opacity-80">
                Patient Area
              </p>
              <div className="space-y-1.5">
                <Link
                  to="/patient/applied"
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300",
                    location.pathname === "/patient/applied"
                      ? "text-white bg-accent/20 border border-accent/20 shadow-[0_0_15px_rgba(var(--color-accent),0.2)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  )}
                >
                  {location.pathname === "/patient/applied" && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 w-1 h-6 bg-accent rounded-r-full shadow-[0_0_10px_var(--color-accent)]"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <FlaskConical className={cn(
                    "h-5 w-5 transition-all duration-300",
                    location.pathname === "/patient/applied" ? "text-accent drop-shadow-[0_0_8px_var(--color-accent)]" : "text-slate-500 group-hover:text-accent/70"
                  )} />
                  <span className="flex-1 tracking-tight">My Applications</span>
                  {location.pathname === "/patient/applied" && (
                    <motion.div
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-accent/20 p-1 rounded-md border border-accent/20"
                    >
                      <ChevronRight className="h-3 w-3 text-accent" />
                    </motion.div>
                  )}
                </Link>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* ─── Security Widget & Logout ─── */}
      <div className="px-6 py-6 border-t border-white/5 bg-blue-950/20 backdrop-blur-md">
        <div className="space-y-6">
          <div className="relative group overflow-hidden rounded-2xl bg-blue-950/40 p-5 border border-accent/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:border-accent/50 hover:shadow-[0_0_25px_rgba(var(--color-accent),0.1)] transition-all duration-500">
            <div className="absolute top-0 right-0 -mr-3 -mt-3 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
              <Lock className="h-16 w-16 text-accent -rotate-12" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent border border-accent/30 shadow-[0_0_10px_var(--color-accent)]">
                  <ShieldCheck className="h-4 w-4 drop-shadow-[0_0_5px_var(--color-accent)]" />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">V3.2 Active</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-[13px] font-bold text-slate-100 tracking-tight">Full FHE Protection</h4>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed opacity-80">Privacy-preserving compute active.</p>
              </div>
              <div className="h-1 w-full bg-blue-900/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="h-full bg-accent shadow-[0_0_10px_var(--color-accent)]"
                />
              </div>
            </div>
          </div>

          <Link to="/" className="group flex items-center gap-3 rounded-xl px-5 py-3 text-sm font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-300">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 group-hover:bg-rose-500/20 transition-colors">
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </div>
            <span>Sign Out</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
