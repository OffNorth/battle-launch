"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALES, switchLocalePath, type Locale } from "@/i18n/config";

/** Liens FR / EN vers la même page dans l'autre langue. */
export function LangSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
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
