import { CHAINS, DEFAULT_CATEGORIES } from "../../shared/defaults.ts";
import { prisma, type Tx } from "../db.ts";
import { env } from "../env.ts";
import { hashSecret } from "../lib/crypto.ts";
import type { FastifyBaseLogger } from "fastify";

/** Crée un foyer avec ses rayons et enseignes par défaut. */
export async function createHousehold(tx: Tx, name: string) {
  const locale = env.DEFAULT_LOCALE;
  return tx.household.create({
    data: {
      name,
      currency: env.CURRENCY,
      categories: {
        create: DEFAULT_CATEGORIES.map((c, i) => ({ name: c.name[locale], emoji: c.emoji, offTags: c.offTags, sortOrder: i })),
      },
      stores: {
        create: CHAINS.map((c) => ({ chain: c.slug, name: c.name })),
      },
    },
  });
}

/** Crée un compte, et son foyer s'il n'est pas rattaché à un foyer existant. */
export async function createAccount(input: {
  email: string;
  password: string;
  displayName: string;
  emoji?: string;
  householdName?: string;
  join?: { householdId: string; role: "PARENT" | "MEMBER" };
}) {
  const passwordHash = await hashSecret(input.password);
  return prisma.$transaction(async (tx) => {
    const householdId = input.join?.householdId ?? (await createHousehold(tx, input.householdName ?? env.ADMIN_HOUSEHOLD)).id;
    const user = await tx.user.create({ data: { email: input.email.toLowerCase(), passwordHash, locale: env.DEFAULT_LOCALE } });
    const member = await tx.member.create({
      data: {
        householdId,
        userId: user.id,
        role: input.join?.role ?? "PARENT",
        displayName: input.displayName,
        emoji: input.emoji ?? "😀",
      },
    });
    return { user, member };
  });
}

/** Premier démarrage : crée l'administrateur défini dans .env si la base est vide. */
export async function bootstrapAdmin(log: FastifyBaseLogger) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  if ((await prisma.user.count()) > 0) return;
  await createAccount({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    displayName: env.ADMIN_EMAIL.split("@")[0] ?? "Admin",
    emoji: "👑",
  });
  log.info({ email: env.ADMIN_EMAIL }, "Administrateur créé");
}
