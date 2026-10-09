// Outils partagés par les parseurs : montants, dates, et un analyseur de lignes configurable
// qui couvre la mise en page habituelle des tickets français :
//
//   LAIT DEMI ECR UHT 1L          1,05 A      ← libellé + montant (+ code TVA)
//   YAOURT NATURE X4                          ← libellé seul…
//     2 x 1,59                    3,18        ← …suivi de la quantité
//   POMMES GOLDEN                 2,26
//     0,756 kg x 2,99 €/kg                    ← pesée
//   REMISE IMMEDIATE             -0,50
//   TOTAL A PAYER                87,42

import type { ParsedLine, ParsedReceipt, ReceiptParser } from "../types.ts";

const AMOUNT = String.raw`-?\d{1,4}(?:[ .]\d{3})*[.,]\d{2}`;

/** « 1,05 » / « 1.05 » / « 1 234,50 » / « -0,50 » → centimes */
export function toCents(amount: string): number {
  const negative = amount.trim().startsWith("-");
  const digits = amount.replace(/[^\d.,]/g, "");
  const [whole = "0", decimals = "00"] = digits.split(/[.,](?=\d{2}$)/);
  const cents = Number(whole.replace(/[.,\s]/g, "")) * 100 + Number(decimals.padEnd(2, "0").slice(0, 2));
  return negative ? -cents : cents;
}

const toNumber = (s: string) => Number(s.replace(",", "."));

