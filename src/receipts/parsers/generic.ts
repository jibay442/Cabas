import { createLineParser } from "./common.ts";

/** Parseur de secours, utilisé quand l'enseigne n'est pas reconnue */
export const genericParser = createLineParser({ slug: "other", detect: /(?!)/ });
