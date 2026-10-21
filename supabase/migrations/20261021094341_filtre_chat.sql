-- ════════════════════════════════════════════════════════════════════════════
-- Filtre de contenu dans la base aussi (marques, personnes réelles, haine), pour
-- que personne ne le contourne en appelant la base directement. Même liste que le
-- site (générée par scripts/moderation-sql.ts depuis packages/shared/src/moderation.ts).
-- Chat et signalements, avec limite de débit.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists unaccent with schema extensions;

create table app_private.blocked_terms (
  term text primary key,
  category text not null check (category in ('hate', 'person', 'brand')),
  -- Cherché aussi à l'intérieur des mots collés (« nazicoin »).
  embedded boolean not null default false
);

-- Texte aplati comme côté site : minuscules, sans accents, chiffres « l33t » remplacés,
-- tout ce qui n'est pas une lettre devient une espace.
create function app_private.normalize_text(p text)
returns text
language sql
stable
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(extensions.unaccent(coalesce(p, ''))), '0134578@$€!|', 'oieastbaseii'),
    '[^a-z]+', ' ', 'g'));
$$;

-- Vrai si le texte ne contient aucun terme refusé.
create function app_private.is_text_clean(p text)
returns boolean
language sql
stable
set search_path = ''
as $$
  with n as (
    select ' ' || app_private.normalize_text(p) || ' ' as spaced,
           replace(app_private.normalize_text(p), ' ', '') as squashed
  )
  select not exists (
    select 1 from app_private.blocked_terms t, n
    where n.spaced like '% ' || t.term || ' %'
       or (position(' ' in t.term) > 0 and n.squashed like '%' || replace(t.term, ' ', '') || '%')
       or (t.embedded and n.squashed like '%' || t.term || '%')
  );
$$;
revoke all on function app_private.normalize_text(text) from public, anon, authenticated;
revoke all on function app_private.is_text_clean(text) from public, anon, authenticated;

insert into app_private.blocked_terms (term, category, embedded) values
  ('nazi', 'hate', true),
  ('hitler', 'hate', true),
  ('heil', 'hate', false),
  ('swastika', 'hate', true),
  ('kkk', 'hate', false),
  ('isis', 'hate', false),
  ('daesh', 'hate', true),
  ('jihad', 'hate', true),
  ('genocide', 'hate', true),
  ('holocaust', 'hate', true),
  ('nigger', 'hate', true),
  ('nigga', 'hate', true),
  ('negro', 'hate', false),
  ('faggot', 'hate', true),
  ('fagot', 'hate', true),
  ('tranny', 'hate', true),
  ('retard', 'hate', false),
  ('chink', 'hate', true),
  ('spic', 'hate', false),
  ('kike', 'hate', true),
  ('wetback', 'hate', true),
  ('beaner', 'hate', true),
  ('raghead', 'hate', true),
  ('towelhead', 'hate', true),
  ('pedo', 'hate', false),
  ('pedophile', 'hate', true),
  ('pedophil', 'hate', true),
  ('bougnoule', 'hate', true),
  ('negre', 'hate', true),
  ('youpin', 'hate', true),
  ('pede', 'hate', false),
  ('tarlouze', 'hate', true),
  ('bicot', 'hate', true),
  ('sale arabe', 'hate', false),
  ('sale juif', 'hate', false),
  ('sale noir', 'hate', false),
  ('trump', 'person', false),
  ('donald trump', 'person', false),
  ('biden', 'person', false),
  ('obama', 'person', false),
  ('kamala', 'person', false),
  ('harris', 'person', false),
  ('elon', 'person', false),
  ('musk', 'person', false),
  ('elon musk', 'person', false),
  ('putin', 'person', false),
  ('poutine', 'person', false),
  ('macron', 'person', false),
  ('zelensky', 'person', false),
  ('zelenskyy', 'person', false),
  ('xi jinping', 'person', false),
  ('kim jong', 'person', false),
  ('netanyahu', 'person', false),
  ('erdogan', 'person', false),
  ('modi', 'person', false),
  ('le pen', 'person', false),
  ('melenchon', 'person', false),
  ('bardella', 'person', false),
  ('zemmour', 'person', false),
  ('pope', 'person', false),
  ('pape', 'person', false),
  ('king charles', 'person', false),
  ('taylor swift', 'person', false),
  ('kanye', 'person', false),
  ('ye west', 'person', false),
  ('beyonce', 'person', false),
  ('rihanna', 'person', false),
  ('cristiano', 'person', false),
  ('ronaldo', 'person', false),
  ('messi', 'person', false),
  ('mbappe', 'person', false),
  ('neymar', 'person', false),
  ('lebron', 'person', false),
  ('bezos', 'person', false),
  ('zuckerberg', 'person', false),
  ('gates', 'person', false),
  ('bill gates', 'person', false),
  ('vitalik', 'person', false),
  ('cz binance', 'person', false),
  ('saylor', 'person', false),
  ('mrbeast', 'person', false),
  ('kardashian', 'person', false),
  ('andrew tate', 'person', false),
  ('nike', 'brand', false),
  ('adidas', 'brand', false),
  ('apple', 'brand', false),
  ('iphone', 'brand', false),
  ('google', 'brand', false),
  ('amazon', 'brand', false),
  ('microsoft', 'brand', false),
  ('tesla', 'brand', false),
  ('spacex', 'brand', false),
  ('netflix', 'brand', false),
  ('disney', 'brand', false),
  ('pixar', 'brand', false),
  ('marvel', 'brand', false),
  ('pepsi', 'brand', false),
  ('cocacola', 'brand', false),
  ('coca cola', 'brand', false),
  ('mcdonalds', 'brand', false),
  ('starbucks', 'brand', false),
  ('gucci', 'brand', false),
  ('louis vuitton', 'brand', false),
  ('chanel', 'brand', false),
  ('ferrari', 'brand', false),
  ('lamborghini', 'brand', false),
  ('rolex', 'brand', false),
  ('samsung', 'brand', false),
  ('sony', 'brand', false),
  ('playstation', 'brand', false),
  ('nintendo', 'brand', false),
  ('pokemon', 'brand', false),
  ('facebook', 'brand', false),
  ('instagram', 'brand', false),
  ('tiktok', 'brand', false),
  ('youtube', 'brand', false),
  ('twitter', 'brand', false),
  ('openai', 'brand', false),
  ('chatgpt', 'brand', false),
  ('binance', 'brand', false),
  ('coinbase', 'brand', false),
  ('visa', 'brand', false),
  ('mastercard', 'brand', false),
  ('paypal', 'brand', false),
  ('red bull', 'brand', false),
  ('redbull', 'brand', false),
  ('uber', 'brand', false),
  ('airbnb', 'brand', false)
