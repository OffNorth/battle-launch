import Link from "next/link";
import { Suspense } from "react";
import { SignInButton } from "@/components/auth/sign-in-button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { LangSwitcher, LangSwitcherStatic } from "./lang-switcher";

export function SiteHeader({
  dict,
  locale,
  cluster,
}: {
  dict: Dictionary;
  locale: Locale;
  cluster: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href={`/${locale}`} className="shrink-0 font-black tracking-tight">
            <span className="text-side-a">BATTLE</span> <span className="text-side-b">LAUNCH</span>
          </Link>
          {cluster === "devnet" && (
            <span className="hidden rounded-full border border-side-b/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-side-b sm:inline">
              {dict.nav.devnet}
            </span>
          )}
          <nav className="hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <Link href={`/${locale}`} className="hover:text-foreground">
              {dict.nav.battles}
            </Link>
            <Link href={`/${locale}/create`} className="hover:text-foreground">
              {dict.nav.create}
            </Link>
            <Link href={`/${locale}/docs`} className="hover:text-foreground">
              {dict.nav.docs}
            </Link>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden md:block">
            <Suspense fallback={<LangSwitcherStatic current={locale} label={dict.nav.language} />}>
              <LangSwitcher current={locale} label={dict.nav.language} />
            </Suspense>
          </div>
          <SignInButton labels={dict.auth} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border/40 px-4 py-2 text-sm text-muted-foreground md:hidden">
        <nav className="flex gap-4">
          <Link href={`/${locale}`}>{dict.nav.battles}</Link>
          <Link href={`/${locale}/create`}>{dict.nav.create}</Link>
          <Link href={`/${locale}/docs`}>{dict.nav.docs}</Link>
        </nav>
        <Suspense fallback={<LangSwitcherStatic current={locale} label={dict.nav.language} />}>
          <LangSwitcher current={locale} label={dict.nav.language} />
        </Suspense>
      </div>
    </header>
  );
}
