export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, message?: string) => new HttpError(400, code, message);
export const unauthorized = (message = "Connexion requise") => new HttpError(401, "unauthorized", message);
export const forbidden = (message = "Action non autorisée") => new HttpError(403, "forbidden", message);
export const notFound = (message = "Introuvable") => new HttpError(404, "not_found", message);
export const conflict = (code: string, message?: string) => new HttpError(409, code, message);
