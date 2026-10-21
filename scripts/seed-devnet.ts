/**
 * Données de DÉMONSTRATION (devnet) : génère le SQL d'insertion, à exécuter avec un compte
 * administrateur de la base (connecteur Supabase ou éditeur SQL).
 *   npx tsx scripts/seed-devnet.ts          > seed.sql   (insère)
 *   npx tsx scripts/seed-devnet.ts --clean  > clean.sql  (retire tout ce qui est « démo »)
 *
 * Contenu : deux comptes de démo (identités web3 factices, sans clé), une battle terminée avec
 * ses trades, bougies, stats, wallets écartés, snapshot vérifiable et badge du gagnant ; une
 * battle en lobby ; un duel ouvert. Tout porte « (demo) » dans le thème et des identifiants fixes.
 * Les adresses de mint sont factices : ces tokens n'existent pas sur la chaîne.
 */
import {
  buildSnapshot,
  DEFAULT_WEIGHTS,
  PPM,
  type BattleParams,
  type Trade,
} from "../packages/shared/src";
import { fakeWallet, freshReserves, makeTrade, SOL } from "../packages/shared/src/battle/fixtures";
import { buildCandles } from "../apps/worker/src/jobs/index-trades";

const USER_A = "d0000000-0000-4000-8000-00000000000a";
const USER_B = "d0000000-0000-4000-8000-00000000000b";
const FINISHED = "d0000000-0000-4000-8000-000000000101";
const LOBBY = "d0000000-0000-4000-8000-000000000102";
const OPEN = "d0000000-0000-4000-8000-000000000103";
const WALLET_A = "Dem0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".slice(0, 44).replace(/0/g, "o");
const WALLET_B = "Dem0BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB".slice(0, 44).replace(/0/g, "o");
const MINT_A = "DemoMintCatAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA".slice(0, 44);
const MINT_B = "DemoMintDogBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB".slice(0, 44);

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

if (process.argv.includes("--clean")) {
  console.log(`-- Retire les données de démonstration
delete from public.battles where id in (${q(FINISHED)}, ${q(LOBBY)}, ${q(OPEN)});
delete from public.wallet_funders where wallet like 'W%1111';
delete from auth.users where id in (${q(USER_A)}, ${q(USER_B)});`);
  process.exit(0);
}

