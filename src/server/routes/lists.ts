import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { defaultListTitle } from "../../shared/listTitle.ts";
import { lineTotalCents, UNITS } from "../../shared/text.ts";
import type { ListDetailDto, ListItemDto, ListSummaryDto } from "../../shared/types.ts";
import { prisma, type Tx } from "../db.ts";
import type { ListItem, Member, Product, ShoppingList } from "../generated/prisma/client.ts";
import { env } from "../env.ts";
import { badRequest, forbidden, notFound } from "../lib/errors.ts";
import { ADULTS, auth, type Auth } from "../plugins/auth.ts";
import { publish } from "../services/events.ts";
import { findOrCreateProduct } from "../services/products.ts";

type ItemWithRelations = ListItem & { forMembers: Pick<Member, "id">[]; product: Pick<Product, "isFavorite" | "isRecurring"> };

const itemInclude = {
  forMembers: { select: { id: true } },
  product: { select: { isFavorite: true, isRecurring: true } },
} as const;

function itemDto(i: ItemWithRelations): ListItemDto {
  return {
    id: i.id,
    listId: i.listId,
    productId: i.productId,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    estUnitPriceCents: i.estUnitPriceCents,
    note: i.note,
    categoryId: i.categoryId,
    storeId: i.storeId,
    addedById: i.addedById,
    forMemberIds: i.forMembers.map((m) => m.id),
    checked: i.checked,
    checkedById: i.checkedById,
    checkedAt: i.checkedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
    product: i.product,
  };
}

function summaryDto(list: ShoppingList, items: Pick<ListItem, "quantity" | "unit" | "estUnitPriceCents" | "checked">[]): ListSummaryDto {
  return {
    id: list.id,
    name: list.name,
    status: list.status,
    storeId: list.storeId,
    createdById: list.createdById,
    createdAt: list.createdAt.toISOString(),
    archivedAt: list.archivedAt?.toISOString() ?? null,
    itemCount: items.length,
    checkedCount: items.filter((i) => i.checked).length,
    estimatedCents: items.reduce((sum, i) => sum + lineTotalCents(i), 0),
  };
}

const idParams = z.object({ id: z.string() });
const itemParams = z.object({ id: z.string(), itemId: z.string() });
const price = z.number().int().min(0).max(1_000_000).nullable();

const itemFields = {
  quantity: z.number().positive().max(100_000),
  unit: z.enum(UNITS),
  estUnitPriceCents: price,
  note: z.string().trim().max(200).nullable(),
  categoryId: z.string().nullable(),
  storeId: z.string().nullable(),
  forMemberIds: z.array(z.string()).max(30),
};

const addItemSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    productId: z.string().optional(),
    ...z.object(itemFields).partial().shape,
  })
  .refine((b) => b.name || b.productId, { message: "Nom ou produit requis" });

