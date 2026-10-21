import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { SnapshotVerifier } from "@/components/results/snapshot-verifier";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getBattle } from "@/lib/battles";
import { getSnapshot } from "@/lib/results";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.verify.title, description: dict.verify.intro };
}

/** Vérification publique d'un résultat : le navigateur recalcule tout depuis le snapshot. */
export default async function VerifyPage({ params }: PageProps<"/[lang]/battle/[id]/verify">) {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">{dict.verify.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{dict.verify.intro}</p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted-foreground">{dict.home.loading}</p>}
      >
        <Verification params={params} dict={dict} locale={locale} />
      </Suspense>
    </article>
  );
}

async function Verification(props: {
  params: PageProps<"/[lang]/battle/[id]/verify">["params"];
  dict: Dictionary;
  locale: Locale;
}) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [battle, snapshot] = await Promise.all([getBattle(id), getSnapshot(id)]);
  if (!battle) notFound();
  return (
    <div className="mt-8 flex flex-col gap-6">
      <Link href={`/${props.locale}/battle/${id}`} className="text-sm underline underline-offset-4">
        {battle.sides.A?.name} vs {battle.sides.B?.name}
      </Link>
      {snapshot ? (
        <SnapshotVerifier
          payload={snapshot.payload}
          sha256={snapshot.sha256}
          sideNames={{ A: battle.sides.A?.name ?? "A", B: battle.sides.B?.name ?? "B" }}
          labels={props.dict.verify}
          drawLabel={props.dict.battle.draw}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{props.dict.verify.noSnapshot}</p>
      )}
    </div>
  );
}
