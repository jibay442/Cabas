import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../db.ts";
import { secureCookies } from "../env.ts";
import type { Household, Member, Role, User } from "../generated/prisma/client.ts";
import { randomToken, tokenHash } from "../lib/crypto.ts";
import { forbidden, unauthorized } from "../lib/errors.ts";

export const SESSION_COOKIE = "cabas_session";
const SESSION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export interface Auth {
  sessionId: string;
  user: User;
  /** Profil actif (le sien, ou un profil enfant après changement de profil) */
  member: Member;
  ownMemberId: string;
  household: Household;
}

declare module "fastify" {
  interface FastifyRequest {
    auth: Auth | null;
  }
}

function setCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function startSession(reply: FastifyReply, user: User, memberId: string) {
  const token = randomToken();
  await prisma.session.create({
    data: { id: tokenHash(token), userId: user.id, activeMemberId: memberId, expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) },
  });
  setCookie(reply, token);
}

export async function endSession(request: FastifyRequest, reply: FastifyReply) {
  if (request.auth) await prisma.session.deleteMany({ where: { id: request.auth.sessionId } });
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function registerAuth(app: FastifyInstance) {
  app.decorateRequest("auth", null);

  app.addHook("onRequest", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token || !request.url.startsWith("/api/")) return;

    const session = await prisma.session.findUnique({
      where: { id: tokenHash(token) },
      include: { user: { include: { member: { include: { household: true } } } } },
    });
    const own = session?.user.member;
    if (!session || !own || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      reply.clearCookie(SESSION_COOKIE, { path: "/" });
      return;
    }

    let member: Member = own;
    if (session.activeMemberId !== own.id) {
      // Le profil actif doit toujours appartenir au même foyer
      const active = await prisma.member.findFirst({ where: { id: session.activeMemberId, householdId: own.householdId } });
      if (active) member = active;
    }

    // Prolonge la session si elle a été utilisée et expire dans moins de 15 jours
    if (session.expiresAt.getTime() - Date.now() < 15 * DAY) {
      await prisma.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + SESSION_DAYS * DAY) } });
      setCookie(reply, token);
    }

    request.auth = { sessionId: session.id, user: session.user, member, ownMemberId: own.id, household: own.household };
  });
}

/** Renvoie le contexte d'authentification ; vérifie le rôle si des rôles sont donnés. */
export function auth(request: FastifyRequest, ...roles: Role[]): Auth {
  if (!request.auth) throw unauthorized();
  if (roles.length && !roles.includes(request.auth.member.role)) throw forbidden();
  return request.auth;
}

export const ADULTS: Role[] = ["PARENT", "MEMBER"];
