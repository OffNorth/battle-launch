import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l }));
}

/** Couleur de la barre du navigateur sur mobile : blanc du thème. */
export const viewport: Viewport = { themeColor: "#fbfefb" };

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
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
