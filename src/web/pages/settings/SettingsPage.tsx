import { Link } from "react-router";
import { Card, PageHeader } from "../../components/ui.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useConfig, useSession } from "../../lib/queries.ts";

export function SettingsPage() {
  const t = useT();
  const { data: config } = useConfig();
  const { isParent, isChild, ownMemberId, member } = useSession();

  const items = [
    { to: "/reglages/compte", emoji: "🙂", title: t("settings.account"), desc: t("settings.accountDesc"), show: !isChild },
    { to: `/reglages/membres/${ownMemberId}`, emoji: member.emoji, title: t("settings.myProfile"), desc: t("settings.myProfileDesc"), show: !isChild },
    { to: "/reglages/membres", emoji: "👨‍👩‍👧", title: t("settings.members"), desc: t("settings.membersDesc"), show: !isChild },
    { to: "/reglages/foyer", emoji: "🏠", title: t("settings.household"), desc: t("settings.householdDesc"), show: isParent },
    { to: "/reglages/rayons", emoji: "🏷️", title: t("settings.categories"), desc: t("settings.categoriesDesc"), show: isParent },
    { to: "/reglages/magasins", emoji: "🏪", title: t("settings.stores"), desc: t("settings.storesDesc"), show: !isChild },
  ].filter((i) => i.show);

  return (
    <>
      <PageHeader title={t("nav.settings")} />
      {isChild && <Card className="mb-3 text-stone-600 dark:text-stone-300">{t("settings.childHint")}</Card>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/70 transition hover:ring-accent dark:bg-stone-900 dark:ring-stone-800"
            >
              <span className="text-3xl" aria-hidden>
                {item.emoji}
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{item.title}</span>
                <span className="block text-sm text-stone-500 dark:text-stone-400">{item.desc}</span>
              </span>
              <span aria-hidden className="text-stone-400">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-center text-xs text-stone-500">
        {config?.appName} v{config?.version} ·{" "}
        <a className="underline" href="https://github.com/jibay442/Cabas" target="_blank" rel="noreferrer">
          {t("settings.openSource")}
        </a>
      </p>
    </>
  );
}
