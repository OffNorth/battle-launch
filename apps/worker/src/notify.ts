import type { WorkerEnv } from "./env";
import { log } from "./log";

/**
 * Annonce du gagnant sur Telegram, seulement si TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID sont
 * réglés. Texte sans promesse de gain. Le token fait partie de l'adresse appelée : il n'est
 * jamais écrit dans un journal ni dans un message d'erreur.
 */
export async function announceWinner(
  env: WorkerEnv,
  info: { theme: string; winner: string | null; loser: string | null; url: string },
): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const text = info.winner
    ? `🏆 ${info.winner} wins the battle against ${info.loser} (${info.theme}).\nResults and verifiable snapshot: ${info.url}\nMemecoins are extremely risky. Not financial advice.`
    : `🤝 Draw in the battle ${info.theme}.\nResults: ${info.url}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: false,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) log("notify", `Telegram a répondu ${res.status}`);
  } catch {
    log("notify", "Telegram injoignable");
  }
}
