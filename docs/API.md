# Cabas — routes API

Préfixe `/api`. JSON partout (sauf upload et SSE). Validation zod, erreurs `{ error: { code, message } }`.
Authentification par cookie de session httpOnly `SameSite=Strict`. Toute requête est filtrée sur le `householdId` du membre actif.

Droits : **P** = parent, **M** = membre adulte, **E** = profil enfant, **Pub** = public, **Tok** = token webhook.

## Santé
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/health` (+ alias `/health`) | Pub | `{ status: "ok", db: "ok" }`, utilisé par le healthcheck Docker |
| GET | `/api/config` | Pub | Nom de l'app, devise, locale, `allowSignup` |

## Auth & profil
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| POST | `/api/auth/signup` | Pub | Inscription : rejoint un foyer avec un `inviteToken`, ou crée son foyer (`householdName`) si `ALLOW_SIGNUP=true` |
| POST | `/api/auth/login` | Pub | Connexion (rate-limit) |
| POST | `/api/auth/logout` | P M E | Ferme la session |
| GET | `/api/auth/me` | P M E | Utilisateur, membre actif, foyer, permissions |
| PATCH | `/api/auth/me` | P M | Thème, langue, mot de passe |
| POST | `/api/auth/switch-profile` | P M E | Passer sur un autre profil du foyer (PIN demandé pour un enfant protégé ; revenir à son profil adulte demande le mot de passe) |
| GET | `/api/invitations/:token` | Pub | Aperçu d'une invitation (nom du foyer, rôle) |

## Foyer & membres
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/household` | P M E | Foyer et paramètres |
| PATCH | `/api/household` | P | Nom, devise, couleur, budget mensuel, réglages des alertes |
| POST | `/api/household/webhook-token` | P | (Re)génère le token webhook du foyer, affiché une seule fois |
| GET / POST | `/api/household/invitations` | P | Lister / créer un lien d'invitation |
| DELETE | `/api/household/invitations/:id` | P | Révoquer |
| GET | `/api/members` | P M E | Membres (avatar, couleur, rôle) |
| POST | `/api/members` | P | Créer un profil enfant (sans email) ou un adulte (email + mot de passe) |
| PATCH | `/api/members/:id` | P, ou soi-même | Avatar, couleur, PIN, infos santé, objectif kcal, allergènes, confidentialité du journal |
| DELETE | `/api/members/:id` | P | Retirer du foyer |

## Référentiels
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET / POST | `/api/categories` | lecture P M E / écriture P | Rayons |
| PATCH / DELETE | `/api/categories/:id` | P | |
| PUT | `/api/categories/order` | P | Réordonner |
| GET | `/api/chains` | P M E | Enseignes connues (= parseurs disponibles) |
| GET / POST | `/api/stores` | lecture P M E / écriture P M | Magasins du foyer |
| PATCH / DELETE | `/api/stores/:id` | P M | |

## Produits & Open Food Facts
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/products/suggest?q=` | P M E | Auto-complétion depuis l'historique du foyer (Open Food Facts à l'étape 5) |
| GET | `/api/products?favorite=&recurring=&q=` | P M E | Catalogue du foyer |
| POST | `/api/products` | P M | Créer un produit manuellement |
| GET | `/api/products/:id` | P M E | Détail : données OFF, alertes, dernier prix |
| PATCH | `/api/products/:id` | P M | Favori, récurrent, rayon, unité, dernier prix |
| GET | `/api/products/:id/prices` | P M | Évolution du prix dans le temps et par enseigne |
| GET | `/api/products/:id/alternatives` | P M E | Produits OFF mieux notés de la même catégorie |
| GET | `/api/off/barcode/:ean` | P M E | Lookup EAN (cache en base, sinon OFF) |
| GET | `/api/off/search?q=` | P M E | Recherche OFF par nom |

## Listes de courses
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/lists?status=active\|archived` | P M E | Listes du foyer |
| POST | `/api/lists` | P M | Nouvelle liste |
| GET | `/api/lists/:id` | P M E | Articles triés par rayon, cochés en bas, total estimé, alertes santé |
| PATCH | `/api/lists/:id` | P M | Renommer, magasin prévu, archiver / réactiver |
| POST | `/api/lists/:id/finish` | P M | Fin des courses : archive la liste ; `carryOver` reporte les articles non pris sur une nouvelle liste |
| DELETE | `/api/lists/:id` | P M | |
| POST | `/api/lists/:id/items` | P M E | Ajouter un article (nom libre ou `productId`) ; rayon deviné, prix pré-rempli, quantité cumulée si l'article est déjà sur la liste |
| POST | `/api/lists/:id/items/bulk` | P M | Ajout groupé : favoris, récurrents, reports d'un ticket |
| PATCH | `/api/lists/:id/items/:itemId` | P M E* | Cocher, quantité, prix, note, rayon, pour qui, magasin (*enfant : cocher, et modifier ses propres articles) |
| DELETE | `/api/lists/:id/items/:itemId` | P M E* | (*enfant : ses propres articles) |
| GET | `/api/events` | P M E | **SSE** du foyer : `{ topic: "list" \| "lists" \| "products", id?, by }` ; l'interface rafraîchit ce qui a changé |

