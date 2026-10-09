// Import, rapprochement avec les produits du foyer et validation des tickets de caisse.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CHAINS } from "../../shared/defaults.ts";
import { normalize, productNameFromLabel } from "../../shared/text.ts";
import type { ReceiptDetailDto, ReceiptLineDto, ReceiptSummaryDto } from "../../shared/types.ts";
import { analyzeReceipt } from "../../receipts/pipeline.ts";
import type { ParsedLine } from "../../receipts/types.ts";
import { prisma, type Tx } from "../db.ts";
import { env } from "../env.ts";
import type { Product, Receipt, ReceiptLine, Store } from "../generated/prisma/client.ts";
import { sha256 } from "../lib/crypto.ts";
import { EXTENSIONS } from "../lib/mime.ts";
import { publish } from "./events.ts";
import { findOrCreateProduct } from "./products.ts";

// ── Réponses API ──

type ReceiptWithRelations = Receipt & { store: Store | null; lines: (ReceiptLine & { product: Pick<Product, "name"> | null })[] };

export const receiptInclude = {
  store: true,
  lines: { include: { product: { select: { name: true } } }, orderBy: { position: "asc" } },
} as const;

export function receiptSummaryDto(r: ReceiptWithRelations): ReceiptSummaryDto {
  return {
    id: r.id,
    storeId: r.storeId,
    storeName: r.store?.name ?? CHAINS.find((c) => c.slug === r.chain)?.name ?? null,
    chain: r.chain,
    purchasedAt: r.purchasedAt.toISOString(),
    totalCents: r.totalCents,
    status: r.status,
    source: r.source,
    lineCount: r.lines.length,
    unmatchedCount: r.lines.filter((l) => !l.isDiscount && !l.productId).length,
    linesTotalCents: r.lines.reduce((sum, l) => sum + l.totalCents, 0),
    hasFile: !!r.filePath,
    listId: r.listId,
    createdAt: r.createdAt.toISOString(),
  };
}

const lineDto = (l: ReceiptWithRelations["lines"][number]): ReceiptLineDto => ({
  id: l.id,
  position: l.position,
  rawLabel: l.rawLabel,
  label: l.label,
  quantity: l.quantity,
  unitPriceCents: l.unitPriceCents,
  totalCents: l.totalCents,
  ean: l.ean,
  isDiscount: l.isDiscount,
  productId: l.productId,
  productName: l.product?.name ?? null,
  categoryId: l.categoryId,
});

export function receiptDetailDto(r: ReceiptWithRelations): ReceiptDetailDto {
  return { ...receiptSummaryDto(r), parser: r.parser, fileMime: r.fileMime, rawText: r.rawText, lines: r.lines.map(lineDto) };
}

// ── Rapprochement des lignes avec les produits du foyer ──

/**
 * Pour chaque ligne : libellé mémorisé (alias, propre à l'enseigne d'abord) > code-barres > nom identique.
 */
export async function matchProducts(tx: Tx, householdId: string, chain: string, lines: { label: string; ean: string | null; isDiscount: boolean }[]) {
  const labels = [...new Set(lines.map((l) => normalize(l.label)))];
  const eans = [...new Set(lines.map((l) => l.ean).filter((e): e is string => !!e))];
  const [aliases, byEan, byName] = await Promise.all([
    tx.labelAlias.findMany({ where: { householdId, chain: { in: [chain, ""] }, normalizedLabel: { in: labels } }, include: { product: true } }),
    eans.length ? tx.product.findMany({ where: { householdId, ean: { in: eans } } }) : [],
    tx.product.findMany({ where: { householdId, normalizedName: { in: labels } } }),
  ]);

  return lines.map((line) => {
    if (line.isDiscount) return null;
    const label = normalize(line.label);
    const alias = aliases.find((a) => a.normalizedLabel === label && a.chain === chain) ?? aliases.find((a) => a.normalizedLabel === label);
    return alias?.product ?? byEan.find((p) => p.ean === line.ean) ?? byName.find((p) => p.normalizedName === label) ?? null;
  });
}

