import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ElementType } from "react";
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
  FlaskConical,
  Fingerprint,
  Settings,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useWeb3 } from "../../lib/Web3Context";
import { getContract } from "../../lib/contracts";
import brandLogoUrl from "../../../logo/logo.png";

const patientNavItems = [
  { title: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
  { title: "Medical Vault", href: "/patient/medical-vault", icon: ShieldCheck },
  { title: "Find Trials", href: "/patient/find-trials", icon: Search },
  { title: "Consent Logs", href: "/patient/consent-logs", icon: FileText },
];

const sponsorNavItems = [
  { title: "Dashboard", href: "/sponsor/dashboard", icon: LayoutDashboard },
  { title: "Active Trials", href: "/sponsor/active-trials", icon: Activity },
  { title: "Patient Matches", href: "/sponsor/patient-matches", icon: Users },
  { title: "Analytics", href: "/sponsor/analytics", icon: Database },
  { title: "Audit Logs", href: "/sponsor/audit-logs", icon: ShieldCheck },
  { title: "Profile Settings", href: "/sponsor/profile-settings", icon: User },
  { title: "Verification", href: "/sponsor/verification", icon: ClipboardCheck },
];

const patientSecondaryNavItems = [
  { title: "My Applications", href: "/patient/applications", icon: FlaskConical },
  { title: "Results", href: "/patient/results", icon: ClipboardCheck },
  { title: "Privacy demo (60s)", href: "/patient/privacy-tour", icon: Sparkles },
  { title: "Identity & Privacy", href: "/patient/identity", icon: Fingerprint },
  { title: "Settings", href: "/patient/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Sponsors", href: "/admin/sponsors", icon: Users },
  { title: "Protocol wiring", href: "/admin/wiring", icon: ShieldCheck },
];

interface SidebarProps {
  role: "patient" | "sponsor";
  collapsed?: boolean;
}

export function Sidebar({ role, collapsed = false }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, account, readOnlyProvider } = useWeb3();
  const [isProtocolOwner, setIsProtocolOwner] = useState(false);
  const navItems = role === "patient" ? patientNavItems : sponsorNavItems;
  const homeLink = role === "patient" ? "/patient/dashboard" : "/sponsor/dashboard";
  const portalName = role === "patient" ? "Patient" : "Sponsor";
  const isPatient = role === "patient";

  useEffect(() => {
    if (!account || !readOnlyProvider) {
      setIsProtocolOwner(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const registry = getContract("SponsorRegistry", readOnlyProvider);
        const owner = (await registry.owner()) as string;
        if (!cancelled) {
          setIsProtocolOwner(owner.toLowerCase() === account.toLowerCase());
        }
      } catch {
        if (!cancelled) setIsProtocolOwner(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account, readOnlyProvider]);

  const isItemActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  const NavItem = ({
    title,
    href,
    icon: Icon,
  }: {
    title: string;
    href: string;
    icon: ElementType;
  }) => {
    const isActive = isItemActive(href);
    const patientClasses = isActive
      ? "bg-teal-50 text-teal-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-800";
    const sponsorClasses = isActive
      ? "bg-[#1D2634] text-white shadow-sm ring-1 ring-[#1D2634]"
      : "text-slate-600 hover:bg-[#1D2634]/10 hover:text-[#1D2634]";

    return (
      <Link
        to={href}
        title={collapsed ? title : undefined}
        aria-label={collapsed ? title : undefined}
        className={cn(
          "group flex items-center rounded-xl text-sm font-semibold transition-all",
          collapsed ? "justify-center p-2.5" : "gap-2.5 rounded-full px-3.5 py-2.5",
          isPatient ? patientClasses : sponsorClasses
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed ? <span className="truncate">{title}</span> : null}
      </Link>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        isPatient ? "bg-white" : "bg-slate-50"
      )}
    >
      <div
        className={cn(
          "shrink-0 pb-4",
          collapsed ? "flex justify-center px-2 pt-5" : "border-b px-5 pt-6 pb-4",
          isPatient ? (!collapsed ? "border-slate-100" : "") : !collapsed ? "border-slate-200" : ""
        )}
      >
        <Link
          to={homeLink}
          title="MedVault home"
          className={cn("flex min-w-0 items-center", collapsed ? "justify-center" : "gap-3")}
        >
          <img
            src={brandLogoUrl}
            alt=""
            width={40}
            height={40}
            className={cn("shrink-0 rounded-xl object-contain", collapsed ? "h-9 w-9" : "h-10 w-10")}
            aria-hidden
          />
          {!collapsed ? (
            <div className="min-w-0">
              <p className="font-bold text-slate-800 leading-none">MedVault</p>
              <p
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider mt-1",
                  isPatient ? "text-teal-700/80" : "text-[#1D2634]"
                )}
              >
                {portalName} Console
              </p>
            </div>
          ) : null}
        </Link>
      </div>

      <nav
        className={cn("shrink-0 space-y-1 pb-3", collapsed ? "px-2 pt-3" : "px-3 pt-4")}
        aria-label="Main navigation"
      >
        {navItems.map((item) => (
          <NavItem key={item.href} title={item.title} href={item.href} icon={item.icon} />
        ))}
      </nav>

      {role === "patient" ? (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            !collapsed && "border-t border-slate-100"
          )}
        >
          {!collapsed ? (
            <p className="shrink-0 px-5 pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Patient area
            </p>
          ) : null}
          <div
            className={cn(
              "min-h-0 flex-1 space-y-1.5 overflow-y-auto scrollbar-hide",
              collapsed ? "px-2 pb-3" : "px-4 pb-3"
            )}
          >
            {patientSecondaryNavItems.map((item) => (
              <NavItem key={item.href} title={item.title} href={item.href} icon={item.icon} />
            ))}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1" aria-hidden />
      )}

      {isProtocolOwner ? (
        <div
          className={cn(
            "shrink-0",
            !collapsed && "border-t border-slate-200 px-3 pt-3 pb-2",
            collapsed && "px-2 pt-2"
          )}
        >
          {!collapsed ? (
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Admin
            </p>
          ) : null}
          <div className="space-y-1">
            {adminNavItems.map((item) => (
              <NavItem key={item.href} title={item.title} href={item.href} icon={item.icon} />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "shrink-0 py-4",
          collapsed ? "px-2" : "px-3",
          isPatient ? "border-t border-slate-100" : "border-t border-slate-200"
        )}
      >
        <button
          type="button"
          title={collapsed ? "Log out" : undefined}
          onClick={() => {
            void (async () => {
              await logout();
              navigate("/");
            })();
          }}
          className={cn(
            "flex w-full items-center text-sm font-semibold transition-all",
            collapsed ? "justify-center rounded-xl p-2.5" : "gap-2.5 rounded-full px-3.5 py-2.5 text-left",
            isPatient
              ? "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              : "text-slate-500 hover:bg-slate-200 hover:text-slate-800"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed ? <span>Log out</span> : null}
        </button>
      </div>
    </div>
  );
}
