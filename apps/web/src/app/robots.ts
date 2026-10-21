import type { MetadataRoute } from "next";
import { solanaPublicEnv } from "@/lib/env";

/** Robots : tout est public sauf l'administration et l'API. */
export default function robots(): MetadataRoute.Robots {
  const base = solanaPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/en/admin", "/fr/admin"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
