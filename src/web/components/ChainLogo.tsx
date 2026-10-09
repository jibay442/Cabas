import { svg as auchan } from "@thesvg/icons/auchan";
import { svg as leclerc } from "@thesvg/icons/edotleclerc";
import { svg as intermarche } from "@thesvg/icons/intermarche";
import { CHAINS } from "../../shared/defaults.ts";
import { cx } from "./ui.tsx";

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
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-stone-200 dark:ring-stone-700 [&>svg]:size-full",
        size === "sm" ? "size-6 p-0.5" : "size-10 p-1.5",
      )}
      dangerouslySetInnerHTML={logo ? { __html: logo } : undefined}
    >
      {logo ? undefined : chain === "superu" ? (
        <span className={cx("font-black leading-none text-[#e2001a]", size === "sm" ? "text-sm" : "text-xl")}>U</span>
      ) : (
        <span className={size === "sm" ? "text-sm" : "text-xl"}>🏪</span>
      )}
    </span>
  );
}
