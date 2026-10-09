import type { ReceiptParser } from "../types.ts";
import { auchanParser } from "./auchan.ts";
import { genericParser } from "./generic.ts";
import { intermarcheParser } from "./intermarche.ts";
import { leclercParser } from "./leclerc.ts";
import { superuParser } from "./superu.ts";

/** Parseurs par enseigne : ajoutez ici un nouveau parseur pour qu'il soit utilisé */
export const PARSERS: ReceiptParser[] = [leclercParser, auchanParser, intermarcheParser, superuParser];

/** Enseigne détectée dans le texte du ticket */
export function detectChain(text: string): string | null {
  return PARSERS.find((p) => p.detect(text))?.slug ?? null;
}

/** Parseur de l'enseigne, ou parseur générique */
export function getParser(chain: string | null | undefined): ReceiptParser {
  return PARSERS.find((p) => p.slug === chain) ?? genericParser;
}