async function main() {
  // Battle terminée d'une heure : A (chat) a plus de holders, B (chien) un peu plus de volume.
  const now = Math.floor(Date.now() / 1000);
  const startedAt = now - 2 * 3600;
  const endsAt = startedAt + 3600;
  const ra = freshReserves();
  const rb = freshReserves();
  const trades: Trade[] = [];
  const add = (side: "A" | "B", who: string, buy: boolean, sol: bigint, t: number) =>
    trades.push(makeTrade(side, fakeWallet(who), buy, sol, startedAt + t, side === "A" ? ra : rb));
  add("A", "CreatorA", true, 50_000_000n, 2); // achat initial des créateurs (exclus du score)
  add("B", "CreatorB", true, 50_000_000n, 3);
  const buyersA = ["Ana", "Ben", "Cleo", "Dan", "Eva", "Finn", "Gus", "Hugo", "Iris"];
  const buyersB = ["Jade", "Kim", "Leo", "Mia", "Noah"];
  buyersA.forEach((w, i) => add("A", w, true, SOL / 4n + BigInt(i) * 10_000_000n, 120 + i * 300));
  buyersB.forEach((w, i) => add("B", w, true, SOL / 2n + BigInt(i) * 20_000_000n, 150 + i * 420));
  add("A", "Ben", false, SOL / 10n, 2400);
  add("B", "Whale", true, 9n * SOL, 1800); // baleine : plafonnée à 5 SOL
  add("B", "Flip", true, SOL, 3000); // aller-retour rapide : écarté
  add("B", "Flip", false, SOL, 3050);

  const params: BattleParams = {
    battleId: FINISHED,
    formulaVersion: 1,
    scoreMode: "composite",
    weights: DEFAULT_WEIGHTS,
    startedAt,
    endsAt,
    marketCapWindowSeconds: 300,
    creatorWallets: [fakeWallet("CreatorA"), fakeWallet("CreatorB")],
    ignoredFunders: [],
    rules: {
      maxWalletVolumeLamports: 5n * SOL,
      maxBuysPerWallet: 20,
      washWindowSeconds: 120,
      minHolderTokens: 1_000_000n,
      minClusterSize: 3,
    },
    curve: {
      A: {
        totalSupply: 1_000_000_000_000_000n,
        initialVirtualSolReserves: 30_000_000_000n,
        initialVirtualTokenReserves: 1_073_000_000_000_000n,
      },
      B: {
        totalSupply: 1_000_000_000_000_000n,
        initialVirtualSolReserves: 30_000_000_000n,
        initialVirtualTokenReserves: 1_073_000_000_000_000n,
      },
    },
  };
  // Les wallets des créateurs de la démo sont les fakeWallet : on les déclare comme créateurs.
  const snap = await buildSnapshot(params, trades, {});
  const r = snap.result;
  const winner = r.winner === "draw" ? null : r.winner;
  const ts = (s: number) => q(new Date(s * 1000).toISOString());

  const lines: string[] = [];
  lines.push(
    "-- Données de démonstration BATTLE LAUNCH (devnet). Retirer : seed-devnet.ts --clean",
  );
  lines.push("begin;");
  for (const [id, wallet] of [
    [USER_A, WALLET_A],
    [USER_B, WALLET_B],
  ] as const) {
    lines.push(
      `insert into auth.users (id, instance_id, aud, role, created_at, updated_at) values (${q(id)}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now(), now()) on conflict do nothing;`,
      `insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at) values (${q(`web3:solana:${wallet}`)}, ${q(id)}, '{}', 'web3', now(), now()) on conflict do nothing;`,
    );
  }
  lines.push(`update public.profiles set display_name = 'demo-cat' where id = ${q(USER_A)};`);
  lines.push(`update public.profiles set display_name = 'demo-dog' where id = ${q(USER_B)};`);

  const curve = JSON.stringify({
    totalSupply: "1000000000000000",
    initialVirtualSolReserves: "30000000000",
    initialVirtualTokenReserves: "1073000000000000",
  });
  lines.push(`insert into public.battles (id, theme, mode, status, duration_minutes, lobby_minutes, score_mode, initial_buy_lamports, created_by, lobby_opens_at, launch_at, started_at, ends_at, finished_at, winner_side, is_featured, curve_params)
values (${q(FINISHED)}, 'Cat vs Dog (demo)', 'creator', 'finished', 60, 10, 'composite', 50000000, ${q(USER_A)}, ${ts(startedAt - 600)}, ${ts(startedAt)}, ${ts(startedAt)}, ${ts(endsAt)}, ${ts(endsAt + 30)}, ${winner ? q(winner) : "null"}, true, ${q(curve)});`);
  lines.push(`insert into public.battle_sides (battle_id, side, name, ticker, description, creator_id, mint) values
  (${q(FINISHED)}, 'A', 'Whiskers', 'MEOW', 'Nine lives, zero worries.', ${q(USER_A)}, ${q(MINT_A)}),
  (${q(FINISHED)}, 'B', 'Rex', 'WOOF', 'Good boy energy.', ${q(USER_A)}, ${q(MINT_B)});`);
  lines.push(
    `insert into public.trades (battle_id, side, signature, ix_index, slot, block_time, wallet, is_buy, sol_lamports, token_amount, virtual_sol_reserves, virtual_token_reserves) values`,
    trades
      .map(
        (t) =>
          `  (${q(FINISHED)}, ${q(t.side)}, ${q(t.signature)}, ${t.ixIndex}, ${t.slot}, ${ts(t.blockTime)}, ${q(t.wallet)}, ${t.isBuy}, ${t.solLamports}, ${t.tokenAmount}, ${t.virtualSolReserves}, ${t.virtualTokenReserves})`,
      )
      .join(",\n") + ";",
  );
  for (const side of ["A", "B"] as const) {
    const m = r.metrics[side];
    lines.push(
      `insert into public.side_stats (battle_id, side, volume_lamports, buys, sells, unique_holders, market_cap_lamports, score) values (${q(FINISHED)}, '${side}', ${m.volumeLamports}, ${m.buys}, ${m.rawSells}, ${m.holders}, ${m.marketCapLamports}, ${(r.scorePpm[side] / PPM).toFixed(6)});`,
    );
  }
  const candles = buildCandles(trades);
  lines.push(
    `insert into public.candles (battle_id, side, bucket, open_price, high_price, low_price, close_price, volume_lamports) values`,
    candles
      .map(
        (c) =>
          `  (${q(FINISHED)}, '${c.side}', ${q(c.bucket.toISOString())}, ${c.open_price}, ${c.high_price}, ${c.low_price}, ${c.close_price}, ${c.volume_lamports})`,
      )
      .join(",\n") + ";",
  );
  if (r.flags.length > 0) {
    lines.push(
      `insert into public.wallet_flags (battle_id, wallet, reason, details) values`,
      r.flags
        .map(
          (f) =>
            `  (${q(FINISHED)}, ${q(f.wallet)}, ${q(f.reason)}, ${q(JSON.stringify({ detail: f.detail }))})`,
        )
        .join(",\n") + " on conflict do nothing;",
    );
  }
  lines.push(
    `insert into public.snapshots (battle_id, formula_version, payload, sha256) values (${q(FINISHED)}, 1, ${q(snap.json)}::jsonb, ${q(snap.sha256)});`,
  );
  if (winner) {
    lines.push(
      `insert into public.badges (profile_id, battle_id, kind) values (${q(USER_A)}, ${q(FINISHED)}, 'winner');`,
    );
  }

  // Une battle en lobby (départ dans 7 jours : la démo reste visible) et un duel ouvert.
  lines.push(`insert into public.battles (id, theme, mode, status, duration_minutes, lobby_minutes, score_mode, initial_buy_lamports, created_by, lobby_opens_at, launch_at)
values (${q(LOBBY)}, 'Pizza vs Burger (demo)', 'creator', 'lobby', 60, 15, 'composite', 20000000, ${q(USER_B)}, now(), now() + interval '7 days');`);
  lines.push(`insert into public.battle_sides (battle_id, side, name, ticker, description, creator_id) values
  (${q(LOBBY)}, 'A', 'Margherita', 'PIZZA', 'Thin crust, big dreams.', ${q(USER_B)}),
  (${q(LOBBY)}, 'B', 'Double Stack', 'BURGR', 'Two patties, no regrets.', ${q(USER_B)});`);
  lines.push(`insert into public.battles (id, theme, mode, status, duration_minutes, lobby_minutes, score_mode, initial_buy_lamports, created_by)
values (${q(OPEN)}, 'Sun vs Moon (demo)', 'open_duel', 'open', 180, 10, 'volume', 50000000, ${q(USER_A)});`);
  lines.push(`insert into public.battle_sides (battle_id, side, name, ticker, description, creator_id) values
  (${q(OPEN)}, 'A', 'Sunny', 'SUN', 'Always shining.', ${q(USER_A)});`);
  lines.push("commit;");
  console.log(lines.join("\n"));
  console.error(
    `snapshot ${snap.sha256} — gagnant ${r.winner} (${r.scorePpm.A} / ${r.scorePpm.B} ppm)`,
  );
}

void main();