/** « Courses du jeudi 9 octobre », suffixé « (2) », « (3) »… si ce titre existe déjà */
async function newListTitle(tx: Tx, householdId: string, locale: string): Promise<string> {
  const base = defaultListTitle(new Date(), locale === "en" ? "en" : "fr", env.TZ);
  const taken = new Set(
    (await tx.shoppingList.findMany({ where: { householdId, name: { startsWith: base } }, select: { name: true } })).map((l) => l.name),
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

async function findList(householdId: string, id: string) {
  const list = await prisma.shoppingList.findFirst({ where: { id, householdId } });
  if (!list) throw notFound("Liste introuvable");
  return list;
}

/** Vérifie que les rayons, magasins et membres cités appartiennent bien au foyer */
async function checkRefs(tx: Tx, householdId: string, refs: { categoryId?: string | null; storeId?: string | null; forMemberIds?: string[] }) {
  if (refs.categoryId && !(await tx.category.count({ where: { id: refs.categoryId, householdId } }))) throw badRequest("bad_category");
  if (refs.storeId && !(await tx.store.count({ where: { id: refs.storeId, householdId } }))) throw badRequest("bad_store");
  if (refs.forMemberIds?.length) {
    const count = await tx.member.count({ where: { id: { in: refs.forMemberIds }, householdId } });
    if (count !== new Set(refs.forMemberIds).size) throw badRequest("bad_member");
  }
}

/**
 * Ajoute un article à une liste. Si le même produit est déjà sur la liste (non coché, même unité),
 * la quantité est cumulée au lieu de créer un doublon.
 */
async function addItem(tx: Tx, a: Auth, listId: string, body: z.infer<typeof addItemSchema>): Promise<ListItem> {
  const householdId = a.household.id;
  await checkRefs(tx, householdId, body);

  let product: Product;
  if (body.productId) {
    const found = await tx.product.findFirst({ where: { id: body.productId, householdId } });
    if (!found) throw notFound("Produit introuvable");
    product = found;
  } else {
    product = await findOrCreateProduct(tx, householdId, { name: body.name!, categoryId: body.categoryId, unit: body.unit });
  }
  await tx.product.update({ where: { id: product.id }, data: { useCount: { increment: 1 } } });

  const unit = body.unit ?? product.defaultUnit;
  const quantity = body.quantity ?? 1;
  const duplicate = await tx.listItem.findFirst({ where: { listId, productId: product.id, checked: false, unit } });
  if (duplicate) {
    return tx.listItem.update({ where: { id: duplicate.id }, data: { quantity: duplicate.quantity + quantity } });
  }

  return tx.listItem.create({
    data: {
      listId,
      productId: product.id,
      name: body.name ?? product.name,
      quantity,
      unit,
      estUnitPriceCents: body.estUnitPriceCents !== undefined ? body.estUnitPriceCents : product.lastUnitPriceCents,
      note: body.note || null,
      categoryId: body.categoryId !== undefined ? body.categoryId : product.categoryId,
      storeId: body.storeId ?? null,
      addedById: a.member.id,
      forMembers: body.forMemberIds?.length ? { connect: body.forMemberIds.map((id) => ({ id })) } : undefined,
    },
  });
}

export default async function listRoutes(app: FastifyInstance) {
  const changed = (a: Auth, listId: string) => {
    publish(a.household.id, { topic: "list", id: listId, by: a.member.id });
    publish(a.household.id, { topic: "lists", by: a.member.id });
  };

  // ── Listes ──

  app.get("/lists", async (request) => {
    const { household } = auth(request);
    const { status } = z.object({ status: z.enum(["active", "archived"]).default("active") }).parse(request.query);
    const lists = await prisma.shoppingList.findMany({
      where: { householdId: household.id, status: status === "active" ? "ACTIVE" : "ARCHIVED" },
      include: { items: { select: { quantity: true, unit: true, estUnitPriceCents: true, checked: true } } },
      orderBy: status === "active" ? { createdAt: "asc" } : { archivedAt: "desc" },
      take: status === "active" ? undefined : 100,
    });
    return lists.map((l) => summaryDto(l, l.items));
  });

  app.post("/lists", async (request) => {
    const a = auth(request, ...ADULTS);
    const body = z.object({ name: z.string().trim().min(1).max(60).optional(), storeId: z.string().nullable().optional() }).parse(request.body ?? {});
    await checkRefs(prisma, a.household.id, body);
    const name = body.name ?? (await newListTitle(prisma, a.household.id, a.user.locale));
    const list = await prisma.shoppingList.create({ data: { ...body, name, householdId: a.household.id, createdById: a.member.id } });
    publish(a.household.id, { topic: "lists", by: a.member.id });
    return summaryDto(list, []);
  });

  app.get("/lists/:id", async (request): Promise<ListDetailDto> => {
    const { household } = auth(request);
    const { id } = idParams.parse(request.params);
    const list = await prisma.shoppingList.findFirst({
      where: { id, householdId: household.id },
      include: { items: { include: itemInclude, orderBy: { createdAt: "asc" } } },
    });
    if (!list) throw notFound("Liste introuvable");
    return { ...summaryDto(list, list.items), items: list.items.map(itemDto) };
  });

  app.patch("/lists/:id", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const body = z
      .object({ name: z.string().trim().min(1).max(60), storeId: z.string().nullable(), status: z.enum(["ACTIVE", "ARCHIVED"]) })
      .partial()
      .parse(request.body);
    await findList(a.household.id, id);
    await checkRefs(prisma, a.household.id, body);
    const archivedAt = body.status === undefined ? undefined : body.status === "ARCHIVED" ? new Date() : null;
    const list = await prisma.shoppingList.update({ where: { id }, data: { ...body, archivedAt } });
    changed(a, id);
    return summaryDto(list, []);
  });

  app.delete("/lists/:id", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    await findList(a.household.id, id);
    await prisma.shoppingList.delete({ where: { id } });
    changed(a, id);
    return { ok: true };
  });

  /** Fin des courses : archive la liste ; les articles non pris peuvent passer sur une nouvelle liste. */
  app.post("/lists/:id/finish", async (request) => {
    const a = auth(request, ...ADULTS);
    const { id } = idParams.parse(request.params);
    const { carryOver } = z.object({ carryOver: z.boolean().default(true) }).parse(request.body ?? {});
    const list = await findList(a.household.id, id);

    const newListId = await prisma.$transaction(async (tx) => {
      await tx.shoppingList.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
      const remaining = await tx.listItem.findMany({ where: { listId: id, checked: false }, select: { id: true } });
      if (!carryOver || !remaining.length) return null;
      const next = await tx.shoppingList.create({
        data: { householdId: a.household.id, name: await newListTitle(tx, a.household.id, a.user.locale), storeId: list.storeId, createdById: a.member.id },
      });
      await tx.listItem.updateMany({ where: { id: { in: remaining.map((i) => i.id) } }, data: { listId: next.id } });
      return next.id;
    });

    changed(a, id);
    if (newListId) changed(a, newListId);
    return { newListId };
  });

  // ── Articles ──

  app.post("/lists/:id/items", async (request) => {
    const a = auth(request);
    const { id } = idParams.parse(request.params);
    const body = addItemSchema.parse(request.body);
    await findList(a.household.id, id);
    const item = await prisma.$transaction((tx) => addItem(tx, a, id, body));
    changed(a, id);
    return itemDto(await prisma.listItem.findUniqueOrThrow({ where: { id: item.id }, include: itemInclude }));
  });

  /**
   * Ajout groupé : articles issus d'une note (tous les membres),
   * ou produits connus — favoris, récurrents, reports (adultes).
   */
  app.post("/lists/:id/items/bulk", async (request) => {
    const a = auth(request);
    const { id } = idParams.parse(request.params);
    const body = z
      .union([
        z.object({ productIds: z.array(z.string()).min(1).max(200) }),
        z.object({
          items: z
            .array(
              z.object({
                name: z.string().trim().min(1).max(80),
                quantity: itemFields.quantity.optional(),
                unit: itemFields.unit.nullable().optional(),
                note: itemFields.note.optional(),
              }),
            )
            .min(1)
            .max(100),
        }),
      ])
      .parse(request.body);
    if ("productIds" in body && a.member.role === "CHILD") throw forbidden();
    await findList(a.household.id, id);
    await prisma.$transaction(async (tx) => {
      if ("productIds" in body) {
        for (const productId of new Set(body.productIds)) await addItem(tx, a, id, { productId });
      } else {
        for (const item of body.items) await addItem(tx, a, id, { ...item, unit: item.unit ?? undefined });
      }
    });
    changed(a, id);
    return { ok: true };
  });

  app.patch("/lists/:id/items/:itemId", async (request) => {
    const a = auth(request);
    const { id, itemId } = itemParams.parse(request.params);
    const body = z
      .object({ name: z.string().trim().min(1).max(80), checked: z.boolean(), ...itemFields })
      .partial()
      .parse(request.body);
    await findList(a.household.id, id);
    const item = await prisma.listItem.findFirst({ where: { id: itemId, listId: id } });
    if (!item) throw notFound("Article introuvable");

    // Un enfant peut cocher n'importe quel article, mais ne modifie que les siens
    const onlyChecks = Object.keys(body).every((k) => k === "checked");
    if (a.member.role === "CHILD" && !onlyChecks && item.addedById !== a.member.id) throw forbidden();

    const { forMemberIds, checked, name, ...fields } = body;
    await prisma.$transaction(async (tx) => {
      await checkRefs(tx, a.household.id, body);
      // Renommer rattache l'article au produit correspondant au nouveau nom
      const product = name && name !== item.name ? await findOrCreateProduct(tx, a.household.id, { name, categoryId: body.categoryId }) : null;
      await tx.listItem.update({
        where: { id: itemId },
        data: {
          ...fields,
          name,
          productId: product?.id,
          checked,
          checkedAt: checked === undefined ? undefined : checked ? new Date() : null,
          checkedById: checked === undefined ? undefined : checked ? a.member.id : null,
          forMembers: forMemberIds ? { set: forMemberIds.map((m) => ({ id: m })) } : undefined,
        },
      });
      // Le produit retient le rayon et le dernier prix choisis, pour les prochains ajouts
      const productUpdate: { categoryId?: string | null; lastUnitPriceCents?: number; defaultUnit?: string } = {};
      if (body.categoryId !== undefined) productUpdate.categoryId = body.categoryId;
      if (body.estUnitPriceCents != null) productUpdate.lastUnitPriceCents = body.estUnitPriceCents;
      if (body.unit) productUpdate.defaultUnit = body.unit;
      if (Object.keys(productUpdate).length) {
        await tx.product.update({ where: { id: product?.id ?? item.productId }, data: productUpdate });
      }
    });

    changed(a, id);
    return itemDto(await prisma.listItem.findUniqueOrThrow({ where: { id: itemId }, include: itemInclude }));
  });

  app.delete("/lists/:id/items/:itemId", async (request) => {
    const a = auth(request);
    const { id, itemId } = itemParams.parse(request.params);
    await findList(a.household.id, id);
    const item = await prisma.listItem.findFirst({ where: { id: itemId, listId: id } });
    if (!item) throw notFound("Article introuvable");
    if (a.member.role === "CHILD" && item.addedById !== a.member.id) throw forbidden();
    await prisma.listItem.delete({ where: { id: itemId } });
    changed(a, id);
    return { ok: true };
  });
}
