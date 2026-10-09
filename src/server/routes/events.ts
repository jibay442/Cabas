import type { FastifyInstance } from "fastify";
import { auth } from "../plugins/auth.ts";
import { subscribe } from "../services/events.ts";

/** Flux Server-Sent Events du foyer : l'interface rafraîchit ce qui a changé. */
export default async function eventRoutes(app: FastifyInstance) {
  app.get("/events", { logLevel: "warn" }, (request, reply) => {
    const { household } = auth(request);
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write("retry: 3000\n\n");

    const unsubscribe = subscribe(household.id, (event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
    // Commentaire périodique : garde la connexion ouverte à travers les proxys
    const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
    request.raw.on("close", () => {
      clearInterval(ping);
      unsubscribe();
    });
  });
}