on conflict (term) do nothing;

-- ── Création et duel : filtre de contenu aussi dans la base ─────────────────
create or replace function app_private.create_battle(
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
  all_text text;
begin
  perform app_private.enforce_rate_limit('create', app_private.daily_battle_limit(), 86400);
  if (is_open and side_count <> 1) or (not is_open and side_count <> 2) then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  select p_theme || ' ' || coalesce(string_agg(
           coalesce(s ->> 'name', '') || ' ' || coalesce(s ->> 'ticker', '') || ' ' || coalesce(s ->> 'description', ''),
           ' '), '')
    into all_text from jsonb_array_elements(p_sides) as s;
  if not app_private.is_text_clean(all_text) then
    raise exception 'content_refused' using errcode = 'P0001';
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

create or replace function app_private.accept_duel(p_battle uuid, p_side jsonb)
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
  if not app_private.is_text_clean(
       coalesce(p_side ->> 'name', '') || ' ' || coalesce(p_side ->> 'ticker', '') || ' ' || coalesce(p_side ->> 'description', '')) then
    raise exception 'content_refused' using errcode = 'P0001';
  end if;
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

-- ── Chat d'une battle ───────────────────────────────────────────────────────
create function app_private.post_chat_message(p_battle uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  st public.battle_status;
  new_id bigint;
begin
  perform app_private.enforce_rate_limit('chat', 12, 60);
  select status into st from public.battles where id = p_battle;
  if not found or st in ('draft', 'cancelled') then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 280 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if not app_private.is_text_clean(p_body) then
    raise exception 'content_refused' using errcode = 'P0001';
  end if;
  insert into public.chat_messages (battle_id, author_id, body) values (p_battle, me, btrim(p_body))
    returning id into new_id;
  return new_id;
end;
$$;

-- ── Signalements ────────────────────────────────────────────────────────────
create function app_private.submit_report(p_target_type public.report_target, p_target_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
begin
  perform app_private.enforce_rate_limit('report', 20, 3600);
  if char_length(coalesce(p_target_id, '')) not between 1 and 64
     or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  insert into public.reports (reporter_id, target_type, target_id, reason)
    values (me, p_target_type, p_target_id, btrim(p_reason));
end;
$$;

revoke all on function app_private.post_chat_message(uuid, text) from public, anon;
revoke all on function app_private.submit_report(public.report_target, text, text) from public, anon;
grant execute on function app_private.post_chat_message(uuid, text) to authenticated;
grant execute on function app_private.submit_report(public.report_target, text, text) to authenticated;

create function public.post_chat_message(p_battle uuid, p_body text)
returns bigint
language sql
security invoker
set search_path = ''
as $$ select app_private.post_chat_message(p_battle, p_body); $$;

create function public.submit_report(p_target_type public.report_target, p_target_id text, p_reason text)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.submit_report(p_target_type, p_target_id, p_reason); $$;

revoke all on function public.post_chat_message(uuid, text) from public, anon;
revoke all on function public.submit_report(public.report_target, text, text) from public, anon;
grant execute on function public.post_chat_message(uuid, text) to authenticated;
grant execute on function public.submit_report(public.report_target, text, text) to authenticated;

-- Profils publics des auteurs du chat (nom affiché) : déjà lisibles (policy « profils lisibles par tous »).
-- Bougies : prix en lamports pour un MILLION de tokens entiers (la petite courbe du devnet
-- donnerait 0 en lamports par token).
comment on column public.candles.open_price is 'Lamports pour 1 000 000 de tokens entiers';
