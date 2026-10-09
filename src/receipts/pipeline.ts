// Pipeline d'analyse : lignes fournies (n8n) > texte (PDF / OCR / e-mail) analysé par le parseur de l'enseigne.

import { extractText, type ExtractMethod } from "./extract.ts";
import { detectChain, getParser } from "./parsers/index.ts";
import type { ParsedLine, ParsedReceipt } from "./types.ts";

export interface AnalyzeInput {
  file?: { buffer: Buffer; mime: string };
  rawText?: string | null;
  /** Lignes déjà structurées (ex. extraites par n8n) : utilisées telles quelles */
  lines?: ParsedLine[];
  /** Enseigne connue d'avance (slug) */
  chain?: string | null;
  ocrEnabled: boolean;
}

export interface AnalyzeResult extends ParsedReceipt {
  text: string;
  method: ExtractMethod | "lines" | "text";
  parser: string;
  warning?: string;
}

/** Ticket reçu dans le corps d'un mail HTML : une ligne de texte par ligne de tableau / paragraphe */
export function htmlToText(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  const entities: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", euro: "€" };
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, code: string) => (code.startsWith("#") ? String.fromCharCode(Number(code.slice(1))) : (entities[code.toLowerCase()] ?? m)))
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function analyzeReceipt(input: AnalyzeInput): Promise<AnalyzeResult> {
  let text = htmlToText(input.rawText?.trim() ?? "");
  let method: AnalyzeResult["method"] = text ? "text" : "none";
  let warning: string | undefined;

  if (input.file && !input.lines?.length) {
    const extracted = await extractText(input.file.buffer, input.file.mime, input.ocrEnabled);
    if (extracted.text.trim()) {
      text = extracted.text;
      method = extracted.method;
    } else if (!text) {
      warning = extracted.warning;
    }
  }

  const chain = input.chain ?? (text ? detectChain(text) : null);
  if (input.lines?.length) {
    const parsed = text ? getParser(chain).parse(text) : null;
    return { chain, purchasedAt: parsed?.purchasedAt ?? null, totalCents: parsed?.totalCents ?? null, lines: input.lines, text, method: "lines", parser: "lines", warning };
  }
  if (!text) return { chain, purchasedAt: null, totalCents: null, lines: [], text, method, parser: "none", warning };

  const parser = getParser(chain);
  return { ...parser.parse(text), chain, text, method, parser: parser.slug, warning };
}
