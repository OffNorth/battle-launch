# BATTLE LAUNCH

Deux memecoins Solana lancés **en même temps** sur pump.fun, sur un même thème, qui s'affrontent pendant 1 h, 3 h ou 6 h.
Le gagnant est désigné automatiquement à partir des données de la chaîne et le résultat se vérifie depuis un snapshot haché.

> **Avertissement.** Les memecoins sont extrêmement risqués : on peut tout perdre. Ce site ne promet aucun gain et ne donne
> aucun conseil financier. Il ne détient jamais vos fonds ni vos clés : tout est signé dans votre wallet. Il n'y a aucun pari
> entre utilisateurs : on achète seulement les tokens.

**État :** devnet uniquement. Ce qui est fait, vérifié ou non : [`CLAUDE.md`](CLAUDE.md), section 9. Avant toute mise en
ligne publique : [`PRODUCTION.md`](PRODUCTION.md).

## Déroulement d'une battle

```
open (duel ouvert, en attente d'un adversaire)
  └─> lobby (5 à 15 min) ── chaque créateur pré-signe « création + achat initial » (durable nonce)
        └─> launching ── le worker envoie les 4 transactions déjà signées à l'heure H
              └─> live (1 h / 3 h / 6 h) ── le worker lit les trades sur la chaîne, stats et bougies en direct
                    └─> closing ─> finished ── snapshot canonique haché (SHA-256), gagnant, badge, annonces
  (un camp qui n'a pas signé, un lancement raté : cancelled)
```

## Architecture

```
apps/web/            site Next.js 16 (Vercel) : pages, routes /api, connexion par signature de wallet
apps/worker/         worker Node + BullMQ (Railway) : lancement, lecture des trades, stats, clôture, ménage, notifications
packages/shared/     code commun et pur : variables d'environnement, schémas Zod, score, anti-triche, snapshot,
                     construction et contrôle des transactions de lancement, filtre de contenu
supabase/migrations/ schéma de la base (RLS partout ; écritures uniquement par fonctions SQL), versionné
scripts/             outils : seed de démo, essais devnet, mot de passe du worker, liste des termes refusés
```

- **Aucune clé secrète Supabase.** Le site écrit avec la session de l'utilisateur, par des fonctions SQL qui vérifient
  elles-mêmes l'appelant, le ban, la limite de débit et le filtre de contenu. Le worker a son propre compte Postgres aux
  droits limités, dont il crée lui-même le mot de passe au premier démarrage (personne ne le voit).
- **Non-custodial.** La clé du mint est générée dans le navigateur, signe, puis est oubliée. Le worker ne manipule que des
  transactions déjà signées et vérifie qu'elles correspondent exactement à la battle (programme, montants, nonce).
- **Résultat vérifiable.** Le score (formule publique, entiers uniquement) et l'anti-triche sont dans `packages/shared` ;
  le worker, le site et la page `/battle/[id]/verify` utilisent le même code. La page refait le calcul dans le navigateur.

## Installation

Prérequis : Node 24 (`.nvmrc`), npm 11.

```bash
npm install
```

Variables : voir [`.env.example`](.env.example) (chaque variable y est expliquée). En local, le site lit
`apps/web/.env.local` et le worker `apps/worker/.env` ; ces fichiers sont ignorés par Git.

## Commandes (à la racine)

| But                                       | Commande                                  |
| ----------------------------------------- | ----------------------------------------- |
| Développement (site + worker)             | `npm run dev`                             |
| Build                                     | `npm run build`                           |
| Tests unitaires et d'intégration (Vitest) | `npm test`                                |
| Lint / types                              | `npm run lint` / `npm run typecheck`      |
| Tout vérifier (avant chaque commit)       | `npm run check`                           |
| Tests de bout en bout (navigateur)        | `npm run e2e --workspace @battle/web`     |
| Un passage du worker, sans file d'attente | `npm run once --workspace @battle/worker` |

Les tests de bout en bout utilisent le navigateur Edge installé (`E2E_CHANNEL=chrome` pour Chrome), démarrent le site
local s'il ne tourne pas, et lisent les données de démonstration. Contre un déploiement :
`E2E_BASE_URL=https://… npm run e2e --workspace @battle/web`.

## Données de démonstration (devnet)

```bash
npx tsx scripts/seed-devnet.ts > seed.sql           # insère
npx tsx scripts/seed-devnet.ts --clean > clean.sql  # retire
```

Le SQL s'exécute avec un compte administrateur de la base (éditeur SQL de Supabase). Il crée deux comptes de démo, une
battle terminée « Cat vs Dog (demo) » avec trades, bougies, wallets écartés et snapshot vérifiable, une battle en lobby
(départ dans 7 jours) et un duel ouvert. Les mints sont factices : ces tokens n'existent pas sur la chaîne.

## Essais sur le devnet (SOL de test, sans valeur)

- `PAYER=<adresse devnet avec du solde> npx tsx scripts/devnet-simulate-launch.ts` : simule création + achat initial dans
  le vrai programme pump.fun du devnet (rien n'est envoyé ni dépensé).
- `npx tsx scripts/devnet-launch-check.ts` : essai réel du lancement par durable nonce avec un wallet jetable ; demande des
  SOL de test au faucet (souvent limité : https://faucet.solana.com).
- Battle complète réelle : deux wallets (Phantom réglé sur devnet) avec des SOL de test, créer une battle sur `/create`,
  accepter les risques, pré-signer le lancement dans le lobby, puis suivre la page de la battle jusqu'au résultat.

## Déploiement

- **Base (Supabase)** : appliquer `supabase/migrations/` dans l'ordre. Dans le tableau de bord : activer le fournisseur
  **Web3 Wallet → Solana** (Authentication → Sign In / Providers) et régler **Site URL / Redirect URLs** sur l'adresse du site.
- **Site (Vercel)** : projet dont la racine est `apps/web`. Variables `NEXT_PUBLIC_*` et, si voulu, `ANTHROPIC_API_KEY`.
  Previews à chaque push ; production seulement après validation.
- **Worker (Railway)** : service relié au dépôt, build `npm run build --workspace @battle/worker`, démarrage
  `npm run start --workspace @battle/worker`, santé `GET /health`. Variables : `REDIS_URL` (service Redis Railway),
  `SOLANA_*`, `APP_URL`, `BOOTSTRAP_DATABASE_URL` pour le premier démarrage, `NPM_CONFIG_INCLUDE=dev` (pour installer `tsup`).
- **Administrateur** : mettre `is_admin = true` sur son profil (table `profiles`) après sa première connexion.
