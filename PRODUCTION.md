# Checklist de mise en production

À parcourir **dans l'ordre** avant d'ouvrir le site au public et, séparément, avant tout passage au mainnet.
Chaque case se coche avec une preuve (capture, journal, lien), pas de mémoire.

## A. Devnet ouvert (premier public, SOL de test)

### Comptes et accès

- [ ] GitHub : apps Vercel et Railway installées sur le dépôt `battle-launch`.
- [ ] Supabase : fournisseur **Web3 Wallet → Solana** activé ; Site URL et Redirect URLs = adresse du site.
- [ ] Supabase : un profil administrateur (`profiles.is_admin = true`).
- [ ] Vercel : projet (racine `apps/web`), variables `NEXT_PUBLIC_*` posées, preview qui répond.
- [ ] Railway : worker relié au dépôt, `GET /health` répond 200, premier démarrage fait (le journal dit que le mot de passe
      de production est créé) ; ensuite **retirer `BOOTSTRAP_DATABASE_URL`** des variables.
- [ ] `NEXT_PUBLIC_APP_URL` (Vercel) = `APP_URL` (Railway) = adresse réelle du site.

### Essais réels

- [ ] Connexion avec Phantom, Solflare et Backpack (devnet) ; déconnexion ; reconnexion.
- [ ] Battle complète réelle en mode Créateur : lobby → lancement des deux tokens → live → finished.
- [ ] Duel ouvert : création, acceptation par un second wallet, lancement.
- [ ] Mode Auto-IA (si `ANTHROPIC_API_KEY` est posée) : deux concepts proposés, doublon refusé.
- [ ] Un camp qui ne signe pas : battle annulée, message clair.
- [ ] Achat A / B depuis la page de la battle ; trade visible en direct, bougies et barre de domination mises à jour sans recharger.
- [ ] Page `/verify` de la battle réelle : hash ✓ et résultat ✓.
- [ ] Notifications : Telegram (si configuré), push navigateur (Chrome, Firefox, Safari iOS installé en app).
- [ ] Chat : message, filtre de contenu, signalement, masquage par l'admin, ban.
- [ ] `npm run e2e --workspace @battle/web` contre l'adresse de preview (`E2E_BASE_URL`) : tout passe.

### Sécurité et qualité

- [ ] Supabase `get_advisors` sécurité : aucun avertissement ; performance : seulement « unused index ».
- [ ] Aucun secret dans Git (`git log -p | grep` sur les préfixes de clés connus) ; `.env*` ignorés.
- [ ] `npm audit` relu ; rien d'atteignable dans le site livré.
- [ ] Lighthouse mobile (accueil, battle) : accessibilité ≥ 90, aucune erreur console.
- [ ] Textes : avertissement des risques visible, aucune promesse de gain, textes tous en anglais.
- [ ] Mentions légales, conditions d'utilisation et politique de confidentialité rédigées et relues (hors code).

### Exploitation

- [ ] RPC devnet avec clé (Helius) dans `SOLANA_RPC_URL` du worker : le RPC public est trop limité.
- [ ] Sauvegardes Supabase connues (offre gratuite : pas de restauration à un instant donné).
- [ ] Alerte si `/health` ne répond plus (Railway) ; savoir lire les journaux du worker.
- [ ] Vercel Hobby interdit l'usage commercial : passer en Pro (20 $/mois) dès que le site rapporte.

## B. Mainnet (vrais fonds) : **interdit sans validation explicite**

- [ ] Validation écrite du propriétaire du projet.
- [ ] Avis juridique (jeu, publicité de cryptoactifs, pays visés) ; restrictions géographiques si nécessaire.
- [ ] Lancement simultané par **bundle Jito** (les deux tokens ou aucun) : à construire et tester ; d'ici là, le worker
      annule toute battle mainnet au moment du lancement (`mainnet_launch_not_available`).
- [ ] Métadonnées sur IPFS (Pinata ou équivalent) au lieu de l'adresse du site.
- [ ] RPC mainnet avec clé ; DexScreener / Birdeye en complément d'affichage.
- [ ] Revue de sécurité indépendante des transactions construites et contrôlées (`packages/shared/src/launch`).
- [ ] Poser `SOLANA_CLUSTER=mainnet-beta`, `ALLOW_MAINNET=yes`, `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta` en dernier.
- [ ] Première battle mainnet suivie en direct, avec de petits montants.
