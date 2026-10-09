import { guessCategoryKey } from "../../shared/categorize.ts";
import { normalize } from "../../shared/text.ts";
import type { ProductDto } from "../../shared/types.ts";
import type { Tx } from "../db.ts";
import type { Product } from "../generated/prisma/client.ts";

export const productDto = (p: Product): ProductDto => ({
  id: p.id,
  name: p.name,
  categoryId: p.categoryId,
  defaultUnit: p.defaultUnit,
  lastUnitPriceCents: p.lastUnitPriceCents,
  isFavorite: p.isFavorite,
  isRecurring: p.isRecurring,
  useCount: p.useCount,
});

/** Rayon du foyer correspondant au libellé (via le lexique des rayons par défaut) */
async function guessCategoryId(tx: Tx, householdId: string, name: string): Promise<string | null> {
  const key = guessCategoryKey(name);
  if (!key) return null;
  const category = await tx.category.findFirst({ where: { householdId, key }, select: { id: true } });
  return category?.id ?? null;
}

/** Retrouve le produit du foyer portant ce nom (sans tenir compte des accents/majuscules), ou le crée. */
export async function findOrCreateProduct(
  tx: Tx,
  householdId: string,
  input: { name: string; categoryId?: string | null; unit?: string | null },
): Promise<Product> {
  const normalizedName = normalize(input.name);
  const existing = await tx.product.findUnique({ where: { householdId_normalizedName: { householdId, normalizedName } } });
  if (existing) return existing;
  return tx.product.create({
    data: {
      householdId,
      name: input.name.trim(),
      normalizedName,
      categoryId: input.categoryId ?? (await guessCategoryId(tx, householdId, input.name)),
      defaultUnit: input.unit ?? "pcs",
    },
  });
}
