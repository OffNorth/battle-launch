import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

/** Page « introuvable » (battle inexistante, adresse inconnue), dans la langue de la page. */
export default async function NotFound() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-5xl font-black text-side-a">404</p>
      <p className="text-muted-foreground">{dict.errors.not_found}</p>
      <Link
        href={`/${locale}`}
        className="rounded-md border border-side-b/60 px-4 py-2 text-sm text-side-b"
      >
        {dict.nav.battles}
      </Link>
    </div>
  );
}
