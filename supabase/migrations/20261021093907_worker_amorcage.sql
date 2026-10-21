-- ════════════════════════════════════════════════════════════════════════════
-- Compte du worker en production, dont PERSONNE ne voit le mot de passe :
-- - battle_worker garde les droits (et sert aux essais en local) ;
-- - battle_worker_prod hérite de ces droits et se connecte depuis Railway ;
-- - au premier démarrage, le worker se fabrique un mot de passe au hasard, le range
--   dans son Redis privé, et en donne l'empreinte à la base grâce à un identifiant
--   d'amorçage (battle_bootstrap) à usage unique, qui se désactive aussitôt.
-- Aucun mot de passe dans ce fichier.
-- ════════════════════════════════════════════════════════════════════════════

create role battle_worker_prod login bypassrls nosuperuser nocreatedb nocreaterole connection limit 10;
grant battle_worker to battle_worker_prod;

create role battle_bootstrap login nosuperuser nocreatedb nocreaterole connection limit 2;
grant usage on schema app_private to battle_bootstrap;

-- Pose l'empreinte (SCRAM-SHA-256) du mot de passe du worker de production, puis désactive
-- l'identifiant d'amorçage : il ne peut servir qu'une fois.
create function app_private.rotate_worker_password(p_verifier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_verifier !~ '^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$' then
    raise exception 'invalid_verifier' using errcode = 'P0001';
  end if;
  execute format('alter role battle_worker_prod password %L', p_verifier);
  alter role battle_bootstrap nologin;
end;
$$;
revoke all on function app_private.rotate_worker_password(text) from public, anon, authenticated;
grant execute on function app_private.rotate_worker_password(text) to battle_bootstrap;
