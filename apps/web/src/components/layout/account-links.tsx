"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Liens « Mon profil » et « Admin » quand une personne est connectée (admin : seulement si elle l'est). */
export function AccountLinks(props: {
  locale: string;
  labels: { profile: string; admin: string };
}) {
  const [me, setMe] = useState<{ wallet: string; isAdmin: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ profile: { wallet: string; isAdmin: boolean } | null }>)
      .then((b) => alive && setMe(b.profile))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!me) return null;
  return (
    <>
      <Link href={`/${props.locale}/profile/${me.wallet}`} className="hover:text-foreground">
        {props.labels.profile}
      </Link>
      {me.isAdmin && (
        <Link href={`/${props.locale}/admin`} className="hover:text-foreground">
          {props.labels.admin}
        </Link>
      )}
    </>
  );
}
