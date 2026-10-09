/** Minuscules, sans accents ni ponctuation, espaces simples : « Lait demi-écrémé » → « lait demi ecreme » */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const UNITS = ["pcs", "kg", "g", "L", "cl", "ml", "paquet", "boîte", "bouteille", "lot"] as const;

const UNIT_ALIASES: Record<string, string> = {
  x: "pcs",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  kg: "kg",
  kilo: "kg",
  kilos: "kg",
  g: "g",
  gr: "g",
  grammes: "g",
  l: "L",
  litre: "L",
  litres: "L",
  cl: "cl",
  ml: "ml",
  paquet: "paquet",
  paquets: "paquet",
  boite: "boîte",
  boites: "boîte",
  bouteille: "bouteille",
  bouteilles: "bouteille",
  lot: "lot",
  lots: "lot",
};

export interface QuickAdd {
  name: string;
  quantity: number;
  /** null si la saisie ne précise pas d'unité (on garde alors celle du produit) */
  unit: string | null;
}

/**
 * Analyse une saisie rapide :
 *   « 2 lait », « 1,5 kg pommes », « 500g de farine », « lait x2 », « 3 paquets de pâtes »
 */
export function parseQuickAdd(input: string): QuickAdd {
  let text = input.trim().replace(/\s+/g, " ");
  let quantity = 1;
  let unit: string | null = null;

  const num = (s: string) => Number(s.replace(",", "."));

  // Quantité en fin : « lait x2 », « lait ×2 »
  const trailing = text.match(/^(.+?)\s*[x×]\s*(\d+(?:[.,]\d+)?)$/i);
  if (trailing?.[1] && trailing[2]) {
    text = trailing[1];
    quantity = num(trailing[2]);
    unit = "pcs";
  } else {
    // Quantité en tête, unité facultative collée ou non : « 500g », « 1,5 kg », « 2 x », « 3 paquets »
    const leading = text.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Zéèêîôû]+)?\.?\s+(.+)$/);
    if (leading?.[1] && leading[3]) {
      const maybeUnit = leading[2] ? UNIT_ALIASES[normalize(leading[2])] : undefined;
      quantity = num(leading[1]);
      if (maybeUnit) {
        unit = maybeUnit;
        text = leading[3];
      } else {
        text = leading[2] ? `${leading[2]} ${leading[3]}` : leading[3];
      }
      text = text.replace(/^(de |d'|d’)/i, "");
    }
  }

  if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1;
  const name = text.charAt(0).toUpperCase() + text.slice(1);
  return { name, quantity, unit };
}

/** Unités pour lesquelles le prix saisi vaut pour toute la ligne (« 500 g de farine : 1,20 € ») */
const WHOLE_LINE_UNITS = new Set(["g", "cl", "ml"]);

export const priceIsForWholeLine = (unit: string) => WHOLE_LINE_UNITS.has(unit);

/** Montant estimé d'une ligne, en centimes */
export function lineTotalCents(item: { quantity: number; unit: string; estUnitPriceCents: number | null }): number {
  if (item.estUnitPriceCents == null) return 0;
  return priceIsForWholeLine(item.unit) ? item.estUnitPriceCents : Math.round(item.quantity * item.estUnitPriceCents);
}

/** « LAIT DEMI ECR UHT 1L » → « Lait demi ecr uht 1L » : point de départ pour nommer un nouveau produit */
export function productNameFromLabel(label: string): string {
  const lower = label.toLowerCase().replace(/\s+/g, " ").trim();
  return lower.charAt(0).toUpperCase() + lower.slice(1).replace(/(\d)(l|cl|ml|g|kg)\b/g, (_m, d: string, u: string) => `${d}${u === "l" ? "L" : u}`);
}
