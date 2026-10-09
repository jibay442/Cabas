import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  APP_NAME: z.string().default("Cabas"),
  APP_URL: z.url().default("http://localhost:3000"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  TZ: z.string().default("Europe/Paris"),
  DEFAULT_LOCALE: z.enum(["fr", "en"]).default("fr"),
  CURRENCY: z.string().length(3).default("EUR"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
  DATA_DIR: z.string().default("./data"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(15),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_HOUSEHOLD: z.string().default("Ma famille"),
  ALLOW_SIGNUP: bool,
  WEBHOOK_TOKEN: z.string().optional(),
  OFF_USER_AGENT: z.string().default("Cabas/1.0 (https://github.com/jibay442/Cabas)"),
  OCR_PROVIDER: z.enum(["tesseract", "none"]).default("tesseract"),
  SEED_DEMO: bool,
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Configuration invalide (.env) :");
    for (const issue of parsed.error.issues) console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env = load();

export const isProd = env.NODE_ENV === "production";
export const secureCookies = env.APP_URL.startsWith("https://");

/** Avertissements sur les valeurs d'exemple laissées telles quelles */
export function configWarnings(): string[] {
  const warnings: string[] = [];
  if (env.SESSION_SECRET.includes("change-me")) warnings.push("SESSION_SECRET a encore sa valeur d'exemple : changez-la.");
  if (env.ADMIN_PASSWORD?.includes("change-me")) warnings.push("ADMIN_PASSWORD a encore sa valeur d'exemple : changez le mot de passe admin.");
  if (env.WEBHOOK_TOKEN?.includes("change-me")) warnings.push("WEBHOOK_TOKEN a encore sa valeur d'exemple : le webhook global est désactivé.");
  return warnings;
}
