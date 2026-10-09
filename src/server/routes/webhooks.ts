// Import automatique des tickets (n8n ou tout autre outil) : POST /api/webhooks/receipt
//
// Authentification : « Authorization: Bearer <token> » avec
//  - le token du foyer (Réglages › Foyer), ou
//  - le token global WEBHOOK_TOKEN + `householdToken` (ou `householdId`) dans la requête.
// Corps : JSON (fichier en base64 facultatif) ou multipart/form-data (champ fichier + mêmes champs).

import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { sha256 } from "../lib/crypto.ts";
import { badRequest, HttpError } from "../lib/errors.ts";
import { importReceipt } from "../services/receipts.ts";
import { checkFile, readMultipart } from "./receipts.ts";

const euros = z.coerce.number().min(-100_000).max(1_000_000);
const toCents = (value: number) => Math.round(value * 100);

const bodySchema = z.object({
  householdToken: z.string().optional(),
  householdId: z.string().optional(),
  store: z.string().max(100).optional(),
  date: z.string().optional(),
  total: euros.optional(),
  source: z.string().max(40).optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().max(200).optional(),
  rawText: z.string().max(200_000).optional(),
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        qty: z.coerce.number().positive().max(100_000).default(1),
        unitPrice: euros.optional(),
        total: euros.optional(),
        ean: z
          .string()
          .regex(/^\d{8,14}$/)
          .optional(),
      }),
    )
    .max(300)
    .optional(),
});

const sameSecret = (a: string, b: string) => timingSafeEqual(Buffer.from(sha256(a), "hex"), Buffer.from(sha256(b), "hex"));

/** Le token global n'est actif que s'il a été personnalisé */
const globalToken = () => (env.WEBHOOK_TOKEN && env.WEBHOOK_TOKEN.length >= 16 && !env.WEBHOOK_TOKEN.includes("change-me") ? env.WEBHOOK_TOKEN : null);

async function resolveHousehold(request: FastifyRequest, body: { householdToken?: string; householdId?: string }) {
  const token = (request.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "token_required", "En-tête Authorization: Bearer <token> manquant");

  const own = await prisma.household.findUnique({ where: { webhookTokenHash: sha256(token) } });
  if (own) return own;

  const global = globalToken();
  if (!global || !sameSecret(token, global)) throw new HttpError(401, "invalid_token", "Token invalide");
  if (body.householdToken) {
    const household = await prisma.household.findUnique({ where: { webhookTokenHash: sha256(body.householdToken) } });
    if (!household) throw new HttpError(404, "household_not_found", "householdToken inconnu");
    return household;
  }
  if (body.householdId) {
    const household = await prisma.household.findUnique({ where: { id: body.householdId } });
    if (!household) throw new HttpError(404, "household_not_found", "householdId inconnu");
    return household;
  }
  // Instance à un seul foyer : pas besoin de le préciser
  const households = await prisma.household.findMany({ take: 2, select: { id: true } });
  if (households.length === 1) return prisma.household.findUniqueOrThrow({ where: { id: households[0]!.id } });
  throw badRequest("household_required", "Plusieurs foyers : précisez householdToken");
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/receipt", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    let body: z.infer<typeof bodySchema>;
    let file: { buffer: Buffer; mime: string } | undefined;

    if (request.isMultipart()) {
      const { fields, file: part } = await readMultipart(request);
      const { lines, ...rest } = fields;
      let parsedLines: unknown;
      try {
        parsedLines = lines ? JSON.parse(lines) : undefined;
      } catch {
        throw badRequest("bad_lines", "Le champ lines doit contenir du JSON");
      }
      body = bodySchema.parse({ ...rest, lines: parsedLines });
      if (part) file = checkFile(part.buffer);
    } else {
      body = bodySchema.parse(request.body);
      if (body.fileBase64) {
        const buffer = Buffer.from(body.fileBase64.replace(/^data:[^,]+,/, ""), "base64");
        if (buffer.length > env.MAX_UPLOAD_MB * 1024 * 1024) throw new HttpError(413, "file_too_large", "Fichier trop volumineux");
        file = checkFile(buffer);
      }
    }
    if (!file && !body.rawText && !body.lines?.length && body.total === undefined) {
      throw badRequest("empty", "Envoyez un fichier, du texte (rawText), des lignes ou au moins un total");
    }

    const household = await resolveHousehold(request, body);
    const result = await importReceipt({
      householdId: household.id,
      source: "WEBHOOK",
      file,
      rawText: body.rawText,
      chainHint: body.store,
      purchasedAt: parseDate(body.date),
      totalCents: body.total !== undefined ? toCents(body.total) : null,
      lines: body.lines?.map((l) => {
        const total = l.total ?? (l.unitPrice !== undefined ? l.unitPrice * l.qty : 0);
        return {
          label: l.label,
          quantity: l.qty,
          unitPriceCents: l.unitPrice !== undefined ? toCents(l.unitPrice) : null,
          totalCents: toCents(total),
          ean: l.ean ?? null,
          isDiscount: total < 0,
        };
      }),
    });

    request.log.info({ receiptId: result.receipt.id, duplicate: result.duplicate, lines: result.receipt.lines.length }, "Ticket reçu par webhook");
    return {
      receiptId: result.receipt.id,
      duplicate: result.duplicate,
      status: result.receipt.status,
      store: result.receipt.chain,
      date: result.receipt.purchasedAt.toISOString(),
      total: result.receipt.totalCents / 100,
      linesRecognized: result.recognized,
      unrecognized: result.unrecognized,
    };
  });
}
