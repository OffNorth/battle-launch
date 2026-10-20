# CLAUDE.md : BATTLE LAUNCH

Lu automatiquement par Claude Code dans ce dossier. **Mets-le à jour à chaque étape importante.**

> Ce dossier est rangé dans `Desktop\claude`, dont le `CLAUDE.md` parent décrit **un autre projet** (les bots Telegram
> « Pump Radar »). Ses règles (Python, `config.toml`, `CHANGEMENTS.md`, branches `prenom/sujet`…) **ne s'appliquent pas ici**,
> sauf les règles générales de prudence (aucun secret, aucune clé privée, aucune promesse de gain). Ce projet a son
> propre dépôt git, ignoré par celui de Pump Radar.

## 1. Le projet

Site web où deux memecoins Solana sont lancés **en même temps** sur pump.fun, sur un même thème (ex. Chat contre Chien),
et s'affrontent pendant 1 h, 3 h ou 6 h. Le gagnant est désigné automatiquement à partir des données de la chaîne,
reçoit de la visibilité (badge, « À la une », Hall of Fame, post Telegram/X) et les spectateurs suivent le duel en direct.

**Non-custodial** : le serveur ne détient jamais de fonds ni de clé privée. Tout est signé dans le wallet de l'utilisateur.
**Aucun pari** entre utilisateurs : les participants achètent seulement les tokens.

## 2. Stack

