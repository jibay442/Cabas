import { createLineParser } from "./common.ts";

/** Intermarché (Super, Hyper, Contact, Express) */
export const intermarcheParser = createLineParser({
  slug: "intermarche",
  detect: /INTERMARCH[EÉ]|LES\s+MOUSQUETAIRES/i,
  ignore: [/^(carte\s+(de\s+)?fid[eé]lit[eé]|solde\s+carte|points?\s+fid)/i],
  discount: [/\bfid[eé]lit[eé]\b/i],
});
