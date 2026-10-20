import { parseEnv, SolanaCluster } from "@battle/shared";
import { z } from "zod";

/**
 * Variables publiques (visibles par le navigateur) : jamais de secret ici.
 * Chaque variable est citée en toutes lettres pour que Next.js l'insère au build.
 * Validées à la première utilisation (et non à l'import) pour que le build passe
 * même avant que les variables soient réglées sur Vercel.
 */
const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SOLANA_CLUSTER: SolanaCluster.default("devnet"),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.url().default("https://api.devnet.solana.com"),
});
export type PublicEnv = z.infer<typeof PublicEnv>;

let cached: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  cached ??= parseEnv(PublicEnv, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  });
  return cached;
}

/** Réglages Solana publics seuls (ont une valeur par défaut : utilisables pendant le build). */
export function solanaPublicEnv() {
  return parseEnv(
    PublicEnv.pick({ NEXT_PUBLIC_SOLANA_CLUSTER: true, NEXT_PUBLIC_SOLANA_RPC_URL: true }),
    {
      NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
      NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    },
  );
}
