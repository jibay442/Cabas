// Données de démonstration (SEED_DEMO=true) : une famille fictive.
// Connexion : demo@cabas.local / demo1234

import { prisma } from "../db.ts";
import { hashSecret } from "../lib/crypto.ts";
import { createAccount } from "./households.ts";

const DEMO_EMAIL = "demo@cabas.local";

/** Crée la famille de démo si elle n'existe pas (idempotent). */
export async function seedDemo(log: (msg: string) => void = console.log) {
  if (await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })) {
    log("Seed de démo déjà présent, rien à faire.");
    return;
  }

  const { member: claire } = await createAccount({
    email: DEMO_EMAIL,
    password: "demo1234",
    displayName: "Claire",
    emoji: "👩",
    householdName: "Famille Martin",
  });
  const householdId = claire.householdId;
  await prisma.member.update({
    where: { id: claire.id },
    data: { color: "#ec4899", birthDate: new Date("1987-04-12"), sex: "FEMALE", heightCm: 166, weightKg: 61, activityFactor: 1.375, kcalGoal: 1890 },
  });

  await prisma.member.create({
    data: {
      household: { connect: { id: householdId } },
      role: "PARENT",
      displayName: "Thomas",
      emoji: "👨",
      color: "#0ea5e9",
      allergens: ["en:peanuts"],
      user: { create: { email: "thomas@cabas.local", passwordHash: await hashSecret("demo1234") } },
    },
  });
  await prisma.member.createMany({
    data: [
      { householdId, role: "CHILD", displayName: "Léa", emoji: "👧", color: "#a855f7", pinHash: await hashSecret("1234") },
      { householdId, role: "CHILD", displayName: "Hugo", emoji: "👦", color: "#f97316", allergens: ["en:milk"] },
    ],
  });

  log(`Seed de démo créé : ${DEMO_EMAIL} / demo1234 (PIN de Léa : 1234)`);
}
