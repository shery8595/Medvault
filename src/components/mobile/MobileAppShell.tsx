import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNativeApp } from "../../lib/mobile";
import { MobileNetworkBanner } from "./MobileNetworkBanner";

type MobileAppShellProps = {
  children: ReactNode;
};

/**
 * Native-only shell: Android back button, status bar, splash hide, connectivity banner.
 */
export function MobileAppShell({ children }: MobileAppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNativeApp()) return;

    void SplashScreen.hide().catch(() => undefined);
    void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => undefined);

    const sub = CapApp.addListener("backButton", ({ canGoBack }) => {
      const path = location.pathname;
      const atAppRoot =
        path === "/" ||
        path === "/patient/dashboard" ||
        path === "/sponsor/dashboard";

      if (atAppRoot) {
        void CapApp.minimizeApp();
        return;
      }

      if (canGoBack) {
        navigate(-1);
        return;
      }

      void CapApp.minimizeApp();
    });

    return () => {
      void sub.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate]);

  if (!isNativeApp()) {
    return <>{children}</>;
  }

  return (
    <div className="native-safe min-h-[100dvh]">
      <MobileNetworkBanner />
      {children}
    </div>
  );
}
