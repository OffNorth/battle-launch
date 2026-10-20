# BATTLE LAUNCH

Deux memecoins Solana lancés **en même temps** sur pump.fun, sur un même thème, qui s'affrontent pendant 1 h, 3 h ou 6 h.
Le gagnant est désigné automatiquement à partir des données de la chaîne et le résultat se vérifie depuis un snapshot haché.

> **Avertissement.** Les memecoins sont extrêmement risqués : on peut tout perdre. Ce site ne promet aucun gain et ne donne
> aucun conseil financier. Il ne détient jamais vos fonds ni vos clés : tout est signé dans votre wallet.

**État :** en construction, devnet uniquement. L'avancement est tenu dans [`CLAUDE.md`](CLAUDE.md), section 9.

## Architecture

```
apps/web/            site Next.js 16 (Vercel)
apps/worker/         worker Node + BullMQ (Railway) : minuteries, lancement, lecture des trades, stats, clôture
packages/shared/     code commun : variables d'environnement, schémas Zod, score, anti-triche, snapshot
supabase/migrations/ schéma de la base, versionné
```

## Installation

Prérequis : Node 24 (`.nvmrc`), npm 11.

```bash
npm install
```

Copier `.env.example` en `.env` dans `apps/web/` et `apps/worker/`, puis remplir les valeurs (chaque variable y est expliquée).

## Commandes

| But                           | Commande            |
| ----------------------------- | ------------------- |
| Développement (site + worker) | `npm run dev`       |
| Build                         | `npm run build`     |
| Tests                         | `npm test`          |
| Lint                          | `npm run lint`      |
| Types                         | `npm run typecheck` |
| Tout vérifier                 | `npm run check`     |

## Déploiement

- **Site** : projet Vercel dont la racine est `apps/web`. Les variables se règlent dans Vercel.
- **Worker** : service Railway construit avec `npm run build --workspace @battle/worker`, lancé avec
  `npm run start --workspace @battle/worker`, santé sur `GET /health`. Un service Redis Railway fournit `REDIS_URL`.
- **Base** : projet Supabase ; les migrations de `supabase/migrations/` sont appliquées dans l'ordre.
