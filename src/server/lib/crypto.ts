import { createHash, createHmac, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { env } from "../env.ts";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/** Empreinte d'un jeton stockée en base (le jeton en clair ne quitte jamais le cookie / l'URL) */
export const tokenHash = (token: string) => createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");

export const hashSecret = (secret: string) => hash(secret);

export async function verifySecret(hashed: string, secret: string): Promise<boolean> {
  try {
    return await verify(hashed, secret);
  } catch {
    return false;
  }
}
