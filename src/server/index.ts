import { mkdir } from "node:fs/promises";
import { buildApp } from "./app.ts";
import { prisma } from "./db.ts";
import { configWarnings, env } from "./env.ts";
import { seedDemo } from "./services/demo.ts";
import { bootstrapAdmin } from "./services/households.ts";

const app = await buildApp();

for (const warning of configWarnings()) app.log.warn(`⚠️  ${warning}`);
await mkdir(env.DATA_DIR, { recursive: true });
await bootstrapAdmin(app.log);
if (env.SEED_DEMO) await seedDemo((msg) => app.log.info(msg));

const shutdown = async (signal: string) => {
  app.log.info(`${signal} reçu, arrêt…`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: env.HOST, port: env.PORT });
