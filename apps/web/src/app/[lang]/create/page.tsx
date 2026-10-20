import type { Metadata } from "next";
import { CreateWizard } from "@/components/create/create-wizard";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.create.title };
}

/** Assistant de création en 4 étapes (mode, camps, règles, récapitulatif). */
export default async function CreatePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black">{dict.create.title}</h1>
      <CreateWizard dict={dict} locale={locale} />
    </div>
  );
}
