# 🛒 Cabas

Liste de courses familiale **self-hosted** et **open source** (MIT) : listes partagées en temps réel, import des tickets de caisse, comparaison entre ce qui était prévu et ce qui a été acheté, budget, santé et calories de chaque membre.

> 🚧 En cours de développement : comptes et foyer, liste partagée en temps réel (note libre, dictée), import des tickets de caisse. La documentation complète arrivera avec les finitions.

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

## Import automatique des tickets (n8n)

Cabas reçoit les tickets sur `POST /api/webhooks/receipt`. Exemple prêt à importer : [docs/n8n-workflow.json](docs/n8n-workflow.json) (e-mail IMAP → pièce jointe envoyée à Cabas, ou texte du mail si le ticket est dans le corps).

1. Dans Cabas : **Réglages › Foyer › Import automatique des tickets › Générer un token**. Copiez-le (il n'est affiché qu'une fois).
2. Dans n8n : **Workflows › Importer depuis un fichier** → `docs/n8n-workflow.json`.
3. Nœud **Mail de ticket reçu** : choisissez votre compte IMAP (Gmail : `imap.gmail.com`, avec un mot de passe d'application) et adaptez le filtre (sujet, expéditeur).
4. Nœuds **Envoyer … à Cabas** : remplacez l'URL par la vôtre, et créez un identifiant **Header Auth** : nom `Authorization`, valeur `Bearer <votre token>`.
5. Activez le workflow. Les tickets apparaissent dans l'onglet **Tickets**, à vérifier puis valider.

Formats acceptés :

```bash
# Fichier (PDF ou photo JPEG / PNG / WebP)
curl -H "Authorization: Bearer $TOKEN" -F "file=@ticket.pdf" -F "store=leclerc" https://courses.mondomaine.fr/api/webhooks/receipt

# JSON : fichier en base64, texte brut (mail HTML) ou lignes déjà structurées (montants en euros)
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" https://courses.mondomaine.fr/api/webhooks/receipt -d '{
  "store": "auchan", "date": "2026-10-09T18:32:00+02:00", "total": 3.45,
  "lines": [{ "label": "LAIT DEMI ECR 1L", "qty": 2, "unitPrice": 1.05, "total": 2.10, "ean": "3250390000000" },
            { "label": "BAGUETTE", "total": 1.35 }]
}'
```

Réponse : `{ "receiptId", "duplicate", "status", "linesRecognized", "unrecognized": [...] }`. Un même ticket envoyé deux fois n'est importé qu'une fois. Le token global `WEBHOOK_TOKEN` (.env) fonctionne aussi, accompagné de `"householdToken"` quand l'instance compte plusieurs foyers.

## Ajouter une enseigne

Chaque enseigne a son parseur dans `src/receipts/parsers/<enseigne>.ts`. La plupart des tickets français suivent la même mise en page : un parseur se résume souvent à quelques lignes de configuration.

```ts
// src/receipts/parsers/carrefour.ts
import { createLineParser } from "./common.ts";

export const carrefourParser = createLineParser({
  slug: "carrefour",                       // identifiant de l'enseigne
  detect: /\bCARREFOUR\b/i,                // reconnaître le ticket
  ignore: [/^(carte\s+carrefour|cagnotte)/i], // lignes de fidélité à ignorer
});
```

Ajoutez-le ensuite à la liste de `src/receipts/parsers/index.ts` et à `CHAINS` dans `src/shared/defaults.ts`, puis déposez un ticket d'exemple anonymisé dans `test/fixtures/receipts/` avec son test dans `test/receipt-parsers.test.ts` (`npm test`). Pour une mise en page vraiment différente, implémentez directement l'interface `ReceiptParser` (`src/receipts/types.ts`).

## Développement

```bash
npm install
cp .env.example .env     # DATABASE_URL vers un PostgreSQL local, NODE_ENV=development, APP_URL=http://localhost:5173
npm run db:migrate       # crée les tables et génère le client Prisma
npm run dev              # API sur :3000, interface sur http://localhost:5173
```

L'OCR des photos utilise Tesseract (inclus dans l'image Docker). En local : `sudo apt install tesseract-ocr tesseract-ocr-fra poppler-utils` puis `OCR_PROVIDER=tesseract` ; sinon `OCR_PROVIDER=none` (les PDF à texte restent lus).

| Commande | Rôle |
|---|---|
| `npm run typecheck` | Vérification TypeScript (serveur + interface) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run build` | Build de production dans `dist/` |

- Schéma de la base : [prisma/schema.prisma](prisma/schema.prisma)
- Routes de l'API : [docs/API.md](docs/API.md)

## Licence

[MIT](LICENSE)
