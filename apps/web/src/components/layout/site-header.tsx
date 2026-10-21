import { Suspense } from "react";
import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { AccountLinks } from "./account-links";
import { ThemeToggle } from "./theme-toggle";

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
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href={`/${locale}`} className="shrink-0 text-lg font-semibold tracking-tight">
            <span className="text-side-a">battle</span>
            <span className="text-foreground">launch</span>
          </Link>
          {cluster === "devnet" && (
            <span className="hidden rounded-full border border-side-a/40 bg-side-a/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-side-a sm:inline">
              {dict.nav.devnet}
            </span>
          )}
          <nav className="hidden items-center gap-5 text-sm font-medium text-muted-foreground md:flex">
            <Link href={`/${locale}`} className="hover:text-foreground">
              {dict.nav.battles}
            </Link>
            <Link href={`/${locale}/create`} className="hover:text-foreground">
              {dict.nav.create}
            </Link>
            <Link href={`/${locale}/leaderboard`} className="hover:text-foreground">
              {dict.nav.leaderboard}
            </Link>
            <Link href={`/${locale}/hall-of-fame`} className="hover:text-foreground">
              {dict.nav.hallOfFame}
            </Link>
            <Link href={`/${locale}/docs`} className="hover:text-foreground">
              {dict.nav.docs}
            </Link>
            <AccountLinks
              locale={locale}
              labels={{ profile: dict.nav.profile, admin: dict.nav.admin }}
            />
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ThemeToggle labelLight={dict.nav.themeLight} labelDark={dict.nav.themeDark} />
          {/* Bornes : un écart au rendu (extension de wallet…) ne refait que ce bouton, pas toute la page. */}
          <Suspense fallback={null}>
            <SignInButton labels={dict.auth} />
          </Suspense>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2 text-sm text-muted-foreground md:hidden">
        <nav className="flex gap-4">
          <Link href={`/${locale}`}>{dict.nav.battles}</Link>
          <Link href={`/${locale}/create`}>{dict.nav.create}</Link>
          <Link href={`/${locale}/leaderboard`}>{dict.nav.leaderboard}</Link>
          <Link href={`/${locale}/docs`}>{dict.nav.docs}</Link>
        </nav>
      </div>
    </header>
  );
}
