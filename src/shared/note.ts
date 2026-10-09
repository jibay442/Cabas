// Transforme une note libre (tapée ou dictée) en articles de liste.
//
//   « lait, 2 baguettes
//     1 kg de pommes
//     pain (complet) et une douzaine d'œufs »
//
// → Lait · 2 Baguettes · 1 kg Pommes · Pain (note : complet) · 12 Œufs

import { parseQuickAdd } from "./text.ts";

export interface NoteEntry {
  name: string;
  quantity: number;
  unit: string | null;
  note: string | null;
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, cinquante: 50, cent: 100,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

const NUMBER_WORD = Object.keys(NUMBER_WORDS).join("|");

/** Séparateurs entre articles sur une même ligne (une virgule entre deux chiffres reste décimale : « 1,5 kg ») */
const SEPARATORS = /\s*;\s*|(?<!\d),\s*|,(?!\d)\s*|\s+(?:et|puis|plus|and|\+)\s+/i;

/** Article en tête (mot entier, ou élision « l' », « d' ») */
const LEADING_ARTICLE = /^(?:(?:du|des|de\s+la|le|la|les|some|the)\s+|(?:de\s+l|d|l)['’]\s*)/i;

/** Découpe une note en articles, une entrée par ligne / virgule / « et ». */
export function parseNote(text: string): NoteEntry[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(SEPARATORS))
    .map(parseEntry)
    .filter((e): e is NoteEntry => e !== null);
}

function parseEntry(raw: string): NoteEntry | null {
  let text = raw
    .trim()
    // puces et cases à cocher : « - », « • », « [ ] », « 1. »
    .replace(/^(?:[-*•–—]+|\[\s?[xX]?\s?\]|\d+[.)](?=\s))\s*/, "")
    .replace(/^(?:et|puis|aussi|plus|and)\s+/i, "");

  // Texte entre parenthèses → note de l'article
  const notes: string[] = [];
  text = text.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });

  text = text
    .replace(/^(?:une\s+)?demi[- ]douzaine\s+(?:d['’]|de\s+)?/i, "6 ")
    .replace(/^(?:une\s+)?douzaine\s+(?:d['’]|de\s+)?/i, "12 ")
    .replace(/^(?:un\s+|une\s+)?demi[- ]/i, "0,5 ")
    .replace(new RegExp(`^(${NUMBER_WORD})\\s+`, "i"), (_m, word: string) => `${NUMBER_WORDS[word.toLowerCase()]} `)
    // Articles en tête : « du lait », « des œufs », « de la farine »
    .replace(LEADING_ARTICLE, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || !/[\p{L}\d]/u.test(text)) return null;
  const parsed = parseQuickAdd(text);
  // « 2 kg de pommes » : parseQuickAdd a retiré « de », mais pas les articles qui suivaient la quantité
  const name = parsed.name.replace(LEADING_ARTICLE, "");
  if (!name) return null;
  return { ...parsed, name: name.charAt(0).toUpperCase() + name.slice(1), note: notes.join(", ") || null };
}

const SPOKEN_STARTS = `du|des|de la|de l'|${NUMBER_WORD}|\\d+(?:[.,]\\d+)?`;

/**
 * La dictée vocale arrive souvent sans ponctuation : « deux baguettes du lait des pommes et du beurre ».
 * On coupe avant chaque déterminant ou quantité pour obtenir une ligne par article.
 */
export function spokenToNote(transcript: string): string {
  return transcript
    .trim()
    .replace(new RegExp(`\\s+(?=(?:${SPOKEN_STARTS})\\s)`, "gi"), "\n")
    .replace(/\s+(?:et|puis)\s*\n/gi, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}
