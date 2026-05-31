import brandLogoUrl from "../../logo/logo.png";

/** Public PNGs used across patient/sponsor dashboards and docs (served from /public). */
export const APP_PNG_PATHS = [
  "/images/component_consentlogs.png",
  "/images/component_dashboard.png",
  "/images/financial_enclave_component.png",
  "/images/med_vault_component.png",
  "/images/sponsor_dashboard.png",
  "/images/active_trial_component.png",
  "/images/patient_matches_component.png",
  "/images/analytics_component.png",
  "/images/audit_component.png",
  "/assets/images/medvault_fhe_hero.png",
] as const;

const BUNDLED_IMAGE_URLS = [brandLogoUrl] as const;

/** Landing contact section background (large; warm cache for scroll). */
const EXTERNAL_IMAGE_URLS = [
  "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/77f55872-adf5-4910-9a7c-d21c0041bbe1_3840w.webp",
] as const;

function preloadUrl(href: string): void {
  const img = new Image();
  img.decoding = "async";
  img.src = href;
}

/**
 * Warm the browser image cache for UI illustrations so route changes do not flash empty placeholders.
 * Safe to call once at startup; duplicate calls are harmless (browser reuses cache).
 */
export function preloadAppImages(): void {
  if (typeof window === "undefined") return;

  for (const url of BUNDLED_IMAGE_URLS) preloadUrl(url);
  for (const path of APP_PNG_PATHS) preloadUrl(path);
  for (const url of EXTERNAL_IMAGE_URLS) preloadUrl(url);

  preloadUrl("/images/icon-wallet.svg");
}
