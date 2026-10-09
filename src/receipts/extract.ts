// Extraction du texte d'un ticket : PDF (texte intégré), sinon OCR Tesseract (photo, PDF scanné).

import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PDFParse } from "pdf-parse";

const run = promisify(execFile);

export type ExtractMethod = "pdf" | "ocr" | "none";

export interface ExtractResult {
  text: string;
  method: ExtractMethod;
  /** Raison pour laquelle le texte n'a pas pu être lu (OCR désactivé, Tesseract absent…) */
  warning?: string;
}

export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

async function pdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

/** OCR d'une image (français, mise en page en colonnes) */
async function ocrImage(path: string): Promise<string> {
  const { stdout } = await run("tesseract", [path, "stdout", "-l", "fra", "--psm", "4"], { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });
  return stdout;
}

/** PDF scanné : chaque page est convertie en image (poppler), puis passée à l'OCR */
async function ocrPdf(path: string, dir: string): Promise<string> {
  await run("pdftoppm", ["-r", "300", "-gray", "-png", path, join(dir, "page")], { timeout: 120_000 });
  const pages = (await readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".png")).sort();
  const texts: string[] = [];
  for (const page of pages) texts.push(await ocrImage(join(dir, page)));
  return texts.join("\n");
}

const isMissingTool = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "ENOENT";

export async function extractText(buffer: Buffer, mime: string, ocrEnabled: boolean): Promise<ExtractResult> {
  if (mime === "application/pdf") {
    const text = await pdfText(buffer).catch(() => "");
    // Un PDF de ticket dématérialisé contient du texte ; sinon c'est un scan
    if (text.replace(/\s/g, "").length >= 20) return { text, method: "pdf" };
  }
  if (!ocrEnabled) return { text: "", method: "none", warning: "ocr_disabled" };

  const dir = await mkdtemp(join(tmpdir(), "cabas-ocr-"));
  try {
    const path = join(dir, mime === "application/pdf" ? "ticket.pdf" : "ticket.img");
    await writeFile(path, buffer);
    const text = mime === "application/pdf" ? await ocrPdf(path, dir) : await ocrImage(path);
    return { text, method: "ocr" };
  } catch (e) {
    return { text: "", method: "none", warning: isMissingTool(e) ? "ocr_unavailable" : "ocr_failed" };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
