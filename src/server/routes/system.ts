import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../shared/types.ts";
import { prisma } from "../db.ts";
import { env } from "../env.ts";

export const VERSION = process.env.CABAS_VERSION ?? "dev";

/** Manifeste PWA (servi à la racine, voir app.ts) : reprend APP_NAME */
export function manifest() {
  return {
    name: env.APP_NAME,
    short_name: env.APP_NAME,
    description: "Liste de courses familiale",
    lang: env.DEFAULT_LOCALE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#15803d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

export default async function systemRoutes(app: FastifyInstance) {
  app.get("/health", { logLevel: "warn" }, async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "ok" };
    } catch {
      return reply.code(503).send({ status: "error", db: "unreachable" });
    }
  });

  app.get("/config", async (): Promise<AppConfig> => ({
    appName: env.APP_NAME,
    currency: env.CURRENCY,
    defaultLocale: env.DEFAULT_LOCALE,
    allowSignup: env.ALLOW_SIGNUP,
    version: VERSION,
  }));
}
