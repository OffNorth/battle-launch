-- ════════════════════════════════════════════════════════════════════════════
-- Les fonctions SECURITY DEFINER sortent du schéma exposé par l'API (conseil du
-- linter Supabase 0029) : leur code privilégié vit dans app_private, et l'API ne
-- garde que des relais SECURITY INVOKER (sans droits particuliers) de même nom.
-- L'appel reste réservé aux personnes connectées ; chaque fonction privée vérifie
-- toujours l'appelant (auth.uid()), le ban et la limite de débit.
-- ════════════════════════════════════════════════════════════════════════════

alter function public.create_battle(public.battle_mode, text, integer, integer, public.score_mode, jsonb, bigint, jsonb) set schema app_private;
alter function public.accept_duel(uuid, jsonb) set schema app_private;
alter function public.set_battle_watch(uuid, boolean) set schema app_private;
alter function public.cancel_battle(uuid) set schema app_private;
alter function public.consume_rate_limit(text) set schema app_private;

grant execute on function app_private.create_battle(public.battle_mode, text, integer, integer, public.score_mode, jsonb, bigint, jsonb) to authenticated;
grant execute on function app_private.accept_duel(uuid, jsonb) to authenticated;
grant execute on function app_private.set_battle_watch(uuid, boolean) to authenticated;
grant execute on function app_private.cancel_battle(uuid) to authenticated;
grant execute on function app_private.consume_rate_limit(text) to authenticated;

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
language sql
security invoker
set search_path = ''
as $$
  select app_private.create_battle(p_mode, p_theme, p_duration_minutes, p_lobby_minutes, p_score_mode,
                                   p_score_weights, p_initial_buy_lamports, p_sides);
$$;

create function public.accept_duel(p_battle uuid, p_side jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.accept_duel(p_battle, p_side); $$;

create function public.set_battle_watch(p_battle uuid, p_watch boolean)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.set_battle_watch(p_battle, p_watch); $$;

create function public.cancel_battle(p_battle uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.cancel_battle(p_battle); $$;

create function public.consume_rate_limit(p_action text)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.consume_rate_limit(p_action); $$;

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
