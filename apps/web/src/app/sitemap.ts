import type { MetadataRoute } from "next";
import { LOCALES } from "@/i18n/config";
import { solanaPublicEnv } from "@/lib/env";

/** Plan du site pour les moteurs de recherche : pages publiques fixes, dans chaque langue. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = solanaPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const pages = ["", "/docs", "/leaderboard", "/hall-of-fame", "/create"];
  return pages.flatMap((p) =>
    LOCALES.map((l) => ({
      url: `${base}/${l}${p}`,
      alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${base}/${x}${p}`])) },
    })),
  );
}
