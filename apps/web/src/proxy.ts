import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, hasLocale, RETIRED_LOCALES } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * 1. Les pages sans langue (/docs) et les anciennes adresses françaises (/fr/docs) sont redirigées
 *    vers /en/docs (le site est en anglais seulement).
 * 2. À chaque requête, la session Supabase est rafraîchie (cookies).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (!pathname.startsWith("/api") && !hasLocale(first)) {
    const url = request.nextUrl.clone();
    const retired = (RETIRED_LOCALES as readonly string[]).includes(first);
    const rest = retired ? pathname.slice(first.length + 1) : pathname;
    url.pathname = `/${DEFAULT_LOCALE}${rest === "/" ? "" : rest}`;
    return NextResponse.redirect(url);
  }
  return updateSession(request);
}

export const config = {
  // Tout sauf les fichiers statiques, les images et les fichiers de métadonnées.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
