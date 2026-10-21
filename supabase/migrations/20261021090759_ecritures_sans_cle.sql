-- ════════════════════════════════════════════════════════════════════════════
-- Le site n'utilise plus de clé secrète (service_role). Les écritures des
-- utilisateurs passent par des fonctions SECURITY DEFINER appelées avec LEUR
-- session : chaque fonction vérifie elle-même qui appelle (auth.uid()), s'il est
-- banni, sa limite de débit, et ne fait que ce qui est permis. Les tables restent
-- fermées en écriture pour anon et authenticated (voir schema_initial).
-- Le filtre de contenu (marques, personnes, haine) est appliqué par le site ET
-- revérifié par le worker avant tout lancement.
-- ════════════════════════════════════════════════════════════════════════════

-- Bornes de l'achat initial (devnet) : 0,01 à 1 SOL, aussi garanties par la base.
alter table public.battles
  add constraint battles_initial_buy_bounds
  check (initial_buy_lamports between 10000000 and 1000000000);

-- ── Limite de débit interne (n'est plus exposée par l'API) ──────────────────
alter function public.hit_rate_limit(text, integer, integer) set schema app_private;
revoke all on function app_private.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Profil appelant : existe et n'est pas banni, sinon erreur explicite.
create function app_private.current_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  banned boolean;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select p.is_banned into banned from public.profiles p where p.id = uid;
  if not found then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  if banned then
    raise exception 'banned' using errcode = 'P0001';
  end if;
  return uid;
end;
$$;
revoke all on function app_private.current_profile_id() from public, anon, authenticated;

-- Compte un passage pour l'appelant ; erreur « too_many_requests » si la limite est dépassée.
create function app_private.enforce_rate_limit(p_action text, p_limit integer, p_window_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.hit_rate_limit(p_action || ':' || (select auth.uid())::text, p_limit, p_window_seconds) then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function app_private.enforce_rate_limit(text, integer, integer) from public, anon, authenticated;

-- Nombre de battles par wallet et par jour (réglage public « limits »).
create function app_private.daily_battle_limit()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value ->> 'max_battles_per_wallet_per_day')::integer from public.settings where key = 'limits'),
    3
  );
$$;
revoke all on function app_private.daily_battle_limit() from public, anon, authenticated;

-- ── Remplacement des fonctions réservées au serveur ─────────────────────────
drop function public.create_battle(uuid, public.battle_mode, public.battle_status, text, integer, integer, public.score_mode, jsonb, bigint, timestamptz, timestamptz, jsonb);
drop function public.accept_duel(uuid, uuid, jsonb, timestamptz, timestamptz);

