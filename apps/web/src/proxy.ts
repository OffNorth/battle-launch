import { NextResponse, type NextRequest } from "next/server";
import { hasLocale, negotiateLocale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * 1. Les pages sans langue (/docs) sont redirigées vers /<langue du navigateur>/docs.
 * 2. À chaque requête, la session Supabase est rafraîchie (cookies).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (!pathname.startsWith("/api") && !hasLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${negotiateLocale(request.headers.get("accept-language"))}${pathname === "/" ? "" : pathname}`;
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
