import { ChevronRight, House, KeyRound, Store, Tags, UserRound, Users } from "lucide-react";
import { Link } from "react-router";
import { PageHeader } from "../../components/ui/misc.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useConfig, useSession } from "../../lib/queries.ts";

export function SettingsPage() {
  const t = useT();
  const { data: config } = useConfig();
  const { isParent, isChild, ownMemberId } = useSession();

  const items = [
    { to: "/reglages/compte", icon: KeyRound, title: t("settings.account"), desc: t("settings.accountDesc"), show: !isChild },
    { to: `/reglages/membres/${ownMemberId}`, icon: UserRound, title: t("settings.myProfile"), desc: t("settings.myProfileDesc"), show: !isChild },
    { to: "/reglages/membres", icon: Users, title: t("settings.members"), desc: t("settings.membersDesc"), show: !isChild },
    { to: "/reglages/foyer", icon: House, title: t("settings.household"), desc: t("settings.householdDesc"), show: isParent },
    { to: "/reglages/rayons", icon: Tags, title: t("settings.categories"), desc: t("settings.categoriesDesc"), show: isParent },
    { to: "/reglages/magasins", icon: Store, title: t("settings.stores"), desc: t("settings.storesDesc"), show: !isChild },
  ].filter((i) => i.show);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("nav.settings")} description={isChild ? t("settings.childHint") : undefined} />
      {items.length > 0 && (
        <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
          {items.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="hover:bg-accent/60 flex items-center gap-4 px-4 py-3.5 transition-colors">
                <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="text-muted-foreground block truncate text-xs">{item.desc}</span>
                </span>
                <ChevronRight className="text-muted-foreground size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground mt-8 text-center text-xs">
        {config?.appName} v{config?.version} ·{" "}
        <a className="hover:text-foreground underline" href="https://github.com/jibay442/Cabas" target="_blank" rel="noreferrer">
          {t("settings.openSource")}
        </a>
      </p>
    </div>
  );
}
