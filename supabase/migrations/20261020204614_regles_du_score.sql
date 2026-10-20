-- Poids du score en points de base (entiers, total 10 000) et règles anti-triche figées dans
-- chaque battle : le calcul (packages/shared) n'utilise que des entiers, pour que le gagnant
-- soit reproductible au bit près depuis le snapshot.
alter table public.battles
  alter column score_weights set default '{"volume":3500,"holders":3500,"market_cap":2000,"buys":1000}';

alter table public.battles
  add column market_cap_window_seconds integer not null default 300
    check (market_cap_window_seconds between 60 and 1800),
  -- Règles anti-triche publiées avec la battle (montants en chaînes décimales : lamports, unités brutes).
  add column anti_cheat_rules jsonb not null default
    '{"maxWalletVolumeLamports":"5000000000","maxBuysPerWallet":20,"washWindowSeconds":120,"minHolderTokens":"1000000","minClusterSize":3}';

alter table public.battles
  add constraint battles_score_weights_total check (
    (score_weights ->> 'volume')::int + (score_weights ->> 'holders')::int
    + (score_weights ->> 'market_cap')::int + (score_weights ->> 'buys')::int = 10000
  );

-- Réglages par défaut alignés sur ces règles.
update public.settings
  set value = '{"maxWalletVolumeLamports":"5000000000","maxBuysPerWallet":20,"washWindowSeconds":120,"minHolderTokens":"1000000","minClusterSize":3,"ignoredFunders":[]}',
      updated_at = now()
  where key = 'anti_cheat';
