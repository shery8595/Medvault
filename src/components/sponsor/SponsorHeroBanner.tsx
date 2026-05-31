import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  sponsorHeroGlow,
  sponsorHeroIllustrationClass,
  sponsorHeroPadding,
  sponsorHeroShadow,
  sponsorHeroShell,
} from "../../lib/sponsorUi";

type SponsorHeroBannerProps = {
  children: ReactNode;
  className?: string;
  /** Replaces default hero padding (e.g. sponsorHeroPaddingCompact). */
  paddingClassName?: string;
  innerClassName?: string;
  /** Optional right-side illustration (e.g. patient matches component art). */
  illustrationSrc?: string;
  /** Override default illustration positioning/size. */
  illustrationClassName?: string;
};

/** Full-width sponsor page hero shell (violet gradient) with slotted content. */
export function SponsorHeroBanner({
  children,
  className,
  paddingClassName = sponsorHeroPadding,
  innerClassName,
  illustrationSrc,
  illustrationClassName,
}: SponsorHeroBannerProps) {
  return (
    <header
      className={cn(
        sponsorHeroShell,
        sponsorHeroShadow,
        paddingClassName,
        className,
      )}
    >
      <div className={sponsorHeroGlow} aria-hidden />

      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt=""
          className={illustrationClassName ?? sponsorHeroIllustrationClass}
          decoding="async"
          aria-hidden
        />
      ) : null}

      <div className={cn("relative z-[2]", innerClassName)}>{children}</div>
    </header>
  );
}

/** Spacer column so hero copy/search do not overlap the illustration on lg+. */
export function SponsorHeroIllustrationSpacer({ className }: { className?: string }) {
  return (
    <div
      className={cn("hidden h-[118px] shrink-0 sm:h-[128px] lg:block lg:h-[132px]", className)}
      aria-hidden
    />
  );
}

