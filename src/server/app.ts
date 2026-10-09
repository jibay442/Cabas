import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { z, ZodError } from "zod";
import { env, isProd } from "./env.ts";
import { HttpError } from "./lib/errors.ts";
import { registerAuth } from "./plugins/auth.ts";
import authRoutes from "./routes/auth.ts";
import catalogRoutes from "./routes/catalog.ts";
import eventRoutes from "./routes/events.ts";
import householdRoutes from "./routes/household.ts";
import listRoutes from "./routes/lists.ts";
import memberRoutes from "./routes/members.ts";
import productRoutes from "./routes/products.ts";
import systemRoutes, { manifest } from "./routes/system.ts";

/** Dossier du front compilé : dist/web (à côté de dist/server) */
const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../web");

z.config(z.locales.fr());

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport: isProd ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy: true, // derrière Traefik
    bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024 * 1.4, // un fichier base64 dans du JSON pèse ~4/3
  });

  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  registerAuth(app);

  // Protection CSRF en complément des cookies SameSite=Strict : une requête qui modifie
  // des données doit venir de l'app elle-même (le webhook, authentifié par token, est exclu).
  // Hôtes admis : celui de APP_URL, et celui de la requête (direct ou via proxy : Traefik, Vite en dev).
  const appHost = new URL(env.APP_URL).host;
  app.addHook("onRequest", async (request, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method) || request.url.startsWith("/api/webhooks/")) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const allowed = [appHost, request.headers.host, request.headers["x-forwarded-host"]];
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      // Origin illisible (ex. « null ») : refusée
    }
    if (!originHost || !allowed.includes(originHost)) {
      return reply.code(403).send({ error: { code: "bad_origin", message: "Origine non autorisée" } });
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return reply.code(400).send({
        error: { code: "validation", message: first ? `${first.path.join(".") || "requête"} : ${first.message}` : "Requête invalide", details: error.issues },
      });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: { code: error.code ?? "bad_request", message: error.message } });
    }
    request.log.error(error);
    return reply.code(500).send({ error: { code: "internal", message: "Erreur interne" } });
  });

  await app.register(
    async (api) => {
      await api.register(systemRoutes);
      await api.register(authRoutes);
      await api.register(householdRoutes);
      await api.register(memberRoutes);
      await api.register(catalogRoutes);
      await api.register(productRoutes);
      await api.register(listRoutes);
      await api.register(eventRoutes);
    },
    { prefix: "/api" },
  );
  // Alias du healthcheck
  app.get("/health", { logLevel: "warn" }, async () => ({ status: "ok" }));
  app.get("/manifest.webmanifest", async (_request, reply) => reply.type("application/manifest+json").send(manifest()));

  // Front React (en production ; en dev il est servi par Vite)
  const hasWeb = existsSync(join(WEB_DIR, "index.html"));
  if (hasWeb) {
    await app.register(fastifyStatic, { root: WEB_DIR, wildcard: false, maxAge: "1h" });
  }
  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && hasWeb && !request.url.startsWith("/api/")) {
      // Routage côté client : toute URL inconnue renvoie l'application
      return reply.header("cache-control", "no-cache").sendFile("index.html");
    }
    return reply.code(404).send({ error: { code: "not_found", message: "Route inconnue" } });
  });

  return app;
}
