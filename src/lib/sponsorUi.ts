import { cn } from "./utils";

/** Sponsor console hero — light violet wash (dashboard, active trials, matches, analytics, audit). */
export const sponsorHeroShell =
  "relative overflow-hidden rounded-2xl border border-violet-100/80 bg-gradient-to-r from-[#f5f3ff] via-[#f0f4ff] to-[#eef6ff] ring-1 ring-violet-100/60";

export const sponsorHeroShadow = "shadow-[0_2px_16px_-4px_rgba(99,102,241,0.12)]";

/** Shared hero padding (dashboard, active trials, patient matches). */
export const sponsorHeroPadding = "px-6 py-4 md:px-7 md:py-5";

export const sponsorHeroGlow =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_55%_50%,rgba(139,92,246,0.08),transparent_70%)]";

/** Compact hero type — matches SponsorPageHero / dashboard. */
export const sponsorHeroEyebrow =
  "text-[13px] font-semibold uppercase tracking-[0.12em] text-violet-500/90";

export const sponsorHeroTitle =
  "font-display text-2xl font-semibold tracking-tight text-[#1a2744] md:text-3xl md:leading-snug";

export const sponsorHeroDescription =
  "max-w-lg text-[15px] leading-relaxed text-slate-600 md:text-base";

export const sponsorHeroIconBox =
  "flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100/90 text-violet-700 ring-1 ring-violet-200/80";

/** Absolute illustration anchored center-right in sponsor heroes. */
export const sponsorHeroIllustrationClass =
  "pointer-events-none absolute bottom-0 left-[60%] z-[1] hidden h-[188px] w-auto max-w-none -translate-x-[calc(50%+1%)] translate-y-[18%] object-contain object-bottom drop-shadow-[0_10px_24px_rgba(99,102,241,0.18)] sm:left-[62%] sm:block sm:h-[208px] lg:left-[64%] lg:h-[216px]";

/** Centered hero component art (+55% scale, 15% left nudge). */
export const sponsorHeroComponentArtClass =
  "mx-auto h-[174px] w-auto max-w-none -translate-x-[35%] object-contain object-center drop-shadow-[0_10px_22px_rgba(99,102,241,0.18)] sm:h-[198px] md:h-[211px] lg:h-[229px] pointer-events-none select-none";

/** @deprecated Use sponsorHeroComponentArtClass */
export const sponsorMatchesHeroArtClass = sponsorHeroComponentArtClass;

/** Hero grid: copy | illustration (analytics, audit). */
export const sponsorHeroTwoColumnArtGrid =
  "grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(140px,220px)] lg:items-center lg:gap-3";

/** ~20% smaller analytics / audit hero (padding, type, art, grid). */
export const sponsorHeroPaddingCompact = "px-5 py-3 md:px-6 md:py-4";

export const sponsorHeroComponentArtClassCompact =
  "mx-auto h-[139px] w-auto max-w-none -translate-x-[15%] object-contain object-center drop-shadow-[0_8px_18px_rgba(99,102,241,0.16)] sm:h-[158px] md:h-[169px] lg:h-[183px] pointer-events-none select-none";

export const sponsorHeroEyebrowCompact =
  "text-[11px] font-semibold uppercase tracking-[0.11em] text-violet-500/90";

export const sponsorHeroTitleCompact =
  "font-display text-xl font-semibold tracking-tight text-[#1a2744] md:text-[1.65rem] md:leading-snug";

export const sponsorHeroDescriptionCompact =
  "max-w-md text-sm leading-relaxed text-slate-600 md:text-[15px]";

export const sponsorHeroLinksCompact =
  "flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-[13px] font-semibold md:text-sm";

export const sponsorHeroTwoColumnArtGridCompact =
  "grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(112px,176px)] lg:items-center lg:gap-2.5";

/** Hero grid: copy | illustration | aside (patient matches search). */
export const sponsorHeroThreeColumnArtGrid =
  "grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(9.5rem,12rem)] md:gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(140px,200px)_minmax(10rem,12.5rem)] lg:items-center lg:gap-3";

/** Primary content card — soft white → slate wash (dashboard & active trials). */
export const sponsorCardShell =
  "rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/55 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.05)]";

/** Compact card shell for dense active-trials layout. */
export const sponsorCardShellCompact =
  "rounded-xl border border-slate-200/90 bg-gradient-to-b from-white via-white to-slate-50/55 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_2px_8px_-2px_rgba(15,23,42,0.04)]";

export const sponsorCardHeader = "border-b border-slate-100 bg-slate-50/70";

export type SponsorKpiTint = "blue" | "violet" | "emerald" | "amber";

const KPI_TINT: Record<SponsorKpiTint, string> = {
  blue: "border-blue-100/70 bg-gradient-to-b from-blue-50/45 via-white to-white",
  violet: "border-violet-100/70 bg-gradient-to-b from-violet-50/45 via-white to-white",
  emerald: "border-emerald-100/70 bg-gradient-to-b from-emerald-50/45 via-white to-white",
  amber: "border-amber-100/70 bg-gradient-to-b from-amber-50/45 via-white to-white",
};

export function sponsorKpiCardClass(tint: SponsorKpiTint, extra?: string) {
  return cn(sponsorCardShell, KPI_TINT[tint], extra);
}
