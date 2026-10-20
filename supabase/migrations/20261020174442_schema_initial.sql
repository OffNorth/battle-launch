-- ════════════════════════════════════════════════════════════════════════════
-- BATTLE LAUNCH : schéma initial.
-- Principe de sécurité : la base est LISIBLE publiquement pour ce qui est public
-- (battles, trades, stats, snapshots), mais AUCUNE écriture ne vient du navigateur.
-- Toutes les écritures passent par le serveur (routes API du site, validées par Zod
-- et limitées en débit, ou worker), avec la clé secrète qui contourne la RLS.
-- Montants : lamports et unités brutes de token en bigint (jamais de flottant).
-- ════════════════════════════════════════════════════════════════════════════

-- Schéma privé : fonctions internes, non exposé par l'API REST.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- Recherche de doublons de concepts (mode Auto-IA) par similarité de texte.
create extension if not exists pg_trgm with schema extensions;

-- ── Types ───────────────────────────────────────────────────────────────────
create type public.battle_mode as enum ('creator', 'open_duel', 'auto_ai');
-- draft : en préparation ; lobby : compte à rebours ; launching : envoi des 2 créations ;
-- live : duel en cours ; closing : calcul du gagnant ; finished ; cancelled.
create type public.battle_status as enum (
  'draft', 'lobby', 'launching', 'live', 'closing', 'finished', 'cancelled'
);
create type public.side_letter as enum ('A', 'B');
create type public.score_mode as enum ('volume', 'holders', 'market_cap', 'composite');
create type public.report_target as enum ('battle', 'side', 'message', 'profile');
create type public.report_status as enum ('open', 'dismissed', 'actioned');

-- ── Profils (un par wallet connecté) ────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Adresse publique Solana (base58), recopiée depuis l'identité Web3 de Supabase Auth.
  wallet text not null unique check (wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  display_name text check (char_length(display_name) between 2 and 32),
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Un profil par wallet connecté. is_admin ne se change qu''en base.';

-- ── Battles ─────────────────────────────────────────────────────────────────
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  theme text not null check (char_length(theme) between 3 and 80),
  mode public.battle_mode not null,
  status public.battle_status not null default 'draft',
  cluster text not null default 'devnet' check (cluster in ('devnet', 'mainnet-beta')),
  -- Durée du duel : 1 h, 3 h ou 6 h.
  duration_minutes integer not null check (duration_minutes in (60, 180, 360)),
  -- Durée du lobby : 5 à 15 min.
  lobby_minutes integer not null check (lobby_minutes between 5 and 15),
  score_mode public.score_mode not null default 'composite',
  -- Poids du score composite (volume, holders, market_cap, buys), publiés avec la battle.
  score_weights jsonb not null default '{"volume":0.35,"holders":0.35,"market_cap":0.2,"buys":0.1}',
  -- Version de la formule du score (packages/shared), figée à la création.
  formula_version integer not null default 1,
  -- Achat initial, identique pour les deux camps (lamports).
  initial_buy_lamports bigint not null check (initial_buy_lamports > 0),
  created_by uuid not null references public.profiles (id),
  lobby_opens_at timestamptz,
  -- Heure prévue du lancement simultané (fin du lobby).
  launch_at timestamptz,
  -- Début réel : quand les deux créations sont confirmées. Les stats comptent à partir de là.
  started_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  winner_side public.side_letter,
  is_featured boolean not null default false,
  cancel_reason text,
  created_at timestamptz not null default now(),
  check (ends_at is null or started_at is null or ends_at > started_at),
  check (winner_side is null or status = 'finished')
);
create index battles_status_idx on public.battles (status, launch_at);
create index battles_created_by_idx on public.battles (created_by);
create index battles_featured_idx on public.battles (is_featured) where is_featured;

