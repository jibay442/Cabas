import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { MeDto } from "../../shared/types.ts";
import { prisma } from "../db.ts";
import { env } from "../env.ts";
import { hashSecret, sha256, verifySecret } from "../lib/crypto.ts";
import { householdDto, memberDto } from "../lib/dto.ts";
import { badRequest, conflict, forbidden, HttpError, notFound } from "../lib/errors.ts";
import { auth, endSession, startSession } from "../plugins/auth.ts";
import { createAccount } from "../services/households.ts";

const limited = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

const password = z.string().min(8, "8 caractères minimum").max(200);

async function findInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { household: true } });
  if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) throw notFound("Invitation invalide ou expirée");
  return invitation;
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", limited, async (request, reply) => {
    const body = z.object({ email: z.email(), password: z.string().min(1) }).parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, include: { member: true } });
    const ok = user?.member && (await verifySecret(user.passwordHash, body.password));
    if (!user?.member || !ok) throw new HttpError(401, "invalid_credentials", "Email ou mot de passe incorrect");
    await startSession(reply, user, user.member.id);
    return { ok: true };
  });

  app.post("/auth/signup", limited, async (request, reply) => {
    const body = z
      .object({
        email: z.email(),
        password,
        displayName: z.string().trim().min(1).max(40),
        emoji: z.string().max(16).optional(),
        householdName: z.string().trim().min(1).max(60).optional(),
        inviteToken: z.string().optional(),
      })
      .parse(request.body);

    if (await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })) {
      throw conflict("email_taken", "Un compte existe déjà avec cet email");
    }

    let join: { householdId: string; role: "PARENT" | "MEMBER" } | undefined;
    if (body.inviteToken) {
      const invitation = await findInvitation(body.inviteToken);
      // Consommation atomique : une invitation ne sert qu'une fois
      const used = await prisma.invitation.updateMany({ where: { id: invitation.id, usedAt: null }, data: { usedAt: new Date() } });
      if (used.count !== 1) throw notFound("Invitation déjà utilisée");
      join = { householdId: invitation.householdId, role: invitation.role === "PARENT" ? "PARENT" : "MEMBER" };
    } else if (!env.ALLOW_SIGNUP) {
      throw forbidden("Les inscriptions sont fermées : demandez une invitation à un parent du foyer.");
    } else if (!body.householdName) {
      throw badRequest("household_required", "Donnez un nom à votre foyer");
    }

    const { user, member } = await createAccount({ ...body, join });
    await startSession(reply, user, member.id);
    return { ok: true };
  });

  app.post("/auth/logout", async (request, reply) => {
    await endSession(request, reply);
    return { ok: true };
  });

  app.get("/auth/me", async (request): Promise<MeDto> => {
    const a = auth(request);
    const member = await prisma.member.findUniqueOrThrow({ where: { id: a.member.id }, include: { user: true } });
    return {
      user: { id: a.user.id, email: a.user.email, theme: a.user.theme, locale: a.user.locale === "en" ? "en" : "fr" },
      member: memberDto(member),
      ownMemberId: a.ownMemberId,
      household: householdDto(a.household),
    };
  });

  app.patch("/auth/me", async (request) => {
    const a = auth(request);
    const body = z
      .object({
        theme: z.enum(["SYSTEM", "LIGHT", "DARK"]).optional(),
        locale: z.enum(["fr", "en"]).optional(),
        currentPassword: z.string().optional(),
        newPassword: password.optional(),
      })
      .parse(request.body);

    let passwordHash: string | undefined;
    if (body.newPassword) {
      if (a.member.id !== a.ownMemberId) throw forbidden();
      if (!body.currentPassword || !(await verifySecret(a.user.passwordHash, body.currentPassword))) {
        throw badRequest("invalid_password", "Mot de passe actuel incorrect");
      }
      passwordHash = await hashSecret(body.newPassword);
      // Déconnecte les autres appareils
      await prisma.session.deleteMany({ where: { userId: a.user.id, NOT: { id: a.sessionId } } });
    }
    await prisma.user.update({ where: { id: a.user.id }, data: { theme: body.theme, locale: body.locale, passwordHash } });
    return { ok: true };
  });

  /**
   * Changement de profil sur l'appareil connecté :
   *  - vers un profil enfant : code PIN s'il en a un ;
   *  - retour à son propre profil depuis un profil enfant : mot de passe du compte.
   */
  app.post("/auth/switch-profile", limited, async (request) => {
    const a = auth(request);
    const body = z.object({ memberId: z.string(), pin: z.string().optional(), password: z.string().optional() }).parse(request.body);
    const target = await prisma.member.findFirst({ where: { id: body.memberId, householdId: a.household.id } });
    if (!target) throw notFound();

    if (target.id === a.ownMemberId) {
      if (a.member.id !== a.ownMemberId && !(body.password && (await verifySecret(a.user.passwordHash, body.password)))) {
        throw new HttpError(401, "password_required", "Mot de passe requis");
      }
    } else if (target.role === "CHILD") {
      if (target.pinHash && !(body.pin && (await verifySecret(target.pinHash, body.pin)))) {
        throw new HttpError(401, "pin_required", "Code PIN incorrect");
      }
    } else {
      throw forbidden("Pour utiliser ce profil, connectez-vous avec le compte de cette personne.");
    }

    await prisma.session.update({ where: { id: a.sessionId }, data: { activeMemberId: target.id } });
    return { ok: true };
  });

  app.get("/invitations/:token", async (request) => {
    const { token } = z.object({ token: z.string() }).parse(request.params);
    const invitation = await findInvitation(token);
    return { householdName: invitation.household.name, role: invitation.role, email: invitation.email };
  });
}
