-- ════════════════════════════════════════════════════════════════════════════
-- Lancement en deux transactions par camp (création, puis achat initial), chacune
-- avec son durable nonce : une seule transaction dépasse la limite de 1 232 octets.
-- Paramètres de la courbe lus sur la chaîne au lancement (devnet ≠ mainnet).
-- ════════════════════════════════════════════════════════════════════════════

alter table public.launch_txs
  add column buy_tx text,
  add column buy_nonce_account text;
grant update (buy_tx, buy_nonce_account) on public.launch_txs to battle_worker;

-- { "totalSupply": "…", "initialVirtualSolReserves": "…", "initialVirtualTokenReserves": "…" } (chaînes décimales).
alter table public.battles add column curve_params jsonb;
grant update (curve_params) on public.battles to battle_worker;

drop function public.submit_launch_tx(uuid, public.side_letter, text, text, text);
drop function app_private.submit_launch_tx(uuid, public.side_letter, text, text, text);

create function app_private.submit_launch_tx(
  p_battle uuid,
  p_side public.side_letter,
  p_mint text,
  p_create_tx text,
  p_create_nonce text,
  p_buy_tx text,
  p_buy_nonce text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := app_private.current_profile_id();
  s record;
  base58 constant text := '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
  base64 constant text := '^[A-Za-z0-9+/=]{100,2400}$';
begin
  perform app_private.enforce_rate_limit('launch_tx', 20, 3600);
  if p_create_tx !~ base64 or p_buy_tx !~ base64
     or p_mint !~ base58 or p_create_nonce !~ base58 or p_buy_nonce !~ base58 then
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
  insert into public.launch_txs (side_id, signed_tx, nonce_account, buy_tx, buy_nonce_account)
    values (s.id, p_create_tx, p_create_nonce, p_buy_tx, p_buy_nonce)
    on conflict (side_id) do update
      set signed_tx = excluded.signed_tx, nonce_account = excluded.nonce_account,
          buy_tx = excluded.buy_tx, buy_nonce_account = excluded.buy_nonce_account,
          status = 'ready', error = null, submitted_at = null, created_at = now();
end;
$$;
revoke all on function app_private.submit_launch_tx(uuid, public.side_letter, text, text, text, text, text) from public, anon;
grant execute on function app_private.submit_launch_tx(uuid, public.side_letter, text, text, text, text, text) to authenticated;

create function public.submit_launch_tx(
  p_battle uuid,
  p_side public.side_letter,
  p_mint text,
  p_create_tx text,
  p_create_nonce text,
  p_buy_tx text,
  p_buy_nonce text
)
returns void
language sql
security invoker
set search_path = ''
as $$ select app_private.submit_launch_tx(p_battle, p_side, p_mint, p_create_tx, p_create_nonce, p_buy_tx, p_buy_nonce); $$;
revoke all on function public.submit_launch_tx(uuid, public.side_letter, text, text, text, text, text) from public, anon;
grant execute on function public.submit_launch_tx(uuid, public.side_letter, text, text, text, text, text) to authenticated;
