import { Suspense } from "react";
import { BattleCard } from "@/components/battle/battle-card";
import { Hero } from "@/components/home/hero";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { listHomeBattles, type BattleSummary } from "@/lib/battles";

export default async function HomePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <>
      <Hero text={dict.hero} docsHref={`/${locale}/docs`} />
      <div className="mx-auto w-full max-w-6xl px-4 pb-16">
        <Suspense
          fallback={
            <p className="py-8 text-center text-sm text-muted-foreground">{dict.home.loading}</p>
          }
        >
          <BattleSections dict={dict} locale={locale} />
        </Suspense>
      </div>
    </>
  );
}

/** Lu à chaque requête (données vivantes), derrière le Suspense : le reste de la page reste instantané. */
async function BattleSections({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  let data: Awaited<ReturnType<typeof listHomeBattles>>;
  try {
    data = await listHomeBattles();
  } catch {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{dict.home.unavailable}</p>
    );
  }
  return (
    <div className="flex flex-col gap-10">
      <Section
        title={dict.home.live}
        empty={dict.home.emptyLive}
        battles={data.live}
        dict={dict}
        locale={locale}
      />
      <Section
        title={dict.home.upcoming}
        empty={dict.home.emptyUpcoming}
        battles={data.upcoming}
        dict={dict}
        locale={locale}
      />
      <Section
        title={dict.home.results}
        empty={dict.home.emptyResults}
        battles={data.results}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}

function Section(props: {
  title: string;
  empty: string;
  battles: BattleSummary[];
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <section aria-label={props.title}>
      <h2 className="mb-4 text-lg font-bold">{props.title}</h2>
      {props.battles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {props.empty}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {props.battles.map((b) => (
            <BattleCard key={b.id} battle={b} dict={props.dict} locale={props.locale} />
          ))}
        </div>
      )}
    </section>
  );
}