-- ── Les deux camps d'une battle ─────────────────────────────────────────────
create table public.battle_sides (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  side public.side_letter not null,
  name text not null check (char_length(name) between 2 and 32),
  ticker text not null check (ticker ~ '^[A-Z0-9]{2,10}$'),
  description text check (char_length(description) <= 280),
  image_url text,
  -- Créateur du camp (nul tant que personne n'a relevé un duel ouvert).
  creator_id uuid references public.profiles (id),
  -- Adresse du token, connue dès la pré-signature (la clé du mint est générée dans le navigateur).
  mint text unique check (mint ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  launch_signature text,
  launch_slot bigint,
  created_at timestamptz not null default now(),
  unique (battle_id, side)
);
create index battle_sides_creator_idx on public.battle_sides (creator_id);
create index battle_sides_name_trgm_idx on public.battle_sides using gin (name extensions.gin_trgm_ops);

-- ── Transactions pré-signées (jamais lisibles depuis le navigateur) ─────────
-- Les envoyer avant l'heure fausserait le départ : seule la clé secrète y accède.
create table public.launch_txs (
  side_id uuid primary key references public.battle_sides (id) on delete cascade,
  -- Transaction signée par le créateur (base64). Aucune clé privée ici.
  signed_tx text not null,
  nonce_account text not null,
  submitted_at timestamptz,
  status text not null default 'ready' check (status in ('ready', 'submitted', 'confirmed', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- ── Trades lus sur la chaîne ────────────────────────────────────────────────
create table public.trades (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles (id) on delete cascade,
  side public.side_letter not null,
  signature text not null,
  -- Rang de l'instruction dans la transaction (une transaction peut contenir plusieurs trades).
  ix_index integer not null default 0,
  slot bigint not null,
  block_time timestamptz not null,
  wallet text not null,
  is_buy boolean not null,
  sol_lamports bigint not null check (sol_lamports >= 0),
  token_amount bigint not null check (token_amount >= 0),
  -- Réserves virtuelles de la bonding curve après le trade (donnent le prix et la market cap).
  virtual_sol_reserves bigint not null,
  virtual_token_reserves bigint not null,
  created_at timestamptz not null default now(),
  unique (signature, ix_index)
);
create index trades_battle_time_idx on public.trades (battle_id, block_time);
create index trades_battle_wallet_idx on public.trades (battle_id, wallet);

-- ── Stats en direct de chaque camp (recalculées par le worker) ──────────────
create table public.side_stats (
  battle_id uuid not null references public.battles (id) on delete cascade,
  side public.side_letter not null,
  volume_lamports bigint not null default 0,
  buys integer not null default 0,
  sells integer not null default 0,
  unique_holders integer not null default 0,
  market_cap_lamports bigint not null default 0,
  -- Score affiché, entre 0 et 1 (part du camp).
  score numeric(10, 9) not null default 0.5 check (score between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (battle_id, side)
);

-- ── Bougies 1 minute par camp (graphiques synchronisés) ─────────────────────
create table public.candles (
  battle_id uuid not null references public.battles (id) on delete cascade,
  side public.side_letter not null,
  bucket timestamptz not null,
  -- Prix en lamports par token entier (1e6 unités brutes), arrondi à l'entier.
  open_price bigint not null,
  high_price bigint not null,
  low_price bigint not null,
  close_price bigint not null,
  volume_lamports bigint not null default 0,
  primary key (battle_id, side, bucket)
);

-- ── Wallets écartés par l'anti-triche (publié, par transparence) ────────────
create table public.wallet_flags (
  battle_id uuid not null references public.battles (id) on delete cascade,
  wallet text not null,
  reason text not null check (reason in ('creator_linked', 'wash_trading', 'common_funder', 'cap_reached')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (battle_id, wallet, reason)
);

-- ── Snapshot final vérifiable ───────────────────────────────────────────────
create table public.snapshots (
  battle_id uuid primary key references public.battles (id) on delete cascade,
  formula_version integer not null,
  -- JSON canonique : paramètres, trades retenus, wallets écartés, résultat.
  payload jsonb not null,
  -- SHA-256 (hex) du JSON canonique.
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- ── Chat d'une battle ───────────────────────────────────────────────────────
create table public.chat_messages (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_messages_battle_idx on public.chat_messages (battle_id, created_at);
create index chat_messages_author_idx on public.chat_messages (author_id);

-- ── Badges (gagnants, Hall of Fame) ─────────────────────────────────────────
create table public.badges (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  battle_id uuid not null references public.battles (id) on delete cascade,
  kind text not null check (kind in ('winner', 'featured')),
  created_at timestamptz not null default now(),
  unique (profile_id, battle_id, kind)
);
create index badges_battle_idx on public.badges (battle_id);

-- ── Signalements ────────────────────────────────────────────────────────────
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id text not null,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now()
);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_status_idx on public.reports (status, created_at);

-- ── Abonnements web push (privés) ───────────────────────────────────────────
create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

-- ── Réglages publics (modifiés par l'admin via le serveur) ──────────────────
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── Journal d'administration ────────────────────────────────────────────────
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_created_idx on public.audit_logs (created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions internes
-- ════════════════════════════════════════════════════════════════════════════

-- Vrai si l'utilisateur connecté est administrateur (utilisé par les policies).
create function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin
  );
$$;
revoke all on function app_private.is_admin() from public;
-- anon aussi : les policies publiques l'évaluent (le schéma n'est pas exposé par l'API).
grant usage on schema app_private to anon, authenticated;
grant execute on function app_private.is_admin() to anon, authenticated;

-- Crée le profil quand Supabase Auth enregistre une identité Web3 Solana.
-- L'adresse est prise dans identity_data (address, ou custom_claims.address), sinon en fin de
-- provider_id (« web3:solana:<adresse> »). Une identité non Solana est ignorée.
create function app_private.handle_new_web3_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  addr text;
begin
  if new.provider <> 'web3' then
    return new;
  end if;
  addr := coalesce(
    nullif(new.identity_data ->> 'address', ''),
    nullif(new.identity_data -> 'custom_claims' ->> 'address', ''),
    nullif(split_part(new.provider_id, ':', 3), '')
  );
  if addr is null or addr !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    return new;
  end if;
  insert into public.profiles (id, wallet)
  values (new.user_id, addr)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function app_private.handle_new_web3_identity() from public;

create trigger on_auth_identity_created
  after insert on auth.identities
  for each row execute function app_private.handle_new_web3_identity();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS : activée partout, policies explicites.
-- Aucune policy insert/update/delete : seul le serveur (clé secrète) écrit.
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.battles enable row level security;
alter table public.battle_sides enable row level security;
alter table public.launch_txs enable row level security;
alter table public.trades enable row level security;
alter table public.side_stats enable row level security;
alter table public.candles enable row level security;
alter table public.wallet_flags enable row level security;
alter table public.snapshots enable row level security;
alter table public.chat_messages enable row level security;
alter table public.badges enable row level security;
alter table public.reports enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.settings enable row level security;
alter table public.audit_logs enable row level security;

-- Profils : publics (wallet, nom, badges sont affichés sur /profile/[wallet]).
create policy "profils lisibles par tous" on public.profiles
  for select to anon, authenticated using (true);

-- Battles : publiques sauf brouillons, visibles seulement par leur créateur et les admins.
create policy "battles publiques ou les miennes" on public.battles
  for select to anon, authenticated
  using (
    status <> 'draft'
    or created_by = (select auth.uid())
    or (select app_private.is_admin())
  );

-- Camps : mêmes règles que leur battle.
create policy "camps des battles visibles" on public.battle_sides
  for select to anon, authenticated
  using (exists (select 1 from public.battles b where b.id = battle_id));

-- Transactions pré-signées : personne depuis l'API publique.
create policy "transactions pre-signees : aucun acces public" on public.launch_txs
  for select to anon, authenticated using (false);

-- Données de duel : publiques.
create policy "trades publics" on public.trades
  for select to anon, authenticated using (true);
create policy "stats publiques" on public.side_stats
  for select to anon, authenticated using (true);
create policy "bougies publiques" on public.candles
  for select to anon, authenticated using (true);
create policy "wallets ecartes publics" on public.wallet_flags
  for select to anon, authenticated using (true);
create policy "snapshots publics" on public.snapshots
  for select to anon, authenticated using (true);
create policy "badges publics" on public.badges
  for select to anon, authenticated using (true);
create policy "reglages publics" on public.settings
  for select to anon, authenticated using (true);

-- Chat : messages visibles sauf masqués (les admins voient tout).
create policy "messages visibles" on public.chat_messages
  for select to anon, authenticated
  using (not is_hidden or (select app_private.is_admin()));

-- Signalements : chacun voit les siens, les admins tous.
create policy "mes signalements" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select app_private.is_admin()));

-- Web push : chacun voit ses abonnements.
create policy "mes abonnements push" on public.push_subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()));

-- Journal : admins seulement.
create policy "journal reserve aux admins" on public.audit_logs
  for select to authenticated
  using ((select app_private.is_admin()));

-- Pas d'écriture directe depuis le navigateur, même si une policy était ajoutée par erreur.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Temps réel : stats, trades, bougies, chat et statut des battles poussés au site.
-- ════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table
  public.battles, public.side_stats, public.trades, public.candles, public.chat_messages;

-- Réglages par défaut.
insert into public.settings (key, value) values
  ('limits', '{"max_live_battles": 20, "max_battles_per_wallet_per_day": 3}'),
  ('anti_cheat', '{"max_wallet_share": 0.05, "wash_window_seconds": 120}');
