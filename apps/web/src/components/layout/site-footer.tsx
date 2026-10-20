import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";

export function SiteFooter({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <footer className="mt-auto border-t border-border/60 px-4 py-6 text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <p className="font-medium text-foreground/80">{dict.footer.risk}</p>
        <p>{dict.footer.nonCustodial}</p>
        <Link
          href={`/${locale}/docs`}
          className="w-fit underline underline-offset-4 hover:text-foreground"
        >
          {dict.nav.docs}
        </Link>
      </div>
    </footer>
  );
}
