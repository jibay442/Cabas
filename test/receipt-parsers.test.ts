import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toCents } from "../src/receipts/parsers/common.ts";
import { detectChain, getParser } from "../src/receipts/parsers/index.ts";

// Tickets d'exemple anonymisés (enseignes réelles, magasins et données fictifs)
const fixture = (name: string) => readFileSync(new URL(`./fixtures/receipts/${name}.txt`, import.meta.url), "utf8");

function parse(name: string) {
  const text = fixture(name);
  const chain = detectChain(text);
  const receipt = getParser(chain).parse(text);
  const short = receipt.lines.map((l) => [l.label, l.quantity, l.unitPriceCents, l.totalCents]);
  const sum = receipt.lines.reduce((s, l) => s + l.totalCents, 0);
  return { chain, receipt, short, sum };
}

describe("toCents", () => {
  it.each([
    ["1,05", 105],
    ["1.05", 105],
    ["-0,50", -50],
    ["1 234,56", 123456],
    ["12,30", 1230],
  ])("%s → %i", (input, cents) => expect(toCents(input)).toBe(cents));
});

describe("parseurs de tickets", () => {
  it("E.Leclerc : quantités, pesée, remise, total", () => {
    const { chain, receipt, short, sum } = parse("leclerc");
    expect(chain).toBe("leclerc");
    expect(receipt.purchasedAt?.toISOString()).toBe(new Date(2026, 9, 9, 18, 32).toISOString());
    expect(receipt.totalCents).toBe(1630);
    expect(short).toEqual([
      ["LAIT DEMI ECR UHT 1L", 2, 105, 210],
      ["BAGUETTE TRADITION", 1, 110, 110],
      ["POMMES GOLDEN", 0.756, 299, 226],
      ["YAOURT NATURE X8", 1, 235, 235],
      ["REMISE IMMEDIATE", 1, null, -50],
      ["LESSIVE LIQUIDE 2L", 1, 899, 899],
    ]);
    expect(receipt.lines[4]!.isDiscount).toBe(true);
    expect(sum).toBe(receipt.totalCents);
  });

  it("Auchan : EAN, quantité sous le libellé, sous-total ignoré", () => {
    const { chain, receipt, short, sum } = parse("auchan");
    expect(chain).toBe("auchan");
    expect(receipt.purchasedAt?.toISOString()).toBe(new Date(2026, 9, 9, 10, 15).toISOString());
    expect(receipt.totalCents).toBe(1551);
    expect(short).toEqual([
      ["PATE A TARTINER 400G", 1, 349, 349],
      ["COCA COLA 1,5L", 3, 189, 567],
      ["STEAK HACHE 5% X2", 1, 495, 495],
      ["EAU MINERALE 6X1,5L", 1, 240, 240],
      ["BON IMMEDIAT", 1, null, -100],
    ]);
    expect(receipt.lines[0]!.ean).toBe("3017620422003");
    expect(sum).toBe(receipt.totalCents);
  });

  it("Intermarché : remise fidélité et pesée", () => {
    const { chain, receipt, short, sum } = parse("intermarche");
    expect(chain).toBe("intermarche");
    expect(receipt.purchasedAt?.toISOString()).toBe(new Date(2026, 9, 9, 17, 5).toISOString());
    expect(receipt.totalCents).toBe(1398);
    expect(short).toEqual([
      ["FROMAGE RAPE 200G", 1, 215, 215],
      ["JAMBON BLANC X4", 1, 329, 329],
      ["REMISE FIDELITE", 1, null, -33],
      ["TOMATES GRAPPE", 0.85, 349, 297],
      ["PAPIER TOILETTE X12", 1, 590, 590],
    ]);
    expect(sum).toBe(receipt.totalCents);
  });

  it("Super U : quantité après le libellé, remise Carte U", () => {
    const { chain, receipt, short, sum } = parse("superu");
    expect(chain).toBe("superu");
    expect(receipt.purchasedAt?.toISOString()).toBe(new Date(2026, 9, 9, 11, 42).toISOString());
    expect(receipt.totalCents).toBe(1098);
    expect(short).toEqual([
      ["BEURRE DOUX 250G", 1, 245, 245],
      ["CAFE MOULU 250G X2", 2, 299, 598],
      ["REMISE CARTE U", 1, null, -120],
      ["PIZZA SURGELEE", 1, 375, 375],
    ]);
    expect(sum).toBe(receipt.totalCents);
  });

  it("Super U lu par OCR : montants mal lus corrigés (« 3,V5 », « 1O,98 »)", () => {
    const { chain, receipt, short, sum } = parse("superu-ocr");
    expect(chain).toBe("superu");
    expect(receipt.totalCents).toBe(1098);
    expect(short).toEqual([
      ["BEURRE DOUX 250G", 1, 245, 245],
      ["CAFE MOULU 250G X2", 2, 299, 598],
      ["REMISE CARTE U", 1, null, -120],
      ["PIZZA SURGELEE", 1, 375, 375],
    ]);
    expect(sum).toBe(receipt.totalCents);
  });

  it("Parseur générique : enseigne inconnue, paiement en espèces ignoré", () => {
    const { chain, receipt, short } = parse("generic");
    expect(chain).toBeNull();
    expect(receipt.totalCents).toBe(475);
    expect(short).toEqual([
      ["PAIN DE MIE", 1, 180, 180],
      ["CONFITURE FRAISE", 1, 295, 295],
    ]);
  });
});

