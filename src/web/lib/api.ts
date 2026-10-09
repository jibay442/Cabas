import type { ApiErrorBody } from "../../shared/types.ts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${url}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body ?? {}),
  patch: <T>(url: string, body: unknown) => request<T>("PATCH", url, body),
  put: <T>(url: string, body: unknown) => request<T>("PUT", url, body),
  del: <T>(url: string) => request<T>("DELETE", url),
};

/** Formate un montant en centimes */
export function money(cents: number | null | undefined, currency = "EUR", locale = "fr"): string {
  if (cents == null) return "–";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** « 1,05 » / « 1.05 € » → 105 ; vide → null */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

/** Comme parseMoney, mais accepte un montant négatif (remise) : « -0,50 » → -50 */
export function parseSignedMoney(input: string): number | null {
  const negative = input.trim().startsWith("-");
  const cents = parseMoney(input.replace("-", ""));
  return cents === null ? null : negative ? -cents : cents;
}

/** 105 → « 1,05 » (pour pré-remplir un champ) */
export const centsToInput = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2).replace(".", ","));

/** Message lisible d'une erreur d'API */
export const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

/** Envoi d'un fichier (multipart) */
export async function upload<T>(url: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", file);
  const res = await fetch(`/api${url}`, { method: "POST", body: form, credentials: "same-origin" });
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? "error", data?.error?.message ?? res.statusText);
  return data as T;
}
