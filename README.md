# 🛒 Cabas

Liste de courses familiale **self-hosted** et **open source** (MIT) : listes partagées en temps réel, import des tickets de caisse, comparaison entre ce qui était prévu et ce qui a été acheté, budget, santé et calories de chaque membre.

> 🚧 En cours de développement. Étape 1 terminée : comptes, foyer, membres et profils enfants, rayons et magasins. La documentation complète arrivera avec les finitions.

## Installation rapide (Docker)

```bash
git clone https://github.com/jibay442/Cabas.git cabas && cd cabas
cp .env.example .env          # puis modifiez au moins SESSION_SECRET et ADMIN_PASSWORD
docker compose --profile db up -d
```

Le conteneur n'expose aucun port : il est prévu pour être derrière Traefik (Dokploy), sur le réseau `dokploy-network`.

- **Sur un serveur Dokploy** : créez un service *Compose* pointant sur ce dépôt, collez le contenu du `.env` dans l'onglet Environnement, puis ajoutez votre domaine avec le port interne **3000**.
- **Sur une machine sans Dokploy** : `cp docker-compose.override.example.yml docker-compose.override.yml` avant de lancer la commande, puis ouvrez http://localhost:3000.

Au premier démarrage, le compte `ADMIN_EMAIL` / `ADMIN_PASSWORD` est créé avec son foyer. Avec `SEED_DEMO=true`, une famille de démo est aussi créée (`demo@cabas.local` / `demo1234`).

**Base PostgreSQL externe** : renseignez `DATABASE_URL` dans `.env` et lancez simplement `docker compose up -d` (sans `--profile db`).

## Développement

```bash
npm install
cp .env.example .env     # DATABASE_URL vers un PostgreSQL local, NODE_ENV=development, APP_URL=http://localhost:5173
npx prisma migrate dev   # crée les tables
npm run dev              # API sur :3000, interface sur http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérification TypeScript (serveur + interface) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run build` | Build de production dans `dist/` |

- Schéma de la base : [prisma/schema.prisma](prisma/schema.prisma)
- Routes de l'API : [docs/API.md](docs/API.md)

## Licence

[MIT](LICENSE)
