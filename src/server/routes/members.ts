import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.ts";
import { hashSecret } from "../lib/crypto.ts";
import { memberDto } from "../lib/dto.ts";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.ts";
import { auth } from "../plugins/auth.ts";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pin = z.string().regex(/^\d{4,6}$/, "Le code PIN doit contenir 4 à 6 chiffres");
const profile = {
  displayName: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(16).optional(),
  color: hexColor.optional(),
};

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("child"), ...profile, pin: pin.optional() }),
  z.object({
    kind: z.literal("adult"),
    ...profile,
    email: z.email(),
    password: z.string().min(8).max(200),
    role: z.enum(["PARENT", "MEMBER"]).default("MEMBER"),
  }),
]);

const updateSchema = z.object({
  displayName: profile.displayName.optional(),
  emoji: profile.emoji,
  color: profile.color,
  pin: pin.nullable().optional(),
  role: z.enum(["PARENT", "MEMBER"]).optional(),
  birthDate: z.iso.date().nullable().optional(),
  sex: z.enum(["FEMALE", "MALE"]).nullable().optional(),
  heightCm: z.number().min(40).max(250).nullable().optional(),
  weightKg: z.number().min(2).max(400).nullable().optional(),
  activityFactor: z.number().min(1).max(2.5).nullable().optional(),
  kcalGoal: z.number().int().min(500).max(6000).nullable().optional(),
  journalPrivate: z.boolean().optional(),
  allergens: z.array(z.string().max(60)).max(30).optional(),
});

export default async function memberRoutes(app: FastifyInstance) {
  app.get("/members", async (request) => {
    const { household, member: viewer } = auth(request);
    const members = await prisma.member.findMany({
      where: { householdId: household.id },
      include: { user: { select: { email: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    return members.map((m) => memberDto(m, viewer));
  });

  app.post("/members", async (request) => {
    const { household, member: viewer } = auth(request, "PARENT");
    const body = createSchema.parse(request.body);
    const base = { householdId: household.id, displayName: body.displayName, emoji: body.emoji, color: body.color };

    if (body.kind === "child") {
      const created = await prisma.member.create({
        data: { ...base, emoji: body.emoji ?? "🧒", role: "CHILD", pinHash: body.pin ? await hashSecret(body.pin) : null },
      });
      return memberDto(created, viewer);
    }

    const email = body.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw conflict("email_taken", "Un compte existe déjà avec cet email");
    const passwordHash = await hashSecret(body.password);
    const { householdId, ...fields } = base;
    const created = await prisma.member.create({
      data: { ...fields, role: body.role, household: { connect: { id: householdId } }, user: { create: { email, passwordHash } } },
      include: { user: { select: { email: true } } },
    });
    return memberDto(created, viewer);
  });

  app.patch("/members/:id", async (request) => {
    const { household, member: viewer } = auth(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = updateSchema.parse(request.body);
    const target = await prisma.member.findFirst({ where: { id, householdId: household.id } });
    if (!target) throw notFound();

    const isParent = viewer.role === "PARENT";
    const isSelf = viewer.id === target.id;
    // Un parent gère tout le foyer ; un adulte gère son propre profil ; un enfant ne modifie rien.
    if (!isParent && !(isSelf && viewer.role !== "CHILD")) throw forbidden();

    if (body.pin !== undefined && !(isParent && target.role === "CHILD")) throw forbidden("Seul un parent définit le PIN d'un enfant");
    if (body.journalPrivate !== undefined && (target.role === "CHILD" || !isSelf)) {
      throw forbidden("Seul un adulte peut rendre son propre journal privé");
    }
    if (body.role !== undefined) {
      if (!isParent || target.role === "CHILD") throw forbidden();
      if (target.role === "PARENT" && body.role !== "PARENT") {
        const parents = await prisma.member.count({ where: { householdId: household.id, role: "PARENT" } });
        if (parents <= 1) throw badRequest("last_parent", "Le foyer doit garder au moins un parent");
      }
    }

    const { pin: newPin, birthDate, ...rest } = body;
    const updated = await prisma.member.update({
      where: { id },
      data: {
        ...rest,
        birthDate: birthDate === undefined ? undefined : birthDate ? new Date(birthDate) : null,
        pinHash: newPin === undefined ? undefined : newPin ? await hashSecret(newPin) : null,
      },
      include: { user: { select: { email: true } } },
    });
    return memberDto(updated, viewer);
  });

  app.delete("/members/:id", async (request) => {
    const { household, ownMemberId } = auth(request, "PARENT");
    const { id } = z.object({ id: z.string() }).parse(request.params);
    if (id === ownMemberId) throw badRequest("self_delete", "Vous ne pouvez pas vous retirer vous-même du foyer");
    const target = await prisma.member.findFirst({ where: { id, householdId: household.id } });
    if (!target) throw notFound();

    await prisma.$transaction(async (tx) => {
      await tx.member.delete({ where: { id } });
      // Un compte n'appartient qu'à un foyer : il disparaît avec son profil
      if (target.userId) await tx.user.delete({ where: { id: target.userId } });
    });
    return { ok: true };
  });
}
