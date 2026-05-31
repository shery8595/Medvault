import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import {
  sponsorHeroDescription,
  sponsorHeroEyebrow,
  sponsorHeroGlow,
  sponsorHeroIllustrationClass,
  sponsorHeroPadding,
  sponsorHeroShadow,
  sponsorHeroShell,
  sponsorHeroTitle,
} from "../../lib/sponsorUi";

type HeroLink = { label: string; to: string; primary?: boolean };

type SponsorPageHeroProps = {
  eyebrow?: string;
  title: string;
  description: string;
  cta?: { label: string; to: string };
  links?: HeroLink[];
  /** Optional right-side illustration (e.g. active trials component art). */
  illustrationSrc?: string;
};

export function SponsorPageHero({
  eyebrow = "Sponsor console",
  title,
  description,
  cta,
  links = [],
  illustrationSrc,
}: SponsorPageHeroProps) {
  const hasIllustration = Boolean(illustrationSrc);

  return (
    <div className={cn(sponsorHeroShell, sponsorHeroShadow, sponsorHeroPadding)}>
      <div className={sponsorHeroGlow} aria-hidden />

      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt=""
          className={sponsorHeroIllustrationClass}
          decoding="async"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative z-[2] flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
          hasIllustration &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(140px,220px)_auto] lg:items-center lg:gap-3",
        )}
      >
        <div className={cn("space-y-2", hasIllustration && "lg:pr-1")}>
          <p className={sponsorHeroEyebrow}>{eyebrow}</p>
          <h1 className={sponsorHeroTitle}>{title}</h1>
          <p className={sponsorHeroDescription}>{description}</p>
          {links.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-1.5 text-[15px] font-semibold md:text-base">
              {links.map((link, i) => (
                <span key={link.to} className="inline-flex items-center gap-3">
                  {i > 0 ? <span className="text-slate-300">·</span> : null}
                  <Link
                    to={link.to}
                    className={
                      link.primary
                        ? "inline-flex items-center gap-1 text-teal-700 transition-colors hover:text-teal-800"
                        : "text-slate-600 transition-colors hover:text-slate-900"
                    }
                  >
                    {link.label}
                    {link.primary ? <span aria-hidden>→</span> : null}
                  </Link>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {hasIllustration ? (
          <div className="hidden h-[118px] shrink-0 sm:h-[128px] lg:block lg:h-[132px]" aria-hidden />
        ) : null}

        {cta ? (
          <Link to={cta.to} className="w-full shrink-0 sm:w-auto">
            <Button
              size="default"
              className="h-12 w-full gap-2 rounded-full border border-[#1a2744] bg-[#1a2744] px-6 text-base text-white shadow-[0_4px_12px_rgba(26,39,68,0.22)] hover:bg-[#243352] sm:w-auto"
            >
              <Plus className="h-5 w-5" strokeWidth={2.25} />
              {cta.label}
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
