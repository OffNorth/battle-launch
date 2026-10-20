"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Rafraîchit la page quand la battle change en base (lobby -> lancement -> direct -> terminée,
 * nombre d'inscrits…), sans recharger. Abonnement Realtime « postgres_changes » filtré sur la
 * battle : la RLS s'applique, un visiteur ne reçoit que ce qu'il a le droit de lire.
 */
export function BattleLiveRefresh({ battleId }: { battleId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`battle:${battleId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${battleId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [battleId, router]);
  return null;
}
