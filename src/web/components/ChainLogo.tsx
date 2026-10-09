import { svg as auchan } from "@thesvg/icons/auchan";
import { svg as leclerc } from "@thesvg/icons/edotleclerc";
import { svg as intermarche } from "@thesvg/icons/intermarche";
import { Store } from "lucide-react";
import { CHAINS } from "../../shared/defaults.ts";
import { cn } from "../lib/utils.ts";

// Logos issus de thesvg.org (paquet @thesvg/icons, MIT) — les marques restent la propriété de leurs titulaires.
// Super U n'y figure pas : pastille « U » à la place.
const LOGOS: Record<string, string> = { auchan, leclerc, intermarche };

/** Logo d'enseigne sur une tuile blanche (lisible en thème clair comme sombre) */
export function ChainLogo({ chain, size = "md" }: { chain: string; size?: "sm" | "md" }) {
  const name = CHAINS.find((c) => c.slug === chain)?.name ?? chain;
  const logo = LOGOS[chain];
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border bg-white [&>svg]:size-full",
        size === "sm" ? "size-5 p-0.5" : "size-8 p-1",
      )}
      dangerouslySetInnerHTML={logo ? { __html: logo } : undefined}
    >
      {logo ? undefined : chain === "superu" ? (
        <span className={cn("font-black leading-none text-[#e2001a]", size === "sm" ? "text-[11px]" : "text-base")}>U</span>
      ) : (
        <Store className="size-3/4 text-slate-500" />
      )}
    </span>
  );
}
