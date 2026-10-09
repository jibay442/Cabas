import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { normalize, UNITS } from "../../shared/text.ts";
import { prisma } from "../db.ts";
import { badRequest, notFound } from "../lib/errors.ts";
import { ADULTS, auth } from "../plugins/auth.ts";
import { publish } from "../services/events.ts";
import { productDto } from "../services/products.ts";

export default async function productRoutes(app: FastifyInstance) {
  /** Auto-complétion : produits du foyer dont un mot commence par la saisie, les plus utilisés d'abord */
  app.get("/products/suggest", async (request) => {
    const { household } = auth(request);
    const { q } = z.object({ q: z.string().max(80).default("") }).parse(request.query);
    const query = normalize(q);
    if (!query) return [];
    const products = await prisma.product.findMany({
      where: {
        householdId: household.id,
        OR: [{ normalizedName: { startsWith: query } }, { normalizedName: { contains: ` ${query}` } }],
      },
      orderBy: [{ useCount: "desc" }, { name: "asc" }],
      take: 8,
    });
    return products.map(productDto);
  });

  app.get("/products", async (request) => {
    const { household } = auth(request);
    const query = z
      .object({ favorite: z.stringbool().optional(), recurring: z.stringbool().optional(), q: z.string().max(80).optional() })
      .parse(request.query);
    const products = await prisma.product.findMany({
      where: {
        householdId: household.id,
        ...(query.favorite !== undefined && { isFavorite: query.favorite }),
        ...(query.recurring !== undefined && { isRecurring: query.recurring }),
        ...(query.q && { normalizedName: { contains: normalize(query.q) } }),
      },
      orderBy: [{ useCount: "desc" }, { name: "asc" }],
      take: 300,
    });
    return products.map(productDto);
  });

  app.patch("/products/:id", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = z
      .object({
        isFavorite: z.boolean(),
        isRecurring: z.boolean(),
        categoryId: z.string().nullable(),
        defaultUnit: z.enum(UNITS),
        lastUnitPriceCents: z.number().int().min(0).nullable(),
      })
      .partial()
      .parse(request.body);
    if (body.categoryId && !(await prisma.category.count({ where: { id: body.categoryId, householdId: a.household.id } }))) {
      throw badRequest("bad_category");
    }
    const { count } = await prisma.product.updateMany({ where: { id, householdId: a.household.id }, data: body });
    if (!count) throw notFound();
    publish(a.household.id, { topic: "products", by: a.member.id });
    return productDto(await prisma.product.findUniqueOrThrow({ where: { id } }));
  });
}
