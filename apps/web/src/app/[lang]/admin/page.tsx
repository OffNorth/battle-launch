import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminAction, SettingEditor } from "@/components/admin/admin-action";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { shortWallet } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.title, robots: { index: false } };
}

/** Modération et réglages, réservés aux admins (vérifié ici ET par la base à chaque action). */
export default async function AdminPage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-black">{dict.admin.title}</h1>
      <Suspense
        fallback={<p className="mt-6 text-sm text-muted-foreground">{dict.home.loading}</p>}
      >
        <AdminContent dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}

async function AdminContent({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const me = await getCurrentProfile();
  const t = dict.admin;
  if (!me?.isAdmin) return <p className="mt-6 text-sm">{t.forbidden}</p>;
  // Session de l'admin : la RLS lui montre aussi les brouillons, messages masqués et journal.
  const supabase = await createClient();
  const [reports, battles, messages, settings, logs] = await Promise.all([
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, created_at")
      .eq("status", "open")
      .order("created_at")
      .limit(50),
    supabase
      .from("battles")
      .select("id, theme, status, is_featured, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("chat_messages")
      .select("id, body, is_hidden, battle_id, author_id, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("settings").select("key, value").in("key", ["limits", "anti_cheat"]),
    supabase
      .from("audit_logs")
      .select("id, action, target, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="mt-8 grid gap-10">
      <section aria-labelledby="reports">
        <h2 id="reports" className="mb-3 text-lg font-bold">
          {t.reports}
        </h2>
        {(reports.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noReports}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {(reports.data ?? []).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
              >
                <span className="rounded bg-muted px-1.5 text-xs">{r.target_type}</span>
                {r.target_type === "battle" ? (
                  <Link
                    className="font-mono text-xs underline"
                    href={`/${locale}/battle/${r.target_id}`}
                  >
                    {r.target_id.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="font-mono text-xs">{r.target_id.slice(0, 12)}</span>
                )}
                <span className="flex-1">{r.reason}</span>
                <AdminAction
                  label={t.actioned}
                  body={{ action: "report", reportId: r.id, status: "actioned" }}
                />
                <AdminAction
                  label={t.dismiss}
                  body={{ action: "report", reportId: r.id, status: "dismissed" }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="battles">
        <h2 id="battles" className="mb-3 text-lg font-bold">
          {t.battles}
        </h2>
        <ul className="space-y-2 text-sm">
          {(battles.data ?? []).map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2"
            >
              <Link href={`/${locale}/battle/${b.id}`} className="flex-1 truncate hover:underline">
                {b.theme}
              </Link>
              <span className="text-xs text-muted-foreground">{dict.battle.status[b.status]}</span>
              <AdminAction
                label={b.is_featured ? t.unfeature : t.feature}
                body={{ action: "feature", battleId: b.id, value: !b.is_featured }}
              />
              {["draft", "open", "lobby"].includes(b.status) && (
                <AdminAction
                  label={t.cancel}
                  tone="danger"
                  confirm={dict.lobby.cancelConfirm}
                  body={{ action: "cancel", battleId: b.id }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="messages">
        <h2 id="messages" className="mb-3 text-lg font-bold">
          {t.messages}
        </h2>
        <ul className="space-y-2 text-sm">
          {(messages.data ?? []).map((m) => (
            <li
              key={m.id}
              className={`flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 ${m.is_hidden ? "opacity-60" : ""}`}
            >
              <span className="flex-1 break-words">{m.body}</span>
              <AdminAction
                label={m.is_hidden ? t.unhide : t.hide}
                body={{ action: "hide", messageId: m.id, value: !m.is_hidden }}
              />
              <AdminAction
                label={t.ban}
                tone="danger"
                confirm={t.ban}
                body={{ action: "ban", profileId: m.author_id, value: true }}
              />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="settings" className="grid gap-4 sm:grid-cols-2">
        <h2 id="settings" className="text-lg font-bold sm:col-span-2">
          {t.settings}
        </h2>
        {(settings.data ?? []).map((s) => (
          <SettingEditor
            key={s.key}
            settingKey={s.key}
            initial={s.value}
            saveLabel={t.save}
            savedLabel={t.saved}
          />
        ))}
      </section>

      <section aria-labelledby="logs">
        <h2 id="logs" className="mb-3 text-lg font-bold">
          {t.logs}
        </h2>
        <ul className="space-y-1 font-mono text-xs">
          {(logs.data ?? []).map((l) => (
            <li key={l.id}>
              {new Date(l.created_at).toISOString().slice(0, 16)} · {l.action} ·{" "}
              {l.target ? shortWallet(l.target) : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
