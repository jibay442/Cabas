import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useHouseholdEvents } from "../lib/events.ts";
import { useT } from "../lib/i18n.tsx";
import { useConfig, useSession } from "../lib/queries.ts";
import { ProfileSwitcher } from "./ProfileSwitcher.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Avatar, cx } from "./ui.tsx";

export function Layout() {
  const t = useT();
  const { data: config } = useConfig();
  const { member, household, isChild } = useSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  useHouseholdEvents();

  // Un profil enfant n'a accès qu'à la liste, à ses repas et au changement de profil
  const tabs = [
    { to: "/", emoji: "🛒", label: t("nav.list"), end: true },
    { to: "/tickets", emoji: "🧾", label: t("nav.receipts"), hidden: isChild },
    { to: "/repas", emoji: "🍽️", label: t("nav.meals") },
    { to: "/bilan", emoji: "📊", label: t("nav.stats"), hidden: isChild },
    { to: "/reglages", emoji: "⚙️", label: t("nav.settings") },
  ].filter((tab) => !tab.hidden);

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">
        {t("nav.skip")}
      </a>
      <header className="sticky top-0 z-20 flex items-center gap-3 bg-stone-100/85 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur dark:bg-stone-950/85">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold tracking-tight">
            <span aria-hidden>🛒 </span>
            {config?.appName ?? "Cabas"}
          </div>
          <div className="truncate text-xs text-stone-500 dark:text-stone-400">{household.name}</div>
        </div>
        <nav aria-label={t("nav.main")} className="hidden gap-1 md:flex">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cx("rounded-xl px-3 py-2 text-sm font-medium", isActive ? "bg-accent text-white" : "hover:bg-stone-200 dark:hover:bg-stone-800")
              }
            >
              <span aria-hidden>{tab.emoji}</span> {tab.label}
            </NavLink>
          ))}
        </nav>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={t("profile.switchTitle")}
        >
          <Avatar emoji={member.emoji} color={member.color} label={member.displayName} />
        </button>
      </header>

      <main id="main" className="flex-1 px-4 pb-28 pt-2 md:pb-10">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 md:pb-[env(safe-area-inset-bottom)]">
        {/* Emplacement où une page peut afficher une barre au-dessus de la navigation (ex. total de la liste) */}
        <div id="bottom-slot" className="mx-auto max-w-3xl" />
        <nav
          aria-label={t("nav.main")}
          className="border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-stone-800 dark:bg-stone-900/95"
        >
          <ul className="mx-auto flex max-w-3xl">
            {tabs.map((tab) => (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cx(
                      "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition",
                      isActive ? "text-accent-ink" : "text-stone-500 dark:text-stone-400",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span aria-hidden className={cx("text-2xl transition", isActive && "scale-110")}>
                        {tab.emoji}
                      </span>
                      {tab.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ProfileSwitcher open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
