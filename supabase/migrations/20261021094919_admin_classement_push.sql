-- ════════════════════════════════════════════════════════════════════════════
-- Étapes 7 et 8 : classement, notifications web push, administration.
-- Toutes les actions d'admin vérifient is_admin() et sont journalisées (audit_logs).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Classement des créateurs (vue publique, droits de l'appelant) ──────────
create view public.leaderboard with (security_invoker = true) as
select p.id,
       p.wallet,
       p.display_name,
       (select count(*) from public.badges b where b.profile_id = p.id and b.kind = 'winner')::integer as wins,
       (select count(distinct s.battle_id) from public.battle_sides s
          join public.battles bt on bt.id = s.battle_id
         where s.creator_id = p.id and bt.status = 'finished')::integer as battles_played
from public.profiles p
where not p.is_banned;
grant select on public.leaderboard to anon, authenticated, battle_worker;

-- ── Notifications web push ──────────────────────────────────────────────────
create function app_private.save_push_subscription(p_endpoint text, p_keys jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
begin
  perform app_private.enforce_rate_limit('push', 20, 3600);
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or jsonb_typeof(p_keys -> 'p256dh') <> 'string' or jsonb_typeof(p_keys -> 'auth') <> 'string' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, keys)
    values (me, p_endpoint, jsonb_build_object('p256dh', p_keys ->> 'p256dh', 'auth', p_keys ->> 'auth'))
    on conflict (endpoint) do update set profile_id = excluded.profile_id, keys = excluded.keys;
end;
$$;

-- Le worker range ici la clé publique VAPID qu'il a générée (la clé privée reste dans son Redis).
grant insert, update on public.settings to battle_worker;
grant delete on public.push_subscriptions to battle_worker;

-- ── Administration ──────────────────────────────────────────────────────────
create function app_private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
begin
  if not app_private.is_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return me;
end;
$$;

create function app_private.admin_set_featured(p_battle uuid, p_featured boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := app_private.require_admin();
begin
  update public.battles set is_featured = p_featured where id = p_battle;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, target, details)
    values (me, 'battle.feature', p_battle::text, jsonb_build_object('featured', p_featured));
end;
$$;

create function app_private.admin_hide_message(p_message bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := app_private.require_admin();
begin
  update public.chat_messages set is_hidden = p_hidden where id = p_message;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, target, details)
    values (me, 'chat.hide', p_message::text, jsonb_build_object('hidden', p_hidden));
end;
$$;

create function app_private.admin_set_banned(p_profile uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := app_private.require_admin();
begin
  if p_profile = me then raise exception 'forbidden' using errcode = 'P0001'; end if;
  update public.profiles set is_banned = p_banned where id = p_profile;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, target, details)
    values (me, 'profile.ban', p_profile::text, jsonb_build_object('banned', p_banned));
end;
$$;

create function app_private.admin_resolve_report(p_report bigint, p_status public.report_status)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := app_private.require_admin();
begin
  update public.reports set status = p_status where id = p_report;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.audit_logs (actor_id, action, target, details)
    values (me, 'report.resolve', p_report::text, jsonb_build_object('status', p_status));
end;
$$;

-- Réglages modifiables : limites et anti-triche seulement (objets JSON).
create function app_private.admin_update_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := app_private.require_admin();
begin
  if p_key not in ('limits', 'anti_cheat') or jsonb_typeof(p_value) <> 'object' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  update public.settings set value = p_value, updated_at = now() where key = p_key;
  insert into public.audit_logs (actor_id, action, target, details)
    values (me, 'settings.update', p_key, p_value);
end;
$$;

-- ── Droits et relais publics ────────────────────────────────────────────────
do $$
declare
  f text;
begin
  foreach f in array array[
    'save_push_subscription(text, jsonb)',
    'admin_set_featured(uuid, boolean)',
    'admin_hide_message(bigint, boolean)',
    'admin_set_banned(uuid, boolean)',
    'admin_resolve_report(bigint, public.report_status)',
    'admin_update_setting(text, jsonb)'
  ] loop
    execute format('revoke all on function app_private.%s from public, anon', f);
    execute format('grant execute on function app_private.%s to authenticated', f);
  end loop;
end $$;
revoke all on function app_private.require_admin() from public, anon, authenticated;

create function public.save_push_subscription(p_endpoint text, p_keys jsonb)
returns void language sql security invoker set search_path = ''
as $$ select app_private.save_push_subscription(p_endpoint, p_keys); $$;
create function public.admin_set_featured(p_battle uuid, p_featured boolean)
returns void language sql security invoker set search_path = ''
as $$ select app_private.admin_set_featured(p_battle, p_featured); $$;
create function public.admin_hide_message(p_message bigint, p_hidden boolean)
returns void language sql security invoker set search_path = ''
as $$ select app_private.admin_hide_message(p_message, p_hidden); $$;
create function public.admin_set_banned(p_profile uuid, p_banned boolean)
returns void language sql security invoker set search_path = ''
as $$ select app_private.admin_set_banned(p_profile, p_banned); $$;
create function public.admin_resolve_report(p_report bigint, p_status public.report_status)
returns void language sql security invoker set search_path = ''
as $$ select app_private.admin_resolve_report(p_report, p_status); $$;
create function public.admin_update_setting(p_key text, p_value jsonb)
returns void language sql security invoker set search_path = ''
as $$ select app_private.admin_update_setting(p_key, p_value); $$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_push_subscription(text, jsonb)',
    'admin_set_featured(uuid, boolean)',
    'admin_hide_message(bigint, boolean)',
    'admin_set_banned(uuid, boolean)',
    'admin_resolve_report(bigint, public.report_status)',
    'admin_update_setting(text, jsonb)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
