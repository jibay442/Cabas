# syntax=docker/dockerfile:1

# ── Dépendances (toutes, pour compiler) ──
FROM node:22-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Compilation : client Prisma, front Vite, serveur esbuild ──
FROM deps AS build
COPY . .
# URL factice : prisma generate n'a pas besoin de base, mais la config la lit
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build \
 && npm prune --omit=dev --no-audit --no-fund

# ── Image finale ──
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/server/index.js"]
