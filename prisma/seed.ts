// Seed manuel en développement : npx tsx --env-file=.env prisma/seed.ts
// (en production, SEED_DEMO=true crée la démo au démarrage du serveur)

import { prisma } from "../src/server/db.ts";
import { seedDemo } from "../src/server/services/demo.ts";

await seedDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
