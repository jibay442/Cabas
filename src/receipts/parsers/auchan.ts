import { createLineParser } from "./common.ts";

/** Auchan (hyper, supermarché, piéton) */
export const auchanParser = createLineParser({
  slug: "auchan",
  detect: /\bAUCHAN\b/i,
  // Fidélité Waaoh : cagnotte créditée, pas une remise sur le ticket
  ignore: [/^(waaoh|cagnott[ée]|carte\s+(waaoh|auchan)|vous\s+avez\s+cumul)/i],
});
