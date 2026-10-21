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

| Plateforme | Ressource                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase   | projet `battle-launch`, id `gqeiqlejxqotldubsxic`, région eu-west-3 (Paris), offre gratuite (0 $/mois)                                                                                                                                         |
| Vercel     | compte personnel (Hobby). Projet à créer dès que l'app GitHub de Vercel a accès au dépôt (sinon `repo_not_found`)                                                                                                                              |
| Railway    | projet `battle-launch` (`0724b8af-…`), environnement `devnet` (`8875a795-…`) : service **Redis** (template) et service **worker** (`0c3118aa-…`, variables posées, pas encore relié au dépôt : l'app GitHub de Railway n'a pas accès au dépôt) |
| GitHub     | dépôt privé `OffNorth/battle-launch` (push accepté le 20/10/2026), branche `main`                                                                                                                                                              |

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
- Commentaires et docs du dépôt **en français** ; textes visibles du site en anglais (i18n, voir §10).
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

- **Règles du score v1 (`packages/shared/src/battle/score.ts`)**, toutes en entiers (bigint, ppm) pour un gagnant identique
  au bit près partout :
  - fenêtre `[startedAt, endsAt[` ; les trades hors fenêtre ne comptent pas (sauf pour l'état du prix) ;
  - créateurs et wallets **financés par un créateur** : exclus des **deux** camps ;
  - wallets financés par une même source (≥ `minClusterSize`, 3) : **un seul participant** (un holder, un plafond),
    sauf sources ignorées (`ignoredFunders`, plateformes d'échange) ;
  - aller-retour (achat puis vente, ou l'inverse, du même participant en moins de `washWindowSeconds`, 120 s) : les deux
    trades sortent du volume et des achats, le solde net reste juste ;
  - plafond **absolu** par participant (5 SOL de volume, 20 achats), plutôt qu'un pourcentage (instable quand il y a peu de monde) ;
  - holder = solde net > `minHolderTokens` (1 token) **d'après les trades de la battle** (les transferts ne comptent pas) ;
  - market cap = moyenne pondérée par le temps sur les 5 dernières minutes, tous trades compris (le prix est un fait) ;
  - égalité : volume, puis holders, puis market cap, sinon match nul (`winner_side` nul et statut `finished`).
- **Snapshot** : JSON canonique (clés triées, bigint en chaînes, flottants refusés) haché en SHA-256 (Web Crypto). Le jsonb
  réordonne les clés : on re-canonicalise avant de hacher, donc la vérification marche depuis la base.

## 9. Avancement

- [x] Étape 0 : dossier, git, monorepo, CLAUDE.md, README, .env.example, projet Supabase — lint/typecheck/test/build OK
- [x] Étape 0 (suite) : dépôt GitHub poussé
- [ ] Étape 0 (reste) : projet Vercel + preview (attend l'app GitHub de Vercel) ; projet Railway (attend la fin de la panne)
- [x] Étape 1 : schéma (migration `20261020174442_schema_initial`), RLS testée, advisors sécurité sans avertissement, types
      générés (`packages/shared/src/database.types.ts`), bouton de connexion par wallet, `/api/me`
- [ ] Étape 1 (reste) : activer le fournisseur « Web3 Wallet / Solana » dans Supabase (tableau de bord, par l'utilisateur) et
      essayer une vraie connexion avec Phantom en devnet
- [x] Étape 2 : `packages/shared/src/battle/` score, anti-triche, snapshot (26 tests) ; migration `20261020204614_regles_du_score`
      (poids en points de base, règles anti-triche figées par battle)
- [x] Étape 3 : site de base — thèmes sombre (défaut) et vert et blanc, bouton de bascule (voir §10 ; variables dans `globals.css`), fond animé en CSS (`animated-background.tsx`), shadcn/ui, anglais seulement sous
      `/en` (`src/i18n`, redirection selon la langue du navigateur dans `proxy.ts`), accueil (en direct / bientôt / résultats
      lus dans Supabase), `/docs` (risques, déroulement, formule, anti-triche, vérification, FAQ). Vérifié en local, mobile
      375 px sans défilement horizontal, console sans erreur
- [x] Étape 4 (code) : `/create` en 4 étapes et 3 modes, filtre de contenu (`packages/shared/src/moderation.ts`), Auto-IA
      (`/api/ai/concepts`, modèle `claude-opus-5-5`, effort bas, sortie structurée, repli serveur `fallbacks: "default"`),
      doublons par trigrammes, page `/battle/[id]` avec lobby (pré-inscription, relever un duel, annuler), mise à jour en
      direct (Realtime). Migration `20261020215205_creation_lobby` (statut `open`, `battle_watchers`, `rate_limits`, fonctions
      `create_battle` / `accept_duel` / `hit_rate_limit` / `find_similar_sides`, réservées au serveur)
- [x] Le site n'a plus de clé secrète Supabase (décision du 21/10/2026) : migrations `ecritures_sans_cle` et `fonctions_privees`
- [ ] Étape 4 (essai réel) : créer une battle connecté avec un wallet — attend la connexion Web3 (Phantom en devnet)
- [x] Étape 5 (code) : lancement devnet — comptes durable nonce, **deux transactions par camp** (création 923 octets,
      achat 841 octets : ensemble elles dépassaient la limite de 1 232), pré-signées dans le lobby
      (`packages/shared/src/launch`, `components/lobby/launch-prep.tsx`), contrôlées octet par octet par le serveur et le
      worker (`validate.ts`), envoyées par le worker (`jobs/launch.ts`). Simulation dans le vrai programme pump.fun du devnet
      OK (`scripts/devnet-simulate-launch.ts`). **Pas d'envoi réel** (faucet devnet limité, pas de SOL de test)
- [x] Étape 6 : indexeur (`jobs/index-trades.ts` : TradeEvent lu dans les journaux, financeurs, stats, bougies d'une
      minute, wallets écartés), page live (barre de domination, deux graphiques synchronisés, fil des trades, achat A/B
      signé dans le wallet, chat filtré), mise à jour par Realtime
- [x] Étape 7 : clôture (`jobs/close.ts` : snapshot, gagnant, badge), page `/verify` (recalcul dans le navigateur), Hall of
      Fame, classement, profils, push navigateur (VAPID créées par le worker, clé privée dans Redis), annonce Telegram
- [x] Étape 8 : admin (`/admin` : signalements, masquage, ban, À la une), filtre de contenu aussi en base
      (`app_private.is_text_clean`, mêmes listes que `moderation.ts` via `scripts/moderation-sql.ts`), limites de débit,
      sitemap/robots/OG, Vercel Analytics (sans cookie)
- [x] Étape 9 : seed de démo (`scripts/seed-devnet.ts`), test d'intégration du cycle complet
      (`apps/worker/src/jobs/cycle.test.ts`), E2E Playwright avec Edge (`apps/web/e2e`, 5 parcours, sans erreur console),
      README final, `PRODUCTION.md`
- [ ] Reste : déploiements Vercel/Railway (accès GitHub), fournisseur Web3 Supabase, battle réelle sur le devnet avec deux
      wallets, `npm audit` (15 alertes, outils de dev surtout) — voir `PRODUCTION.md`

## 10. Pièges connus

- **Thèmes** (23/10/2026) : **sombre par défaut**, dans l'esprit de deuslaunch (fond `#07080b`, cartes `#0d0f13` arrondies à
  16 px, bordures blanches à 7 %, accent turquoise, camp A turquoise, camp B violet, police Inter, titres serrés `.display`,
  boutons en pilule), et **clair vert et blanc** (demandé le 21/10/2026). Le bouton soleil/lune de l'en-tête bascule
  (`theme-toggle.tsx`, attribut `data-theme` de `<html>`, choix gardé en `localStorage`, script `THEME_INIT` avant l'affichage).
  Couleurs uniquement via les variables de `globals.css` (`--side-a`, `--side-b`, `--on-side` = texte sur une couleur de camp :
  ne jamais écrire `text-white` sur un fond de camp). Les graphiques lisent les variables `--chart-*` (hexadécimal) et se
  recolorent au changement de thème. Les images de partage (OG, image du token) ont encore des couleurs fixes vertes.
- **Animations** (23/10/2026, demande « animations de fou ») : aurore conique qui tourne au fond, arène de l'accueil
  (`home/arena.tsx`, **CSS pur** `.arena-*` : une seule horloge de 3,2 s, choc à 42 %, charge en unités `cqw` pour que les
  orbes se touchent pile au centre à toute largeur), titre mot par mot avec fin en dégradé, boutons à reflet, cartes à
  bordure conique tournante (`@property --spin`, permanente pour une battle en direct), point « live », barre de domination
  à reflets et étincelle, bannière du gagnant avec confettis (`results/winner-burst.tsx`), apparition au défilement
  (`animation-timeline: view()`). Uniquement transform/opacity/background-position ; tout est coupé si l'appareil demande
  moins d'animations. Le navigateur intégré de Claude a ce réglage actif : les animations y paraissent immobiles ; pour
  les voir, captures avec Playwright + Edge (réglage normal). **Valeurs calculées (angles, positions) arrondies** et pas de
  raccourci `background` dans un `style` animé par Framer Motion : sinon écart serveur/navigateur (erreur d'hydratation).
  Script du thème : `next/script` `strategy="beforeInteractive"` (une balise `<script>` brute dans le layout donne une erreur React).
- **Serveur local** : après une modification de `globals.css`, le serveur de dev ne recompile pas toujours la feuille ;
  le redémarrer.

- **Écritures sans clé secrète** (choix de l'utilisateur, 21/10/2026) : le site n'a PAS de `service_role`. Une route `/api/...`
  vérifie la session (`requireProfile`), valide avec le schéma Zod partagé, passe le filtre de contenu, puis appelle une
  fonction SQL **avec la session de l'utilisateur** (`lib/supabase/server.ts`). Ces fonctions : relais `SECURITY INVOKER` dans
  `public`, code privilégié `SECURITY DEFINER` dans `app_private` (non exposé ; conseil du linter 0029). Elles vérifient
  elles-mêmes l'appelant (`app_private.current_profile_id()`), le ban, la limite de débit (`app_private.enforce_rate_limit`)
  et décident du statut et des horaires. Les erreurs voulues sont levées par `raise exception '<code>'` (code P0001) et
  traduites par `fromDbError`. Le filtre de contenu est aussi appliqué **dans la base** (`create_battle`,
  `accept_duel`, chat) : appeler la base directement ne le contourne pas.
- **Worker et base** : en local, rôle `battle_worker` (BYPASSRLS, droits limités) via `DATABASE_URL`. En production, rôle
  `battle_worker_prod` (hérite du premier) : au premier démarrage le worker tire un mot de passe, le range dans Redis
  (`battle:db-password`) et en donne l'empreinte SCRAM à la base via `battle_bootstrap` (identifiant d'amorçage à usage
  unique, `app_private.rotate_worker_password`, qui le désactive ; valable jusqu'au 22/10/2026 00:00 UTC, à renouveler
  s'il a expiré avant le premier démarrage). Connexion par le pooler `aws-1-eu-west-3.pooler.supabase.com:5432`,
  utilisateur `<rôle>.gqeiqlejxqotldubsxic`. Personne ne voit le mot de passe de production.
- **RPC et nul** : passer `null` explicitement à une fonction SQL (une clé absente empêche PostgREST de trouver la fonction).
- **Realtime** : `postgres_changes` filtré par battle suffit au début ; au-delà d'environ 3 000 spectateurs simultanés sur
  la même battle, la doc Supabase conseille Broadcast.
- **Pages dynamiques** : tout composant client qui lit l'adresse (`usePathname`) doit être dans un `<Suspense>`, sinon le
  build échoue sur les pages comme `/battle/[id]`.
- **Shell (outil Bash)** : les longs scripts heredoc avec apostrophes échouent parfois ; écrire les fichiers avec l'outil Write.

- **Textes du site** : **anglais seulement** (23/10/2026). `src/i18n/dictionaries/en.ts` ; le segment `[lang]` est gardé (`/en/...`)
  via `next/root-params` (`getDictionary()`, `getLocale()`), et `proxy.ts` redirige `/docs` et les anciennes adresses `/fr/...` vers
  `/en/...`. Ajouter une langue : voir le commentaire de `i18n/config.ts`. Les journaux du worker restent en français (lus par l'exploitant).
- **Framer Motion** : mêmes `initial`/`animate` au serveur et au navigateur, `MotionConfig reducedMotion="user"` ; sinon erreur
  d'hydratation et éléments restés invisibles quand le système demande moins d'animations.
- **Worker Railway** : `NPM_CONFIG_INCLUDE=dev` est posé pour que `tsup` (outil de dev) soit installé au build malgré
  `NODE_ENV=production`.
- **Serveur local** : après un déplacement de routes, effacer `apps/web/.next` (sinon `typecheck` lit d'anciens types).

- **Connexion par wallet** (`sign-in-button.tsx`) : si le wallet sait faire `signIn` (Phantom, Solflare, Backpack), c'est lui qui
  écrit le message « Sign In With Solana » ; sinon on l'écrit nous-mêmes (`lib/siws.ts`, ordre du standard) et on passe
  `{ message, signature }`. **Ne jamais laisser Supabase écrire le message** : il met « Version » avant « URI » et Phantom le
  refuse (« invalid formatting », 23/10/2026). Un refus dans le wallet affiche une erreur, sans plantage. Le profil est créé par un trigger sur
  `auth.identities` (fournisseur `web3`) ; l'adresse vient d'`identity_data.address` ou de la fin de `provider_id`
  (`web3:solana:<adresse>`). Vérifié avec une identité factice dans une transaction annulée, **pas encore sur une vraie connexion**.
- **Ne jamais lire `user_metadata` dans une policy** : l'utilisateur peut le modifier. Le wallet fait foi via `profiles`.
- **Cache Components** : lire les cookies (session) seulement derrière un `<Suspense>` ou dans une route API ; les variables
  publiques sont validées à la première utilisation, pas à l'import (le build passe sans elles).
- Les avis « unused index » (INFO) de `get_advisors` performance sont normaux tant que la base est vide.

- **Graphiques** : lightweight-charts ne lit pas les couleurs `lab()`/`oklch()` du thème : couleurs en hexadécimal
  dans `duel-charts.tsx`. Prix des bougies : lamports pour un million de tokens entiers (`candlePrice`).
- **Lancement** : la courbe du devnet n'a pas les réserves du mainnet (lire `Global` avec `fetchCurveParams`) ; mints en
  Token-2022 ; `NATIVE_MINT` défini localement (web3.js ne l'exporte pas). Lancement mainnet refusé tant que le bundle
  Jito n'existe pas.
- **Tests E2E** : `npm run e2e --workspace @battle/web` (Edge installé, aucun navigateur téléchargé) ; ils lisent les
  données de démo, qui doivent être en base. Vitest ignore `e2e/` (`apps/web/vitest.config.ts`).
- **Lint du worker** : tsup écrit un fichier temporaire `*.bundled_*.mjs` pendant le build ; ignoré par ESLint (sinon
  `npm run check` échoue au hasard).
- `npm audit` signale `braces` (dépendance de `eslint-config-next`, outil de dev seulement, pas dans le site livré).
- ESLint 9 est marqué « plus maintenu ». On le garde tant que la compatibilité des plugins de `eslint-config-next` avec
  ESLint 10 n'est pas essayée.
