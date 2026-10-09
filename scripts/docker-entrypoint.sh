#!/bin/sh
set -e

# Migrations de la base (on réessaie le temps que PostgreSQL démarre)
attempt=1
until node_modules/.bin/prisma migrate deploy; do
  if [ "$attempt" -ge 15 ]; then
    echo "❌ Impossible d'appliquer les migrations : vérifiez DATABASE_URL." >&2
    exit 1
  fi
  echo "⏳ Base de données indisponible, nouvel essai dans 3 s ($attempt/15)…"
  attempt=$((attempt + 1))
  sleep 3
done

exec "$@"