// ── Import ──

export interface ImportInput {
  householdId: string;
  source: "WEBHOOK" | "UPLOAD" | "MANUAL";
  file?: { buffer: Buffer; mime: string };
  rawText?: string | null;
  lines?: ParsedLine[];
  /** Enseigne : slug (« leclerc ») ou nom libre (« E.Leclerc Rennes ») */
  chainHint?: string | null;
  storeId?: string | null;
  purchasedAt?: Date | null;
  totalCents?: number | null;
  listId?: string | null;
  /** Saisie manuelle : pas d'analyse */
  manual?: boolean;
}

export interface ImportResult {
  receipt: ReceiptWithRelations;
  duplicate: boolean;
  recognized: number;
  unrecognized: string[];
}

function chainFromHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  const text = normalize(hint).replace(/\s/g, "");
  return CHAINS.find((c) => c.slug !== "other" && (text === c.slug || text.includes(normalize(c.name).replace(/\s/g, ""))))?.slug ?? null;
}

const FILES_DIR = () => join(env.DATA_DIR, "receipts");

export async function importReceipt(input: ImportInput): Promise<ImportResult> {
  const { householdId } = input;

  // Idempotence : le même fichier (ou le même contenu) n'est importé qu'une fois par foyer
  const content = input.file
    ? sha256(input.file.buffer)
    : sha256(JSON.stringify([input.rawText ?? "", input.lines ?? [], input.purchasedAt?.toISOString().slice(0, 10) ?? "", input.totalCents ?? ""]));
  const dedupHash = sha256(`v1|${content}`);
  const existing = await prisma.receipt.findUnique({ where: { householdId_dedupHash: { householdId, dedupHash } }, include: receiptInclude });
  if (existing) return summarizeImport(existing, true);

  const analyzed = input.manual
    ? { chain: null, purchasedAt: null, totalCents: null, lines: input.lines ?? [], text: "", parser: "manual", warning: undefined }
    : await analyzeReceipt({ file: input.file, rawText: input.rawText, lines: input.lines, chain: chainFromHint(input.chainHint), ocrEnabled: env.OCR_PROVIDER === "tesseract" });

  const store = input.storeId ? await prisma.store.findFirst({ where: { id: input.storeId, householdId } }) : null;
  const chain = store?.chain ?? chainFromHint(input.chainHint) ?? analyzed.chain ?? "other";
  const resolvedStore =
    store ?? (chain !== "other" ? await prisma.store.findFirst({ where: { householdId, chain }, orderBy: [{ archived: "asc" }, { name: "asc" }] }) : null);

  const lines = analyzed.lines;
  const purchasedAt = input.purchasedAt ?? analyzed.purchasedAt ?? new Date();
  const totalCents = input.totalCents ?? analyzed.totalCents ?? lines.reduce((sum, l) => sum + l.totalCents, 0);

  // Liste comparée par défaut : la plus récente créée avant l'achat
  const listId =
    input.listId ??
    (
      await prisma.shoppingList.findFirst({
        where: { householdId, createdAt: { lte: new Date(purchasedAt.getTime() + 12 * 3600_000) } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    )?.id ??
    null;

  const receipt = await prisma.$transaction(async (tx) => {
    const products = await matchProducts(tx, householdId, chain, lines);
    return tx.receipt.create({
      data: {
        householdId,
        storeId: resolvedStore?.id ?? null,
        chain,
        purchasedAt,
        totalCents,
        source: input.source,
        status: input.file && !lines.length && !analyzed.text ? "FAILED" : "TO_REVIEW",
        parser: analyzed.parser,
        rawText: analyzed.text || null,
        fileMime: input.file?.mime ?? null,
        dedupHash,
        listId,
        lines: {
          create: lines.map((l, position) => ({
            position,
            rawLabel: l.label,
            label: l.label,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            totalCents: l.totalCents,
            ean: l.ean,
            isDiscount: l.isDiscount,
            productId: products[position]?.id ?? null,
            categoryId: products[position]?.categoryId ?? null,
          })),
        },
      },
      include: receiptInclude,
    });
  });

  // Fichier d'origine : DATA_DIR/receipts/<foyer>/<ticket>.<ext>
  let saved = receipt;
  if (input.file) {
    const filePath = join(householdId, `${receipt.id}.${EXTENSIONS[input.file.mime] ?? "bin"}`);
    const absolute = join(FILES_DIR(), filePath);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, input.file.buffer);
    saved = await prisma.receipt.update({ where: { id: receipt.id }, data: { filePath }, include: receiptInclude });
  }

  publish(householdId, { topic: "receipts", id: receipt.id, by: "system" });
  return summarizeImport(saved, false);
}

function summarizeImport(receipt: ReceiptWithRelations, duplicate: boolean): ImportResult {
  const items = receipt.lines.filter((l) => !l.isDiscount);
  return {
    receipt,
    duplicate,
    recognized: items.filter((l) => l.productId).length,
    unrecognized: items.filter((l) => !l.productId).map((l) => l.rawLabel),
  };
}

export const receiptFilePath = (receipt: Pick<Receipt, "filePath">) => (receipt.filePath ? join(FILES_DIR(), receipt.filePath) : null);

export async function deleteReceiptFile(receipt: Pick<Receipt, "filePath">) {
  const path = receiptFilePath(receipt);
  if (path) await rm(path, { force: true });
}

// ── Validation ──

/**
 * Valide un ticket : chaque ligne est rattachée à un produit (créé au besoin), le libellé du ticket
 * est mémorisé pour les prochains imports, et le dernier prix connu de chaque produit est mis à jour.
 */
export async function validateReceipt(householdId: string, receiptId: string) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirstOrThrow({ where: { id: receiptId, householdId }, include: { lines: { orderBy: { position: "asc" } } } });
    for (const line of receipt.lines) {
      if (line.isDiscount) continue;
      const product = line.productId
        ? await tx.product.findUniqueOrThrow({ where: { id: line.productId } })
        : await findOrCreateProduct(tx, householdId, { name: productNameFromLabel(line.label), categoryId: line.categoryId });

      const unitPrice = line.unitPriceCents ?? (line.quantity > 0 ? Math.round(line.totalCents / line.quantity) : line.totalCents);
      if (line.ean && !product.ean) {
        // Le code-barres référence le cache Open Food Facts : entrée vide, complétée plus tard
        await tx.offProduct.upsert({ where: { ean: line.ean }, create: { ean: line.ean, fetchedAt: new Date(0) }, update: {} });
      }
      await tx.product.update({
        where: { id: product.id },
        data: {
          lastUnitPriceCents: unitPrice,
          useCount: { increment: 1 },
          ...(line.categoryId && !product.categoryId && { categoryId: line.categoryId }),
          ...(line.ean && !product.ean && { ean: line.ean }),
        },
      });
      await tx.receiptLine.update({ where: { id: line.id }, data: { productId: product.id, categoryId: line.categoryId ?? product.categoryId } });
      // Mémorisation : « LAIT DEMI ECR 1L » chez cette enseigne = ce produit
      await tx.labelAlias.upsert({
        where: { householdId_chain_normalizedLabel: { householdId, chain: receipt.chain, normalizedLabel: normalize(line.rawLabel) } },
        create: { householdId, chain: receipt.chain, normalizedLabel: normalize(line.rawLabel), productId: product.id },
        update: { productId: product.id },
      });
    }
    return tx.receipt.update({ where: { id: receiptId }, data: { status: "VALIDATED" }, include: receiptInclude });
  });
}
