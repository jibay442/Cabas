import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { analyzeReceipt } from "../../receipts/pipeline.ts";
import { prisma } from "../db.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { sniffMime } from "../lib/mime.ts";
import { ADULTS, auth } from "../plugins/auth.ts";
import { publish } from "../services/events.ts";
import {
  deleteReceiptFile,
  importReceipt,
  matchProducts,
  receiptDetailDto,
  receiptFilePath,
  receiptInclude,
  receiptSummaryDto,
  validateReceipt,
} from "../services/receipts.ts";

const idParams = z.object({ id: z.string() });
const cents = z.number().int().min(-1_000_000).max(10_000_000);

const lineSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1).max(120),
  rawLabel: z.string().trim().max(120).optional(),
  quantity: z.number().positive().max(100_000).default(1),
  unitPriceCents: cents.nullable().optional(),
  totalCents: cents,
  productId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isDiscount: z.boolean().default(false),
});

/** Lecture d'un envoi multipart : un fichier + quelques champs texte */
export async function readMultipart(request: FastifyRequest) {
  const fields: Record<string, string> = {};
  let file: { buffer: Buffer; filename: string } | null = null;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (file) {
        await part.toBuffer(); // un seul fichier par ticket : les suivants sont ignorés
        continue;
      }
      file = { buffer: await part.toBuffer(), filename: part.filename };
    } else if (typeof part.value === "string") {
      fields[part.fieldname] = part.value;
    }
  }
  return { fields, file };
}

/** Vérifie le type réel du fichier (PDF, JPEG, PNG, WebP) */
export function checkFile(buffer: Buffer) {
  const mime = sniffMime(buffer);
  if (!mime) throw badRequest("unsupported_file", "Format non pris en charge : envoyez un PDF ou une photo (JPEG, PNG, WebP).");
  return { buffer, mime };
}

