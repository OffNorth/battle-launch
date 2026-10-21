import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { shortWallet } from "@/lib/format";
import { getProfile } from "@/lib/results";

const Wallet = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/profile/[wallet]">): Promise<Metadata> {
  const dict = await getDictionary();
  const { wallet } = await params;
  return {
    title: `${dict.profile.title} ${Wallet.safeParse(wallet).success ? shortWallet(wallet) : ""}`,
  };
}

export default async function ProfilePage({ params }: PageProps<"/[lang]/profile/[wallet]">) {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted-foreground">{dict.home.loading}</p>}>
        <ProfileView params={params} dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}

async function ProfileView(props: {
  params: PageProps<"/[lang]/profile/[wallet]">["params"];
  dict: Dictionary;
  locale: Locale;
}) {
  const { wallet } = await props.params;
  if (!Wallet.safeParse(wallet).success) notFound();
  const profile = await getProfile(wallet);
  if (!profile) notFound();
  const t = props.dict.profile;
  return (
    <>
      <h1 className="text-3xl font-black">{profile.displayName ?? shortWallet(profile.wallet)}</h1>
      <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{profile.wallet}</p>
      <p className="mt-3 text-sm">
        {t.since.replace("{date}", new Date(profile.createdAt).toLocaleDateString(props.locale))} ·{" "}
        <strong className="text-side-a">{t.wins.replace("{n}", String(profile.wins))}</strong>
      </p>
      <h2 className="mt-8 mb-3 text-lg font-bold">{t.battles}</h2>
      {profile.battles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.none}</p>
      ) : (
        <ul className="space-y-2">
          {profile.battles.map((b) => (
            <li key={b.id}>
              <Link
                href={`/${props.locale}/battle/${b.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:border-side-a/60"
              >
                <span className="truncate">{b.theme}</span>
                <span className="shrink-0 text-xs">
                  {b.won === true ? (
                    <span className="font-semibold text-side-a">{t.won}</span>
                  ) : b.won === false ? (
                    <span className="text-muted-foreground">{t.lost}</span>
                  ) : (
                    props.dict.battle.status[b.status as keyof Dictionary["battle"]["status"]]
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
