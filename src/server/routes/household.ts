import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { InvitationDto } from "../../shared/types.ts";
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { randomToken, sha256 } from "../lib/crypto.ts";
import { householdDto } from "../lib/dto.ts";
import { notFound } from "../lib/errors.ts";
import { auth } from "../plugins/auth.ts";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const INVITATION_DAYS = 7;

export default async function householdRoutes(app: FastifyInstance) {
  app.get("/household", async (request) => householdDto(auth(request).household));

  app.patch("/household", async (request) => {
    const { household } = auth(request, "PARENT");
    const body = z
      .object({
        name: z.string().trim().min(1).max(60).optional(),
        currency: z.string().length(3).toUpperCase().optional(),
        accentColor: hexColor.optional(),
        monthlyBudget: z.number().int().min(0).nullable().optional(),
        alertSettings: z
          .object({
            enabled: z.boolean(),
            nutriscoreMin: z.enum(["c", "d", "e"]),
            nova4: z.boolean(),
            additives: z.boolean(),
            allergens: z.boolean(),
            alternatives: z.boolean(),
          })
          .partial()
          .optional(),
      })
      .parse(request.body);

    const alertSettings = body.alertSettings
      ? { ...(household.alertSettings as object), ...body.alertSettings }
      : undefined;
    const updated = await prisma.household.update({ where: { id: household.id }, data: { ...body, alertSettings } });
    return householdDto(updated);
  });

  /** Génère un nouveau token webhook pour le foyer. Il n'est affiché qu'une seule fois. */
  app.post("/household/webhook-token", async (request) => {
    const { household } = auth(request, "PARENT");
    const token = `cab_${randomToken(24)}`;
    await prisma.household.update({
      where: { id: household.id },
      data: { webhookTokenHash: sha256(token), webhookTokenHint: token.slice(-4) },
    });
    return { token };
  });

  app.get("/household/invitations", async (request): Promise<InvitationDto[]> => {
    const { household } = auth(request, "PARENT");
    const invitations = await prisma.invitation.findMany({
      where: { householdId: household.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    return invitations.map((i) => ({
      id: i.id,
      role: i.role,
      email: i.email,
      expiresAt: i.expiresAt.toISOString(),
      usedAt: i.usedAt?.toISOString() ?? null,
    }));
  });

  app.post("/household/invitations", async (request) => {
    const { household, member } = auth(request, "PARENT");
    const body = z.object({ role: z.enum(["PARENT", "MEMBER"]).default("MEMBER"), email: z.email().optional() }).parse(request.body ?? {});
    const token = randomToken(24);
    await prisma.invitation.create({
      data: {
        householdId: household.id,
        tokenHash: sha256(token),
        role: body.role,
        email: body.email,
        createdById: member.id,
        expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    return { url: `${env.APP_URL.replace(/\/$/, "")}/invite/${token}` };
  });

  app.delete("/household/invitations/:id", async (request) => {
    const { household } = auth(request, "PARENT");
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { count } = await prisma.invitation.deleteMany({ where: { id, householdId: household.id } });
    if (!count) throw notFound();
    return { ok: true };
  });
}
