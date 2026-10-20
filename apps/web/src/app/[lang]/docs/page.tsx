import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.docs.title, description: dict.docs.intro };
}

/** Règles, formule publique du score, anti-triche, vérification, FAQ et avertissement des risques. */
export default async function DocsPage() {
  const d = (await getDictionary()).docs;
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-black">{d.title}</h1>
      <p className="mt-3 text-muted-foreground">{d.intro}</p>

      <section
        className="mt-8 rounded-xl border border-destructive/50 bg-destructive/10 p-5"
        aria-labelledby="risks"
      >
        <h2 id="risks" className="text-lg font-bold text-destructive">
          {d.risk.title}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {d.risk.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <DocSection id="how" title={d.how.title}>
        <ol className="list-decimal space-y-2 pl-5">
          {d.how.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </DocSection>

      <DocSection id="score" title={d.score.title}>
        <p>{d.score.intro}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {d.score.criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-md border border-border bg-card/60 p-3 font-mono text-xs">
          score(A) = Σ weight × A / (A + B) · score(B) = 100 % − score(A)
        </p>
        <p className="mt-3">{d.score.composite}</p>
        <p className="mt-2">{d.score.ties}</p>
        <p className="mt-2 text-muted-foreground">{d.score.integers}</p>
      </DocSection>

      <DocSection id="anti-cheat" title={d.antiCheat.title}>
        <ul className="list-disc space-y-2 pl-5">
          {d.antiCheat.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </DocSection>

      <DocSection id="verify" title={d.verify.title}>
        <p>{d.verify.body}</p>
      </DocSection>

      <DocSection id="faq" title={d.faq.title}>
        <dl className="space-y-4">
          {d.faq.items.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </DocSection>
    </article>
  );
}

function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mt-10 scroll-mt-24 text-sm leading-relaxed"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`} className="mb-3 text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}
