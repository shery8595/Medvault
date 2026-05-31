import { cn } from "../../lib/utils";
import { sponsorHeroComponentArtClass } from "../../lib/sponsorUi";

type SponsorHeroCenterArtProps = {
  src: string;
  className?: string;
  artClassName?: string;
};

/** Center-column hero illustration (patient matches, analytics, audit). */
export function SponsorHeroCenterArt({ src, className, artClassName }: SponsorHeroCenterArtProps) {
  return (
    <div className="flex justify-center overflow-visible px-0.5 md:col-start-2 md:row-start-1">
      <img
        src={src}
        alt=""
        className={cn(artClassName ?? sponsorHeroComponentArtClass, className)}
        decoding="async"
        draggable={false}
        aria-hidden
      />
    </div>
  );
}