## Tickets de caisse
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| POST | `/api/webhooks/receipt` | Tok | Import n8n (JSON ou multipart). `Authorization: Bearer <token>` : le token du foyer, ou `WEBHOOK_TOKEN` global combiné avec `householdToken`. Rate-limit, idempotent. Réponse : `{ receiptId, duplicate, linesRecognized, unrecognized[] }` |
| POST | `/api/receipts/upload` | P M | Upload d'une photo ou d'un PDF (multipart, taille limitée), même pipeline |
| POST | `/api/receipts` | P M | Saisie manuelle (magasin, date, total, lignes facultatives) |
| GET | `/api/receipts?from=&to=&storeId=&memberId=&categoryId=&status=` | P M | Historique |
| GET | `/api/receipts/:id` | P M | Ticket et ses lignes |
| GET | `/api/receipts/:id/file` | P M | Fichier d'origine |
| PATCH | `/api/receipts/:id` | P M | Magasin, date, total, liste comparée |
| PUT | `/api/receipts/:id/lines` | P M | Corriger toutes les lignes (libellé, qté, prix, produit associé) |
| POST | `/api/receipts/:id/reparse` | P M | Relancer le parseur (ex. après un changement d'enseigne) |
| POST | `/api/receipts/:id/validate` | P M | Valide le ticket : mémorise les alias, met à jour les derniers prix et le catalogue |
| DELETE | `/api/receipts/:id` | P | |

## Comparaison liste ↔ ticket
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/receipts/:id/comparison` | P M | ✅ prévu+acheté (écart de prix), ❌ non acheté, ➕ hors liste, récapitulatif |
| PUT | `/api/receipts/:id/lines/:lineId/match` | P M | Forcer ou retirer un rapprochement (`listItemId` ou `null`) |
| POST | `/api/receipts/:id/carry-over` | P M | Reporter les ❌ choisis sur une liste (`itemIds`, `targetListId` facultatif) |

Algorithme : (1) EAN identique → (2) alias mémorisé → (3) même `productId` → (4) correspondance floue sur les libellés normalisés (trigrammes et tokens, abréviations courantes des tickets : ECR→écrémé, BTE→boîte…), seuil réglable. Affectation gloutonne par score décroissant, un article ne peut être rapproché qu'une fois. Fonction pure, testée unitairement.

## Journal alimentaire
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/journal/:memberId?day=YYYY-MM-DD` | soi ; parent → enfants ; autres adultes si journal non privé | Entrées du jour par repas, total vs objectif, humeur 😊😐😬 |
| GET | `/api/journal/:memberId/summary?from=&to=` | idem | Totaux par jour (vues semaine / mois) |
| GET | `/api/journal/:memberId/quick-products` | idem | Produits récemment achetés (tickets) pour l'ajout rapide |
| POST | `/api/journal/:memberId/entries` | soi, ou parent pour un enfant | Ajout depuis un produit, OFF / scan, ou saisie libre (kcal) |
| PATCH / DELETE | `/api/journal/entries/:id` | idem | |

## Bilan
| Méthode | Route | Droits | Rôle |
|---|---|---|---|
| GET | `/api/stats/spending?groupBy=month\|week\|chain\|category\|member&from=&to=` | P M | Dépenses agrégées (« member » : d'après le champ « pour qui » des articles rapprochés) |
| GET | `/api/stats/budget?month=` | P M | Budget, dépensé, %, niveau d'alerte (80 / 100 %) |
| GET | `/api/stats/top-products?from=&to=` | P M | Produits les plus achetés |
| GET | `/api/stats/insights?from=&to=` | P M | Part hors liste, part Nutri-Score A/B, comparaisons de prix entre enseignes |
| GET | `/api/export/receipts.csv?from=&to=` | P M | Export CSV (une ligne par ligne de ticket) |
| GET | `/api/export/lists.csv?from=&to=` | P M | Export CSV des listes |
