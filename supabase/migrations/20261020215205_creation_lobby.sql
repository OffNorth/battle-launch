-- ════════════════════════════════════════════════════════════════════════════
-- Étape 4 : création des battles, duels ouverts, lobby (pré-inscription),
-- limites de débit et recherche de doublons. Les fonctions ci-dessous ne sont
-- exécutables QUE par le serveur (service_role), après validation Zod.
-- ════════════════════════════════════════════════════════════════════════════

-- « open » : duel ouvert, un camp proposé, en attente d'un challenger (public).
alter type public.battle_status add value if not exists 'open' before 'lobby';

-- Nombre de pré-inscrits, affiché publiquement (la liste, elle, reste privée).
alter table public.battles add column watchers_count integer not null default 0 check (watchers_count >= 0);

-- ── Pré-inscriptions au lobby ───────────────────────────────────────────────
create table public.battle_watchers (
  battle_id uuid not null references public.battles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (battle_id, profile_id)
);
create index battle_watchers_profile_idx on public.battle_watchers (profile_id);
alter table public.battle_watchers enable row level security;
create policy "mes pre-inscriptions" on public.battle_watchers
  for select to authenticated using (profile_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.battle_watchers from anon, authenticated;

create function app_private.sync_watchers_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.battles set watchers_count = watchers_count + 1 where id = new.battle_id;
  elsif tg_op = 'DELETE' then
    update public.battles set watchers_count = greatest(watchers_count - 1, 0) where id = old.battle_id;
  end if;
  return null;
end;
$$;
revoke all on function app_private.sync_watchers_count() from public;
create trigger battle_watchers_count
  after insert or delete on public.battle_watchers
  for each row execute function app_private.sync_watchers_count();

-- ── Limites de débit (par wallet, par adresse IP…) ──────────────────────────
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table public.rate_limits enable row level security;
create policy "limites de debit : aucun acces public" on public.rate_limits
  for select to anon, authenticated using (false);

-- Compte un passage pour `p_key` dans une fenêtre fixe de `p_window_seconds`.
-- Renvoie vrai si la limite `p_limit` n'est pas dépassée (la requête peut passer).
create function public.hit_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into current_hits;
  return current_hits <= p_limit;
end;
$$;

-- ── Doublons de concepts (mode Auto-IA, et contrôle à la création) ──────────
create function public.find_similar_sides(p_names text[], p_min_similarity real default 0.45)
returns table (name text, battle_id uuid, similarity real)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.name, s.battle_id, max(extensions.similarity(lower(s.name), lower(q.n))) as similarity
  from public.battle_sides s
  cross join unnest(p_names) as q(n)
  where extensions.similarity(lower(s.name), lower(q.n)) >= p_min_similarity
  group by s.name, s.battle_id
  order by similarity desc
  limit 20;
$$;

-- ── Création atomique d'une battle et de ses camps ──────────────────────────
-- p_sides : [{ "side": "A", "name": …, "ticker": …, "description": …, "image_url": …, "creator_id": … }]
create function public.create_battle(
  p_creator uuid,
  p_mode public.battle_mode,
  p_status public.battle_status,
  p_theme text,
  p_duration_minutes integer,
  p_lobby_minutes integer,
  p_score_mode public.score_mode,
  p_score_weights jsonb,
  p_initial_buy_lamports bigint,
  p_lobby_opens_at timestamptz,
  p_launch_at timestamptz,
  p_sides jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.battles (
    created_by, mode, status, theme, duration_minutes, lobby_minutes, score_mode, score_weights,
    initial_buy_lamports, lobby_opens_at, launch_at
  ) values (
    p_creator, p_mode, p_status, p_theme, p_duration_minutes, p_lobby_minutes, p_score_mode, p_score_weights,
    p_initial_buy_lamports, p_lobby_opens_at, p_launch_at
  ) returning id into new_id;

  insert into public.battle_sides (battle_id, side, name, ticker, description, image_url, creator_id)
  select new_id, (s ->> 'side')::public.side_letter, s ->> 'name', s ->> 'ticker',
         nullif(s ->> 'description', ''), nullif(s ->> 'image_url', ''), (s ->> 'creator_id')::uuid
  from jsonb_array_elements(p_sides) as s;

  return new_id;
end;
$$;

-- ── Un challenger relève un duel ouvert ─────────────────────────────────────
-- Renvoie 'ok', 'not_open' (déjà relevé, annulé…) ou 'own_battle'.
create function public.accept_duel(
  p_battle uuid,
  p_challenger uuid,
  p_side jsonb,
  p_lobby_opens_at timestamptz,
  p_launch_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b record;
begin
  select id, status, created_by into b from public.battles where id = p_battle for update;
  if not found or b.status <> 'open' then
    return 'not_open';
  end if;
  if b.created_by = p_challenger then
    return 'own_battle';
  end if;
  insert into public.battle_sides (battle_id, side, name, ticker, description, image_url, creator_id)
  values (p_battle, 'B', p_side ->> 'name', p_side ->> 'ticker', nullif(p_side ->> 'description', ''),
          nullif(p_side ->> 'image_url', ''), p_challenger);
  update public.battles
    set status = 'lobby', lobby_opens_at = p_lobby_opens_at, launch_at = p_launch_at
    where id = p_battle;
  return 'ok';
end;
$$;

-- Fonctions réservées au serveur.
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.find_similar_sides(text[], real) from public, anon, authenticated;
revoke execute on function public.create_battle(uuid, public.battle_mode, public.battle_status, text, integer, integer, public.score_mode, jsonb, bigint, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.accept_duel(uuid, uuid, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.find_similar_sides(text[], real) to service_role;
grant execute on function public.create_battle(uuid, public.battle_mode, public.battle_status, text, integer, integer, public.score_mode, jsonb, bigint, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.accept_duel(uuid, uuid, jsonb, timestamptz, timestamptz) to service_role;
