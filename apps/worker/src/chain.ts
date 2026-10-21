import { bondingCurvePda, PUMP_SDK, pumpIdl } from "@pump-fun/pump-sdk";
import {
  PublicKey,
  Transaction,
  type Connection,
  type VersionedTransactionResponse,
} from "@solana/web3.js";

/**
 * Lecture et envoi sur la chaîne. Le worker n'a AUCUNE clé : il envoie des transactions déjà
 * signées par les créateurs et lit les trades publics.
 */

const TRADE_EVENT = Buffer.from(
  (
    pumpIdl.events.find((e: { name: string }) => e.name === "TradeEvent") as {
      discriminator: number[];
    }
  ).discriminator,
);

export type ChainTrade = {
  signature: string;
  ixIndex: number;
  slot: number;
  blockTime: number;
  wallet: string;
  isBuy: boolean;
  solLamports: bigint;
  tokenAmount: bigint;
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
};

/** Trades de `mint` dans une transaction, lus dans ses journaux (événements TradeEvent de pump.fun). */
export function tradesFromTransaction(
  tx: VersionedTransactionResponse,
  mint: string,
): ChainTrade[] {
  if (!tx.blockTime || tx.meta?.err) return [];
  const out: ChainTrade[] = [];
  let index = 0;
  for (const line of tx.meta?.logMessages ?? []) {
    if (!line.startsWith("Program data: ")) continue;
    const data = Buffer.from(line.slice("Program data: ".length), "base64");
    if (!data.subarray(0, 8).equals(TRADE_EVENT)) continue;
    const ev = PUMP_SDK.decodeTradeEventBc(data.subarray(8));
    const thisIndex = index++;
    if (ev.mint.toBase58() !== mint) continue;
    out.push({
      signature: tx.transaction.signatures[0] ?? "",
      ixIndex: thisIndex,
      slot: tx.slot,
      blockTime: tx.blockTime,
      wallet: ev.user.toBase58(),
      isBuy: ev.isBuy,
      solLamports: BigInt(ev.solAmount.toString()),
      tokenAmount: BigInt(ev.tokenAmount.toString()),
      virtualSolReserves: BigInt(ev.virtualSolReserves.toString()),
      virtualTokenReserves: BigInt(ev.virtualTokenReserves.toString()),
    });
  }
  return out;
}

/** Signatures récentes touchant la courbe d'un token, jusqu'à une signature déjà connue (exclue). */
export async function newCurveSignatures(
  connection: Connection,
  mint: string,
  isKnown: (signature: string) => boolean,
  maxPages = 5,
): Promise<string[]> {
  const curve = bondingCurvePda(new PublicKey(mint));
  const found: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const sigs = await connection.getSignaturesForAddress(
      curve,
      { limit: 200, ...(before ? { before } : {}) },
      "confirmed",
    );
    if (sigs.length === 0) break;
    let reachedKnown = false;
    for (const s of sigs) {
      if (isKnown(s.signature)) {
        reachedKnown = true;
        break;
      }
      if (!s.err) found.push(s.signature);
    }
    if (reachedKnown || sigs.length < 200) break;
    before = sigs[sigs.length - 1]?.signature;
  }
  return found.reverse(); // du plus ancien au plus récent
}

/**
 * Qui a envoyé ses premiers SOL à `wallet` (anti-triche : groupes de wallets d'une même source).
 * Renvoie null pour un wallet ancien et très actif (plus de 1 000 transactions : pas un wallet
 * fabriqué pour la battle) ou introuvable.
 */
export async function firstFunder(connection: Connection, wallet: string): Promise<string | null> {
  const key = new PublicKey(wallet);
  const sigs = await connection.getSignaturesForAddress(key, { limit: 1000 }, "confirmed");
  if (sigs.length === 0 || sigs.length >= 1000) return null;
  const oldest = sigs[sigs.length - 1]?.signature;
  if (!oldest) return null;
  const tx = await connection.getTransaction(oldest, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 255,
  });
  if (!tx?.meta) return null;
  const keys = tx.transaction.message.getAccountKeys({
    accountKeysFromLookups: tx.meta.loadedAddresses ?? null,
  });
  const all = keys.keySegments().flat();
  const me = all.findIndex((k) => k.equals(key));
  if (me < 0) return null;
  const gain = (tx.meta.postBalances[me] ?? 0) - (tx.meta.preBalances[me] ?? 0);
  if (gain <= 0) return null;
  let funder: string | null = null;
  let biggestLoss = 0;
  all.forEach((k, i) => {
    if (i === me) return;
    const loss = (tx.meta?.preBalances[i] ?? 0) - (tx.meta?.postBalances[i] ?? 0);
    if (loss > biggestLoss) {
      biggestLoss = loss;
      funder = k.toBase58();
    }
  });
  return funder;
}

/**
 * Envoie une transaction pré-signée à durable nonce et attend sa confirmation (au plus
 * `timeoutMs`). Renvoie la signature, ou une erreur explicite.
 */
export async function sendNonceTx(
  connection: Connection,
  base64: string,
  nonceAccount: string,
  timeoutMs = 90_000,
): Promise<{ ok: true; signature: string } | { ok: false; error: string }> {
  const raw = Buffer.from(base64, "base64");
  const nonceValue = Transaction.from(raw).recentBlockhash;
  if (!nonceValue) return { ok: false, error: "no_nonce_value" };
  try {
    const minContextSlot = await connection.getSlot("confirmed");
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      maxRetries: 5,
    });
    const confirmation = connection.confirmTransaction(
      { signature, nonceAccountPubkey: new PublicKey(nonceAccount), nonceValue, minContextSlot },
      "confirmed",
    );
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs),
    );
    const result = await Promise.race([confirmation, timeout]);
    if (result.value.err)
      return { ok: false, error: `chain:${JSON.stringify(result.value.err).slice(0, 120)}` };
    return { ok: true, signature };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 160) : "send_failed" };
  }
}
