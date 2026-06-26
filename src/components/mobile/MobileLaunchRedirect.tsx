import { Navigate } from "react-router-dom";
import { isNativeApp } from "../../lib/mobile";

/**
 * On native APK builds, skip the heavy marketing landing page and open the patient hub.
 */
export function MobileLaunchRedirect() {
  if (!isNativeApp()) return null;
  return <Navigate to="/patient/dashboard" replace />;
}