| Couche     | Choix                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Site       | Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript strict, Tailwind 4, shadcn/ui, Framer Motion                                                                |
| Solana     | `@solana/web3.js` **1.x** (le SDK pump.fun et wallet-adapter en dépendent ; la 3.x n'est pas compatible), `@solana/wallet-adapter` (Phantom, Solflare, Backpack), `@pump-fun/pump-sdk` |
| Données    | Supabase (Postgres + Realtime + Auth par signature de wallet), client Supabase typé (types générés)                                                                                    |
| Files      | Redis + BullMQ dans `apps/worker` (Railway)                                                                                                                                            |
| Marché     | La chaîne fait foi (Helius : transactions, holders). DexScreener / Birdeye en complément sur mainnet seulement (ils n'indexent pas le devnet)                                          |
| Graphiques | lightweight-charts (bougies) + Recharts                                                                                                                                                |
| IA         | API Claude (mode Auto-IA : deux concepts opposés)                                                                                                                                      |
| Tests      | Vitest (unitaires) + Playwright (E2E)                                                                                                                                                  |
| Outils     | npm workspaces + Turborepo, ESLint 9, Prettier, Node 24                                                                                                                                |

**Next.js 16 n'est pas celui que tu connais** : avant d'écrire du code Next, lis le guide concerné dans
`node_modules/next/dist/docs/` (voir `apps/web/AGENTS.md`).

## 3. Structure

```
apps/web/            site Next.js (Vercel, racine du projet Vercel = apps/web)
apps/worker/         worker Node + BullMQ (Railway) ; build tsup -> dist/index.js ; santé sur GET /health
packages/shared/     code commun (sources TS consommées directement) : env, schémas Zod, score, anti-triche, snapshot
supabase/migrations/ migrations SQL versionnées (copie exacte de ce qui est appliqué par apply_migration)
```

## 4. Commandes (à la racine)

| But                                 | Commande                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installer                           | `npm install`                                                                                                                                                                                                                                                                                                                                      |
| Développement                       | `npm run dev` (site + worker)                                                                                                                                                                                                                                                                                                                      |
| Build                               | `npm run build`                                                                                                                                                                                                                                                                                                                                    |
| Tests unitaires                     | `npm test`                                                                                                                                                                                                                                                                                                                                         |
| Lint                                | `npm run lint`                                                                                                                                                                                                                                                                                                                                     |
| Types                               | `npm run typecheck`                                                                                                                                                                                                                                                                                                                                |
| Tout vérifier (avant chaque commit) | `npm run check`                                                                                                                                                                                                                                                                                                                                    |
| Une seule partie                    | `npx turbo run test --filter=@battle/shared`                                                                                                                                                                                                                                                                                                       |
| Migrations                          | appliquées par Claude via le connecteur Supabase (`apply_migration`), puis le même SQL est enregistré dans `supabase/migrations/<horodatage>_<nom>.sql`. Après chaque migration : `get_advisors` sécurité + performance, corriger tout avertissement, régénérer les types (`generate_typescript_types` -> `packages/shared/src/database.types.ts`) |

## 5. Ressources en ligne

| Plateforme | Ressource                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase   | projet `battle-launch`, id `gqeiqlejxqotldubsxic`, région eu-west-3 (Paris), offre gratuite (0 $/mois)                                          |
| Vercel     | compte personnel (Hobby). Projet à créer quand le dépôt GitHub existe                                                                           |
| Railway    | workspace « zigxbt's Projects » (`293170f3-…`). Projet pas encore créé : panne Railway le 20/10/2026 (« Deploys have been paused temporarily ») |
| GitHub     | dépôt privé prévu : `OffNorth/battle-launch` (le premier push attend l'accord de l'utilisateur)                                                 |

## 6. Règles de sécurité (obligatoires)

1. **Avant toute ressource payante** (projet Supabase, service Railway, domaine…) : annoncer le coût, attendre la confirmation.
   Coûts déjà acceptés le 20/10/2026 : Supabase gratuit, Railway Hobby (~5 $/mois + usage, estimé 5 à 10 $/mois), Vercel Hobby
   (gratuit ; **interdit en usage commercial**, Pro 20 $/mois le jour où le site rapporte).
2. **Aucune action destructive** (suppression de projet, table, service, reset de base, pause) sans accord explicite dans le chat.
3. **Aucun secret en clair** : ni dans le chat, ni dans Git, ni dans un journal, ni dans un message d'erreur. Les secrets passent
   uniquement par les variables d'environnement des plateformes. L'utilisateur saisit lui-même les clés dans les tableaux
   de bord ; ne jamais lui demander de les coller dans le chat. `.env*` est ignoré par Git (sauf `.env.example`, sans valeurs).
4. **Devnet d'abord.** Aucune opération mainnet ni avec de vrais fonds sans validation. Le worker refuse `mainnet-beta`
   tant que `ALLOW_MAINNET=yes` n'est pas posé (`apps/worker/src/env.ts`).
5. **Connecteur indisponible** : le dire clairement et proposer une alternative, ne pas improviser.
6. **Non-custodial** : aucune clé privée côté serveur. La clé du mint est générée dans le navigateur, signe, puis est oubliée.
   Le worker ne manipule que des transactions **déjà signées** par les utilisateurs.
7. **Production Vercel** seulement après validation explicite. Preview à chaque étape.
8. Avant une action qui sort de la machine (push, déploiement, message Telegram/X, transaction) : demander l'accord, sauf si
   l'étape en cours l'a déjà reçu.
9. **Aucune promesse de gain** dans le site, les messages, les posts. Avertissement des risques visible.

## 7. Conventions de code

- TypeScript strict partout (`noUncheckedIndexedAccess`), pas de `any`. **Validation Zod** de toute entrée (API, formulaires,
  variables d'environnement, réponses d'API externes).
- Variables d'environnement validées au démarrage (`parseEnv` de `@battle/shared`) ; le message d'erreur nomme la variable,
  jamais sa valeur.
- Montants : **lamports et unités de token en `bigint`** (ou chaînes décimales en base), jamais en flottants pour la logique.
  Les flottants ne servent qu'à l'affichage.
- Logique de jeu (score, anti-triche, snapshot) **uniquement dans `packages/shared`**, en fonctions pures testées : le site,
  le worker et la page de vérification utilisent le même code.
- Commentaires et docs du dépôt **en français** ; textes visibles du site en FR et EN (i18n).
- Un test par changement de logique. Pas de mock ni de TODO dans le code final, sauf le **mode démo devnet** activé par variable
  d'environnement.
- `git add <fichiers précis>`, jamais `git add .` à l'aveugle. Messages de commit courts en français qui disent le pourquoi.

## 8. Décisions techniques (et pourquoi)

- **Le programme pump.fun existe sur devnet** (`6EF8rr…F6P`, vérifié le 20/10/2026 : `CreateV2`, `BuyExactSolIn`, `SellV3`
  récents) : on crée de vrais tokens pump.fun en devnet avec le SDK officiel, sans PumpPortal (mainnet seulement, 0,5 % par trade).
- **Métadonnées** : `pump.fun/api/ipfs` n'est plus accepté. Devnet : Supabase Storage ; mainnet : un service IPFS (Pinata).
- **Lancement simultané** : pendant le lobby, chaque créateur pré-signe (wallet) une transaction « création + achat initial »
  qui utilise un **durable nonce** (elle reste valable jusqu'à l'envoi). Le serveur vérifie que les deux achats initiaux sont égaux.
  À l'heure H, le worker envoie les deux. Mainnet : un bundle Jito (les deux ou aucun). Devnet : envoi en parallèle (pas de Jito),
  la battle démarre quand les deux sont confirmées ; les stats ne comptent qu'à partir de là. Un camp qui n'a pas signé = battle annulée.
- **Stats depuis la chaîne** (pas DexScreener) : seule façon d'avoir le devnet et un gagnant **reproductible** depuis le snapshot.
- **Score** : part A/(A+B) de chaque critère, pondérée ; market cap = moyenne des 5 dernières minutes (contre le pump de
  dernière seconde) ; formule publique et versionnée ; snapshot = JSON canonique des trades retenus + paramètres + version,
  haché en SHA-256.

## 9. Avancement

- [x] Étape 0 : dossier, git, monorepo, CLAUDE.md, README, .env.example, projet Supabase — lint/typecheck/test/build OK
- [ ] Étape 0 (suite) : dépôt GitHub + projet Vercel + preview ; projet Railway (worker + Redis) dès la fin de la panne
- [ ] Étape 1 : schéma Supabase + RLS + advisors + types ; connexion par wallet
- [ ] Étape 2 : `packages/shared` score, anti-triche, snapshot + tests
- [ ] Étape 3 : site de base (thème arène, wallets, accueil, /docs, avertissement, FR/EN)
- [ ] Étape 4 : /create (4 étapes, 3 modes, filtre de contenu, Auto-IA), lobby
- [ ] Étape 5 : lancement devnet (pré-signature, durable nonce, envoi par le worker)
- [ ] Étape 6 : indexeur + stats temps réel + page /battle/[id]
- [ ] Étape 7 : clôture, snapshot, vérification, récompenses, Hall of Fame, leaderboard, profils, notifications
- [ ] Étape 8 : admin, modération, signalement, rate limiting, SEO/OG, analytics
- [ ] Étape 9 : E2E battle complète, seed devnet, README final, checklist de mise en production

## 10. Pièges connus

- `npm audit` signale `braces` (dépendance de `eslint-config-next`, outil de dev seulement, pas dans le site livré).
- ESLint 9 est marqué « plus maintenu ». On le garde tant que la compatibilité des plugins de `eslint-config-next` avec
  ESLint 10 n'est pas essayée.
