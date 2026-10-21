import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { lang } from "next/root-params";
import { Analytics } from "@vercel/analytics/next";
import { AnimatedBackground } from "@/components/layout/animated-background";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SolanaProvider } from "@/components/providers/solana-provider";
import { LOCALES } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { solanaPublicEnv } from "@/lib/env";
import "../globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/** Attribut HTML pas encore dans les types de React. */
const RENDER_BLOCKING = { blocking: "render" } as Record<string, string>;

export async function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l }));
}

/** Couleur de la barre du navigateur sur mobile : fond du thème sombre (le défaut). */
export const viewport: Viewport = { themeColor: "#07080b" };

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  const locale = await lang();
  return {
    title: { default: dict.meta.title, template: `%s · ${dict.meta.title}` },
    description: dict.meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    openGraph: { siteName: dict.meta.title, locale, type: "website" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const dict = await getDictionary();
  const solana = solanaPublicEnv();
  return (
    <html
      lang={locale}
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Thème choisi appliqué avant le premier affichage (public/theme-init.js). Script externe
          « async » : React 19 l'accepte (une balise <script> en ligne donne une erreur) ;
          blocking="render" fait attendre le premier affichage jusqu'à son exécution (pas de flash).
        */}
        <script src="/theme-init.js" async {...RENDER_BLOCKING} />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <AnimatedBackground />
        <SolanaProvider rpcUrl={solana.NEXT_PUBLIC_SOLANA_RPC_URL}>
          <SiteHeader dict={dict} locale={locale} cluster={solana.NEXT_PUBLIC_SOLANA_CLUSTER} />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter dict={dict} locale={locale} />
        </SolanaProvider>
        {/* Statistiques de visite sans cookie ni données personnelles (Vercel Web Analytics). */}
        <Analytics />
      </body>
    </html>
  );
}
