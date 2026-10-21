import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getHallOfFame } from "@/lib/results";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.ranks.hallOfFame, description: dict.ranks.hallIntro };
}

export default async function HallOfFamePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black">{dict.ranks.hallOfFame}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{dict.ranks.hallIntro}</p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted-foreground">{dict.home.loading}</p>}
      >
        <Winners dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Winners({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const rows = await getHallOfFame();
  if (rows.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">{dict.ranks.empty}</p>;
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Link
            href={`/${locale}/battle/${r.id}`}
            className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:border-side-a/60"
          >
            {r.isFeatured && (
              <span className="w-fit rounded-full bg-side-a px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-side">
                {dict.ranks.featured}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{r.theme}</span>
            <span className="text-lg font-black">
              🏆 <span className="text-side-a">{r.winner?.name}</span>{" "}
              <span className="text-sm font-normal text-muted-foreground">{dict.ranks.beat}</span>{" "}
              <span className="text-side-b">{r.loser?.name}</span>
            </span>
            {r.winner?.score !== null && r.winner?.score !== undefined && (
              <span className="font-mono text-xs text-muted-foreground">
                {(r.winner.score * 100).toFixed(1)} % –{" "}
                {((r.loser?.score ?? 1 - r.winner.score) * 100).toFixed(1)} %
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
