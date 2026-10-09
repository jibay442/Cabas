// Rayons et magasins du foyer.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CHAINS } from "../../shared/defaults.ts";
import { prisma } from "../db.ts";
import { categoryDto, storeDto } from "../lib/dto.ts";
import { notFound } from "../lib/errors.ts";
import { ADULTS, auth } from "../plugins/auth.ts";

const idParam = z.object({ id: z.string() });
const chainSlug = z.enum(CHAINS.map((c) => c.slug) as [string, ...string[]]);

export default async function catalogRoutes(app: FastifyInstance) {
  // ── Rayons ──
  app.get("/categories", async (request) => {
    const { household } = auth(request);
    const categories = await prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: "asc" } });
    return categories.map(categoryDto);
  });

  app.post("/categories", async (request) => {
    const { household } = auth(request, "PARENT");
    const body = z.object({ name: z.string().trim().min(1).max(40), emoji: z.string().min(1).max(16) }).parse(request.body);
    const last = await prisma.category.aggregate({ where: { householdId: household.id }, _max: { sortOrder: true } });
    const created = await prisma.category.create({
      data: { ...body, householdId: household.id, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return categoryDto(created);
  });

  app.put("/categories/order", async (request) => {
    const { household } = auth(request, "PARENT");
    const { ids } = z.object({ ids: z.array(z.string()).max(200) }).parse(request.body);
    await prisma.$transaction(
      ids.map((id, sortOrder) => prisma.category.updateMany({ where: { id, householdId: household.id }, data: { sortOrder } })),
    );
    return { ok: true };
  });

  app.patch("/categories/:id", async (request) => {
    const { household } = auth(request, "PARENT");
    const { id } = idParam.parse(request.params);
    const body = z.object({ name: z.string().trim().min(1).max(40), emoji: z.string().min(1).max(16) }).partial().parse(request.body);
    const { count } = await prisma.category.updateMany({ where: { id, householdId: household.id }, data: body });
    if (!count) throw notFound();
    return categoryDto(await prisma.category.findUniqueOrThrow({ where: { id } }));
  });

  app.delete("/categories/:id", async (request) => {
    const { household } = auth(request, "PARENT");
    const { id } = idParam.parse(request.params);
    const { count } = await prisma.category.deleteMany({ where: { id, householdId: household.id } });
    if (!count) throw notFound();
    return { ok: true };
  });

  // ── Enseignes & magasins ──
  app.get("/chains", async () => CHAINS);

  app.get("/stores", async (request) => {
    const { household } = auth(request);
    const stores = await prisma.store.findMany({ where: { householdId: household.id }, orderBy: [{ archived: "asc" }, { name: "asc" }] });
    return stores.map(storeDto);
  });

  const storeBody = z.object({
    chain: chainSlug,
    name: z.string().trim().min(1).max(60),
    city: z.string().trim().max(60).nullable().optional(),
    archived: z.boolean().optional(),
  });

  app.post("/stores", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const body = storeBody.parse(request.body);
    return storeDto(await prisma.store.create({ data: { ...body, householdId: household.id } }));
  });

  app.patch("/stores/:id", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const { id } = idParam.parse(request.params);
    const body = storeBody.partial().parse(request.body);
    const { count } = await prisma.store.updateMany({ where: { id, householdId: household.id }, data: body });
    if (!count) throw notFound();
    return storeDto(await prisma.store.findUniqueOrThrow({ where: { id } }));
  });

  app.delete("/stores/:id", async (request) => {
    const { household } = auth(request, ...ADULTS);
    const { id } = idParam.parse(request.params);
    const { count } = await prisma.store.deleteMany({ where: { id, householdId: household.id } });
    if (!count) throw notFound();
    return { ok: true };
  });
}
