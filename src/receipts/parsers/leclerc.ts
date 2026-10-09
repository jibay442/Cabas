import { createLineParser } from "./common.ts";

/** E.Leclerc — tickets papier et tickets dématérialisés (PDF reçu par e-mail) */
export const leclercParser = createLineParser({
  slug: "leclerc",
  detect: /E\s?\.?\s?LECLERC|\bLECLERC\b/i,
  // « Ticket E.Leclerc » = cagnotte fidélité créditée, sans effet sur le montant payé
  ignore: [/^ticket\s+e\.?\s?leclerc/i, /^(cagnotte|solde|carte\s+e\.?\s?leclerc|vos\s+avantages)/i],
  discount: [/\bbon\s+e\.?\s?leclerc\b/i],
});
