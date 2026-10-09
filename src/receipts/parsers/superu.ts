import { createLineParser } from "./common.ts";

/** Magasins U (Super U, Hyper U, U Express, Utile) */
export const superuParser = createLineParser({
  slug: "superu",
  detect: /\b(SUPER|HYPER)\s?U\b|\bU\s+EXPRESS\b|SYST[EÈ]ME\s+U|MAGASINS\s+U\b|COOP[EÉ]RATIVE\s+U\b/i,
  ignore: [/^(carte\s+u\b|solde\s+carte|cagnotte|vos\s+avantages\s+u)/i],
  discount: [/\bcarte\s+u\b/i],
});
