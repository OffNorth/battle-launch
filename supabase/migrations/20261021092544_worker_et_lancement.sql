-- ════════════════════════════════════════════════════════════════════════════
-- Étape 5 : compte base de données du worker et pré-signature des lancements.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Financements des wallets (anti-triche : qui a envoyé ses premiers SOL) ──
-- Lu sur la chaîne par le worker ; public (c'est une donnée de la chaîne).
create table public.wallet_funders (
  wallet text primary key,
  -- Adresse qui a envoyé les premiers SOL ; nulle si introuvable.
  funder text,
  checked_at timestamptz not null default now()
);
alter table public.wallet_funders enable row level security;
create policy "financements publics" on public.wallet_funders
  for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.wallet_funders from anon, authenticated;

-- ── Compte du worker ────────────────────────────────────────────────────────
-- Connexion directe à Postgres (pas de clé service_role). Le mot de passe n'est PAS dans ce
-- fichier : il est posé à part, sous forme d'empreinte SCRAM, et le mot de passe en clair ne
-- vit que dans les variables du worker sur Railway.
-- BYPASSRLS : le worker lit les transactions pré-signées (fermées à tout le monde) ; ses droits
-- d'écriture restent limités aux tables et colonnes ci-dessous.
create role battle_worker login bypassrls nosuperuser nocreatedb nocreaterole connection limit 10;

grant usage on schema public to battle_worker;
grant select on all tables in schema public to battle_worker;
grant insert, update on public.trades, public.side_stats, public.candles, public.snapshots, public.wallet_funders
  to battle_worker;
grant insert, delete on public.wallet_flags to battle_worker;
grant insert on public.badges, public.audit_logs to battle_worker;
grant update (status, started_at, ends_at, finished_at, winner_side, cancel_reason, is_featured)
  on public.battles to battle_worker;
grant update (mint, launch_signature, launch_slot) on public.battle_sides to battle_worker;
grant update (status, submitted_at, error) on public.launch_txs to battle_worker;
-- Ménage des compteurs de limite de débit périmés.
grant delete on public.rate_limits to battle_worker;

-- ── Pré-signature d'un lancement par le créateur d'un camp ──────────────────
-- La transaction signée (création du token + achat initial, avec un durable nonce) est gardée
-- hors de portée du public jusqu'à l'heure du lancement. Le worker la revérifie entièrement
-- (programmes, montant, mint, payeur, nonce) avant de l'envoyer.
create function app_private.submit_launch_tx(
  p_battle uuid,
  p_side public.side_letter,
  p_signed_tx text,
  p_nonce_account text,
  p_mint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  s record;
begin
  perform app_private.enforce_rate_limit('launch_tx', 20, 3600);
  if p_signed_tx !~ '^[A-Za-z0-9+/=]{100,2400}$'
     or p_nonce_account !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'
     or p_mint !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  select bs.id, bs.creator_id, b.status, b.launch_at into s
    from public.battle_sides bs join public.battles b on b.id = bs.battle_id
    where bs.battle_id = p_battle and bs.side = p_side
    for update of bs;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if s.creator_id is distinct from me then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if s.status <> 'lobby' or s.launch_at <= now() then
    raise exception 'lobby_closed' using errcode = 'P0001';
  end if;
  update public.battle_sides set mint = p_mint where id = s.id;
  insert into public.launch_txs (side_id, signed_tx, nonce_account)
    values (s.id, p_signed_tx, p_nonce_account)
    on conflict (side_id) do update
      set signed_tx = excluded.signed_tx, nonce_account = excluded.nonce_account,
          status = 'ready', error = null, submitted_at = null, created_at = now();
end;
$$;
revoke all on function app_private.submit_launch_tx(uuid, public.side_letter, text, text, text) from public, anon;
grant execute on function app_private.submit_launch_tx(uuid, public.side_letter, text, text, text) to authenticated;

create function public.submit_launch_tx(
  p_battle uuid,
  p_side public.side_letter,
  p_signed_tx text,
  p_nonce_account text,
  p_mint text
)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.submit_launch_tx(p_battle, p_side, p_signed_tx, p_nonce_account, p_mint); $$;
revoke all on function public.submit_launch_tx(uuid, public.side_letter, text, text, text) from public, anon;
grant execute on function public.submit_launch_tx(uuid, public.side_letter, text, text, text) to authenticated;
