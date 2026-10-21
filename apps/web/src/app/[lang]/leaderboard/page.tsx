import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { shortWallet } from "@/lib/format";
import { getLeaderboard } from "@/lib/results";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.ranks.leaderboard, description: dict.ranks.leaderboardIntro };
}

export default async function LeaderboardPage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">{dict.ranks.leaderboard}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{dict.ranks.leaderboardIntro}</p>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted-foreground">{dict.home.loading}</p>}
      >
        <Table dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}

async function Table({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const rows = await getLeaderboard();
  if (rows.length === 0)
    return <p className="mt-6 text-sm text-muted-foreground">{dict.ranks.empty}</p>;
  return (
    <table className="mt-6 w-full rounded-xl border border-border bg-card text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="p-3" scope="col">
            #
          </th>
          <th className="p-3" scope="col">
            {dict.ranks.wallet}
          </th>
          <th className="p-3 text-right" scope="col">
            {dict.ranks.wins}
          </th>
          <th className="p-3 text-right" scope="col">
            {dict.ranks.played}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.wallet} className="border-t border-border">
            <td className="p-3 font-mono">{i + 1}</td>
            <td className="p-3">
              <Link href={`/${locale}/profile/${r.wallet}`} className="font-mono hover:underline">
                {r.displayName ?? shortWallet(r.wallet)}
              </Link>
            </td>
            <td className="p-3 text-right font-semibold text-side-a">{r.wins}</td>
            <td className="p-3 text-right">{r.played}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