-- Crée une battle au nom de l'appelant. Statut et horaires décidés ici, pas par le client.
-- p_sides : [{ "side": "A", "name": …, "ticker": …, "description": …, "image_url": … }]
create function public.create_battle(
  p_mode public.battle_mode,
  p_theme text,
  p_duration_minutes integer,
  p_lobby_minutes integer,
  p_score_mode public.score_mode,
  p_score_weights jsonb,
  p_initial_buy_lamports bigint,
  p_sides jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  new_id uuid;
  side_count integer := jsonb_array_length(p_sides);
  is_open boolean := p_mode = 'open_duel';
begin
  perform app_private.enforce_rate_limit('create', app_private.daily_battle_limit(), 86400);
  if (is_open and side_count <> 1) or (not is_open and side_count <> 2) then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  insert into public.battles (
    created_by, mode, status, theme, duration_minutes, lobby_minutes, score_mode, score_weights,
    initial_buy_lamports, lobby_opens_at, launch_at
  ) values (
    me, p_mode, case when is_open then 'open' else 'lobby' end::public.battle_status, p_theme,
    p_duration_minutes, p_lobby_minutes, p_score_mode, p_score_weights, p_initial_buy_lamports,
    case when is_open then null else now() end,
    case when is_open then null else now() + make_interval(mins => p_lobby_minutes) end
  ) returning id into new_id;

  insert into public.battle_sides (battle_id, side, name, ticker, description, image_url, creator_id)
  select new_id,
         case when is_open then 'A' else (s ->> 'side') end::public.side_letter,
         s ->> 'name', upper(s ->> 'ticker'),
         nullif(s ->> 'description', ''), nullif(s ->> 'image_url', ''), me
  from jsonb_array_elements(p_sides) as s;

  return new_id;
end;
$$;

-- Relève un duel ouvert au nom de l'appelant ; ouvre le lobby.
create function public.accept_duel(p_battle uuid, p_side jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  b record;
begin
  perform app_private.enforce_rate_limit('accept', 10, 3600);
  select id, status, created_by, lobby_minutes into b from public.battles where id = p_battle for update;
  if not found or b.status <> 'open' then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  if b.created_by = me then
    raise exception 'own_battle' using errcode = 'P0001';
  end if;
  insert into public.battle_sides (battle_id, side, name, ticker, description, image_url, creator_id)
  values (p_battle, 'B', p_side ->> 'name', upper(p_side ->> 'ticker'),
          nullif(p_side ->> 'description', ''), nullif(p_side ->> 'image_url', ''), me);
  update public.battles
    set status = 'lobby', lobby_opens_at = now(), launch_at = now() + make_interval(mins => b.lobby_minutes)
    where id = p_battle;
end;
$$;

-- Pré-inscription au lobby (p_watch = vrai) ou désinscription (faux).
create function public.set_battle_watch(p_battle uuid, p_watch boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  st public.battle_status;
begin
  perform app_private.enforce_rate_limit('watch', 60, 3600);
  if p_watch then
    select status into st from public.battles where id = p_battle;
    if not found then
      raise exception 'not_found' using errcode = 'P0001';
    end if;
    if st not in ('open', 'lobby') then
      raise exception 'lobby_closed' using errcode = 'P0001';
    end if;
    insert into public.battle_watchers (battle_id, profile_id) values (p_battle, me)
      on conflict do nothing;
  else
    delete from public.battle_watchers where battle_id = p_battle and profile_id = me;
  end if;
end;
$$;

-- Annulation avant lancement, par le créateur ou un admin (journalisée pour un admin).
create function public.cancel_battle(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  owner uuid;
  admin boolean := app_private.is_admin();
begin
  select created_by into owner from public.battles where id = p_battle for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if owner <> me and not admin then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.battles
    set status = 'cancelled', cancel_reason = case when owner = me then 'creator' else 'admin' end
    where id = p_battle and status in ('draft', 'open', 'lobby');
  if not found then
    raise exception 'already_launched' using errcode = 'P0001';
  end if;
  if owner <> me then
    insert into public.audit_logs (actor_id, action, target) values (me, 'battle.cancel', p_battle::text);
  end if;
end;
$$;

-- Limite de débit d'une action du site faite hors base (mode Auto-IA, appel à l'API Claude).
create function public.consume_rate_limit(p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.current_profile_id();
  case p_action
    when 'ai' then perform app_private.enforce_rate_limit('ai', 10, 3600);
    else raise exception 'invalid_input' using errcode = 'P0001';
  end case;
end;
$$;

-- Droits : seules les personnes connectées appellent ces fonctions (anon : non).
revoke all on function public.create_battle(public.battle_mode, text, integer, integer, public.score_mode, jsonb, bigint, jsonb) from public, anon;
revoke all on function public.accept_duel(uuid, jsonb) from public, anon;
revoke all on function public.set_battle_watch(uuid, boolean) from public, anon;
revoke all on function public.cancel_battle(uuid) from public, anon;
revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.create_battle(public.battle_mode, text, integer, integer, public.score_mode, jsonb, bigint, jsonb) to authenticated;
grant execute on function public.accept_duel(uuid, jsonb) to authenticated;
grant execute on function public.set_battle_watch(uuid, boolean) to authenticated;
grant execute on function public.cancel_battle(uuid) to authenticated;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- Recherche de doublons : lecture de données déjà publiques, ouverte aux personnes connectées.
grant execute on function public.find_similar_sides(text[], real) to authenticated;