export default async function receiptRoutes(app: FastifyInstance) {
  app.get("/receipts", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const query = z
      .object({ status: z.enum(["TO_REVIEW", "VALIDATED", "FAILED"]).optional(), take: z.coerce.number().int().min(1).max(500).default(100) })
      .parse(request.query);
    const receipts = await prisma.receipt.findMany({
      where: { householdId: household.id, ...(query.status && { status: query.status }) },
      include: receiptInclude,
      orderBy: { purchasedAt: "desc" },
      take: query.take,
    });
    return receipts.map(receiptSummaryDto);
  });

  app.get("/receipts/:id", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: household.id }, include: receiptInclude });
    if (!receipt) throw notFound("Ticket introuvable");
    return receiptDetailDto(receipt);
  });

  app.get("/receipts/:id/file", async (request, reply) => {
    const { household } = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: household.id } });
    const path = receipt && receiptFilePath(receipt);
    if (!receipt || !path) throw notFound("Fichier introuvable");
    const info = await stat(path).catch(() => null);
    if (!info) throw notFound("Fichier introuvable");
    return reply
      .type(receipt.fileMime ?? "application/octet-stream")
      .header("content-length", info.size)
      .header("content-disposition", "inline")
      .header("cache-control", "private, max-age=3600")
      .send(createReadStream(path));
  });

  /** Photo ou PDF envoyé depuis l'application */
  app.post("/receipts/upload", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const { household } = auth(request, ...ADULTS);
    if (!request.isMultipart()) throw badRequest("multipart_required");
    const { fields, file } = await readMultipart(request);
    if (!file) throw badRequest("file_required", "Aucun fichier reçu");
    const result = await importReceipt({
      householdId: household.id,
      source: "UPLOAD",
      file: checkFile(file.buffer),
      storeId: fields.storeId || null,
      listId: fields.listId || null,
    });
    return { ...receiptSummaryDto(result.receipt), duplicate: result.duplicate };
  });

  /** Saisie manuelle d'un ticket simplifié */
  app.post("/receipts", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const body = z
      .object({
        storeId: z.string().nullable().optional(),
        purchasedAt: z.iso.datetime({ offset: true }).or(z.iso.date()),
        totalCents: cents.min(0),
        lines: z.array(lineSchema).max(300).default([]),
      })
      .parse(request.body);
    const result = await importReceipt({
      householdId: household.id,
      source: "MANUAL",
      manual: true,
      storeId: body.storeId,
      purchasedAt: new Date(body.purchasedAt),
      totalCents: body.totalCents,
      lines: body.lines.map((l) => ({
        label: l.label,
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents ?? null,
        totalCents: l.totalCents,
        ean: null,
        isDiscount: l.isDiscount || l.totalCents < 0,
      })),
    });
    return receiptSummaryDto(result.receipt);
  });

  app.patch("/receipts/:id", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({
        storeId: z.string().nullable(),
        purchasedAt: z.iso.datetime({ offset: true }).or(z.iso.date()),
        totalCents: cents.min(0),
        listId: z.string().nullable(),
      })
      .partial()
      .parse(request.body);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: a.household.id } });
    if (!receipt) throw notFound("Ticket introuvable");
    const store = body.storeId ? await prisma.store.findFirst({ where: { id: body.storeId, householdId: a.household.id } }) : null;
    if (body.storeId && !store) throw badRequest("bad_store");
    if (body.listId && !(await prisma.shoppingList.count({ where: { id: body.listId, householdId: a.household.id } }))) throw badRequest("bad_list");
    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        storeId: body.storeId,
        ...(store && { chain: store.chain }),
        purchasedAt: body.purchasedAt ? new Date(body.purchasedAt) : undefined,
        totalCents: body.totalCents,
        listId: body.listId,
      },
      include: receiptInclude,
    });
    publish(a.household.id, { topic: "receipts", id, by: a.member.id });
    return receiptDetailDto(updated);
  });

  /** Correction des lignes : les lignes absentes sont supprimées, les nouvelles créées */
  app.put("/receipts/:id/lines", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const { lines } = z.object({ lines: z.array(lineSchema).max(300) }).parse(request.body);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: a.household.id }, include: { lines: { select: { id: true } } } });
    if (!receipt) throw notFound("Ticket introuvable");

    const productIds = [...new Set(lines.map((l) => l.productId).filter((p): p is string => !!p))];
    const categoryIds = [...new Set(lines.map((l) => l.categoryId).filter((c): c is string => !!c))];
    if ((await prisma.product.count({ where: { id: { in: productIds }, householdId: a.household.id } })) !== productIds.length) throw badRequest("bad_product");
    if ((await prisma.category.count({ where: { id: { in: categoryIds }, householdId: a.household.id } })) !== categoryIds.length) throw badRequest("bad_category");

    const existingIds = new Set(receipt.lines.map((l) => l.id));
    const keptIds = new Set(lines.map((l) => l.id).filter((lineId): lineId is string => !!lineId && existingIds.has(lineId)));
    const updated = await prisma.$transaction(async (tx) => {
      await tx.receiptLine.deleteMany({ where: { receiptId: id, id: { notIn: [...keptIds] } } });
      for (const [position, l] of lines.entries()) {
        const data = {
          position,
          label: l.label,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents ?? null,
          totalCents: l.totalCents,
          productId: l.productId ?? null,
          categoryId: l.categoryId ?? null,
          isDiscount: l.isDiscount || l.totalCents < 0,
        };
        if (l.id && keptIds.has(l.id)) await tx.receiptLine.update({ where: { id: l.id }, data });
        else await tx.receiptLine.create({ data: { ...data, receiptId: id, rawLabel: l.rawLabel || l.label } });
      }
      return tx.receipt.update({ where: { id }, data: { status: receipt.status === "FAILED" ? "TO_REVIEW" : undefined }, include: receiptInclude });
    });
    return receiptDetailDto(updated);
  });

  /** Relance l'analyse du texte (par exemple après avoir corrigé l'enseigne) */
  app.post("/receipts/:id/reparse", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: a.household.id } });
    if (!receipt) throw notFound("Ticket introuvable");
    if (!receipt.rawText) throw badRequest("no_text", "Aucun texte à analyser pour ce ticket");
    const analyzed = await analyzeReceipt({ rawText: receipt.rawText, chain: receipt.chain, ocrEnabled: false });
    const updated = await prisma.$transaction(async (tx) => {
      const products = await matchProducts(tx, a.household.id, receipt.chain, analyzed.lines);
      await tx.receiptLine.deleteMany({ where: { receiptId: id } });
      return tx.receipt.update({
        where: { id },
        data: {
          parser: analyzed.parser,
          status: "TO_REVIEW",
          lines: {
            create: analyzed.lines.map((l, position) => ({
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
    return receiptDetailDto(updated);
  });

  app.post("/receipts/:id/validate", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    if (!(await prisma.receipt.count({ where: { id, householdId: a.household.id } }))) throw notFound("Ticket introuvable");
    const receipt = await validateReceipt(a.household.id, id);
    publish(a.household.id, { topic: "receipts", id, by: a.member.id });
    publish(a.household.id, { topic: "products", by: a.member.id });
    return receiptDetailDto(receipt);
  });

  app.delete("/receipts/:id", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const receipt = await prisma.receipt.findFirst({ where: { id, householdId: a.household.id } });
    if (!receipt) throw notFound("Ticket introuvable");
    await prisma.receipt.delete({ where: { id } });
    await deleteReceiptFile(receipt);
    publish(a.household.id, { topic: "receipts", id, by: a.member.id });
    return { ok: true };
  });
}
