"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, switchLocalePath, type Locale } from "@/i18n/config";

/** Liens FR / EN vers la même page dans l'autre langue. */
export function LangSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
  return <LangLinks current={current} label={label} pathname={pathname} />;
}

/** Version sans lecture de l'adresse (affichée pendant le chargement) : liens vers l'accueil de chaque langue. */
export function LangSwitcherStatic({ current, label }: { current: Locale; label: string }) {
  return <LangLinks current={current} label={label} pathname={`/${current}`} />;
}

function LangLinks({
  current,
  label,
  pathname,
}: {
  current: Locale;
  label: string;
  pathname: string;
}) {
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-xs font-semibold uppercase">
      {LOCALES.map((l) => (
        <Link
          key={l}
          href={switchLocalePath(pathname, l)}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className={
            l === current
              ? "rounded px-1.5 py-0.5 text-foreground"
              : "rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground"
          }
        >
          {l}
        </Link>
      ))}
    </nav>
  );
}