/** Première date du ticket (jj/mm/aa[aa], heure facultative), en heure locale du serveur (TZ) */
export function findDate(text: string): Date | null {
  const m = text.match(/\b(\d{2})[/.-](\d{2})[/.-](\d{2}|\d{4})\b(?:\D{1,12}?(\d{1,2})\s?[:hH]\s?(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = "12", mi = "0", s = "0"] = m;
  const year = y!.length === 2 ? 2000 + Number(y) : Number(y);
  const date = new Date(year, Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(mo) - 1) return null;
  return date;
}

/** Confusions fréquentes de l'OCR dans les chiffres : « 3,V5 » → « 3,75 », « 1O,98 » → « 10,98 » */
const OCR_DIGITS: Record<string, string> = { O: "0", o: "0", D: "0", I: "1", l: "1", "|": "1", S: "5", s: "5", B: "8", Z: "2", z: "2", V: "7" };
const OCR_AMOUNT = /(^|\s)(-?)([0-9OoDIl|]{1,4})([.,])([0-9OoDIl|SsBZzV]{2})(?=(?:\s+[A-Z0-9]{1,2})?$)/;

function fixOcrAmount(line: string): string {
  return line.replace(OCR_AMOUNT, (match, space: string, sign: string, whole: string, sep: string, decimals: string) => {
    // On ne corrige qu'un montant qui contient déjà au moins un vrai chiffre
    if (!/\d/.test(whole + decimals)) return match;
    const fix = (s: string) => s.replace(/[^0-9]/g, (c) => OCR_DIGITS[c] ?? c);
    return `${space}${sign}${fix(whole)}${sep}${fix(decimals)}`;
  });
}

/** Lignes nettoyées : espaces normalisés, symboles monétaires retirés, montants mal lus par l'OCR corrigés */
export function cleanLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) =>
      fixOcrAmount(
        l
          .replace(/\u00a0/g, " ")
          .replace(/€|EUR\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    )
    .filter(Boolean);
}

export interface LineParserConfig {
  slug: string;
  /** Présence de l'enseigne dans le texte */
  detect: RegExp;
  /** Lignes à ignorer en plus des lignes communes (fidélité, cagnotte…) */
  ignore?: RegExp[];
  /** Libellés de remise en plus des communs */
  discount?: RegExp[];
}

const COMMON_IGNORE = [
  /^(sous[- ]?total|total\s+(ht|tva|remises?|economies?)|tva|t\.v\.a|taux|base\s+ht|ht\b|ttc\b)/i,
  /^(cb|carte\s*(bancaire|bleue|cb)?|visa|mastercard|maestro|cic|sans\s+contact|esp[eè]ces|rendu|monnaie|paiement|r[eè]glement|ticket\s+resto|titre[- ]restaurant|ch[eè]que)\b/i,
  /^(nb\.?|nombre)\s*(d['’]?\s*)?(articles?|art)\b|^articles?\s*:|^\d+\s+articles?\b/i,
  /^(merci|a\s+bient[oô]t|bonne\s+journ[eé]e|tel\.?|t[eé]l[eé]phone|siret|siren|rcs|n°\s*tva|tva\s+intra|www\.|http|caisse|caissier|caissi[eè]re|h[oô]tesse|op[eé]rateur|vendeur|magasin\s+n|ticket\s+n|transaction|n°\s*(de\s+)?ticket)/i,
  /^[-=*_.\s]{4,}$/,
  /^(date|heure)\b/i,
];

const COMMON_DISCOUNT = [/\b(remise|r[eé]duc|r[eé]duction|bon\s+(de\s+r[eé]duction|imm[eé]diat)|promo(tion)?|avantage|coupon|offre)\b/i];

/** Libellé + montant en fin de ligne, suivi éventuellement d'un code TVA (A, B, 1, 2…) */
const ITEM = new RegExp(String.raw`^(?<label>.*?[A-Za-zÀ-ÿ].*?)\s+(?<amount>${AMOUNT})(?:\s*\*?\s*[A-Z0-9]{1,2})?$`);
/** « 2 x 1,59 [3,18] », « 0,756 kg x 2,99 /kg [2,26] » */
const QUANTITY = new RegExp(
  String.raw`^(?<qty>\d+(?:[.,]\d+)?)\s*(?:kg|pc|pcs|u)?\s*[xX*×]\s*(?<unit>${AMOUNT})\s*(?:\/\s*kg)?(?:\s+(?<total>${AMOUNT}))?(?:\s*[A-Z0-9]{1,2})?$`,
);
/** Quantité sur la même ligne que le libellé : « LAIT 1L  2 x 1,05  2,10 » */
const INLINE_QUANTITY = new RegExp(
  String.raw`^(?<label>.*?[A-Za-zÀ-ÿ].*?)\s+(?<qty>\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[xX*×]\s*(?<unit>${AMOUNT})\s*(?:\/\s*kg)?\s+(?<total>${AMOUNT})(?:\s*[A-Z0-9]{1,2})?$`,
);
const TOTAL = new RegExp(
  String.raw`^(?:net\s+[aà]\s+payer|total\s+[aà]\s+payer|[aà]\s+payer|montant\s+(?:[aà]\s+payer|d[uû]|ttc|total)|total\s+ttc|total(?!\s+(?:ht|tva|remises?|[eé]conomies?|articles?|points?|fid))(?:\s+ticket)?)\b\D*?(?<amount>${AMOUNT})?$`,
  "i",
);
const EAN = /\b(\d{13}|\d{8})\b/;

/** Analyseur de lignes commun, paramétré par enseigne */
export function createLineParser(config: LineParserConfig): ReceiptParser {
  const ignore = [...COMMON_IGNORE, ...(config.ignore ?? [])];
  const discount = [...COMMON_DISCOUNT, ...(config.discount ?? [])];

  return {
    slug: config.slug,
    detect: (text) => config.detect.test(text),
    parse(text): ParsedReceipt {
      const lines = cleanLines(text);
      const items: ParsedLine[] = [];
      let totalCents: number | null = null;
      let pendingLabel: string | null = null;
      /** Ligne de quantité placée avant le libellé auquel elle se rapporte */
      let quantityHint: { qty: number; unit: number; total: number } | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        const total = line.match(TOTAL);
        if (total) {
          const amount = total.groups?.amount ?? lines[i + 1]?.match(new RegExp(`^(${AMOUNT})$`))?.[1];
          if (amount) {
            totalCents = toCents(amount);
            break; // ensuite : paiement, TVA, fidélité
          }
          continue;
        }
        if (ignore.some((re) => re.test(line))) {
          pendingLabel = null;
          continue;
        }

        const ean = line.match(EAN)?.[1] ?? null;
        const q = line.match(QUANTITY);
        if (q?.groups) {
          const qty = toNumber(q.groups.qty!);
          const unit = toCents(q.groups.unit!);
          const lineTotal = q.groups.total ? toCents(q.groups.total) : Math.round(qty * unit);
          const last = items.at(-1);
          if (pendingLabel) {
            items.push({ label: pendingLabel, quantity: qty, unitPriceCents: unit, totalCents: lineTotal, ean, isDiscount: false });
            pendingLabel = null;
          } else if (last && !last.isDiscount && last.quantity === 1 && Math.abs(last.totalCents - lineTotal) <= 1) {
            // « LIBELLÉ 2,10 » puis « 2 x 1,05 » : le montant de la ligne était déjà le total
            last.quantity = qty;
            last.unitPriceCents = unit;
          } else if (last && !last.isDiscount && last.quantity === 1 && last.totalCents === unit && qty > 1) {
            // « LIBELLÉ 1,05 » puis « 2 x 1,05 = 2,10 » : le montant de la ligne était le prix unitaire
            last.quantity = qty;
            last.totalCents = lineTotal;
          } else {
            quantityHint = { qty, unit, total: lineTotal };
          }
          continue;
        }

        const inline = line.match(INLINE_QUANTITY);
        if (inline?.groups) {
          items.push({
            label: inline.groups.label!.replace(EAN, "").trim(),
            quantity: toNumber(inline.groups.qty!),
            unitPriceCents: toCents(inline.groups.unit!),
            totalCents: toCents(inline.groups.total!),
            ean,
            isDiscount: false,
          });
          pendingLabel = null;
          quantityHint = null;
          continue;
        }

        const m = line.match(ITEM);
        if (m?.groups) {
          const label = m.groups.label!.replace(EAN, "").replace(/\s+/g, " ").trim();
          let amount = toCents(m.groups.amount!);
          const isDiscount = amount < 0 || discount.some((re) => re.test(label));
          if (isDiscount && amount > 0) amount = -amount;
          const hint = quantityHint && Math.abs(quantityHint.total - amount) <= 1 ? quantityHint : null;
          items.push({
            label: label || pendingLabel || "?",
            quantity: hint?.qty ?? 1,
            unitPriceCents: hint?.unit ?? (isDiscount ? null : amount),
            totalCents: amount,
            ean,
            isDiscount,
          });
          pendingLabel = null;
          quantityHint = null;
          continue;
        }

        // Libellé sans montant : la quantité et le prix suivent sur la ligne d'après
        if (/[A-Za-zÀ-ÿ]{3}/.test(line) && !/\d{2}[/.]\d{2}[/.]\d{2}/.test(line)) pendingLabel = line;
      }

      return { chain: config.detect.test(text) ? config.slug : null, purchasedAt: findDate(text), totalCents, lines: items };
    },
  };
}