describe("pipeline complet", () => {
  it("PDF à texte intégré → extraction → parseur E.Leclerc", async () => {
    const { analyzeReceipt } = await import("../src/receipts/pipeline.ts");
    const buffer = readFileSync(new URL("./fixtures/receipts/leclerc.pdf", import.meta.url));
    const result = await analyzeReceipt({ file: { buffer, mime: "application/pdf" }, ocrEnabled: false });
    expect(result.method).toBe("pdf");
    expect(result.chain).toBe("leclerc");
    expect(result.totalCents).toBe(1630);
    expect(result.lines).toHaveLength(6);
    expect(result.lines.reduce((s, l) => s + l.totalCents, 0)).toBe(1630);
  });

  it("lignes fournies (n8n) utilisées telles quelles", async () => {
    const { analyzeReceipt } = await import("../src/receipts/pipeline.ts");
    const lines = [{ label: "LAIT", quantity: 2, unitPriceCents: 105, totalCents: 210, ean: null, isDiscount: false }];
    const result = await analyzeReceipt({ lines, chain: "auchan", ocrEnabled: false });
    expect(result.parser).toBe("lines");
    expect(result.lines).toEqual(lines);
  });
});

describe("ticket HTML (corps du mail)", () => {
  it("convertit le tableau HTML en lignes de texte", async () => {
    const { analyzeReceipt, htmlToText } = await import("../src/receipts/pipeline.ts");
    const html = `<html><head><style>td{}</style></head><body><h1>Auchan Drive</h1><p>Commande du 09/10/2026 à 10:15</p>
      <table><tr><td>LAIT DEMI ECR 1L</td><td>2 x 1,05&nbsp;&euro;</td><td>2,10 &euro;</td></tr>
      <tr><td>BAGUETTE</td><td></td><td>1,35&nbsp;&euro;</td></tr>
      <tr><td><b>TOTAL A PAYER</b></td><td></td><td>3,45 &euro;</td></tr></table></body></html>`;
    expect(htmlToText(html)).toContain("BAGUETTE 1,35 €");
    const result = await analyzeReceipt({ rawText: html, ocrEnabled: false });
    expect(result.chain).toBe("auchan");
    expect(result.totalCents).toBe(345);
    expect(result.lines.map((l) => [l.label, l.quantity, l.unitPriceCents, l.totalCents])).toEqual([
      ["LAIT DEMI ECR 1L", 2, 105, 210],
      ["BAGUETTE", 1, 135, 135],
    ]);
  });
});
