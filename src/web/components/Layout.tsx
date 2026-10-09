import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChartPie, LogOut, Receipt, Settings, ShoppingCart, UserRound, Users, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { api } from "../lib/api.ts";
import { useHouseholdEvents } from "../lib/events.ts";
import { useT } from "../lib/i18n.tsx";
import { useConfig, useSession } from "../lib/queries.ts";
import { cn } from "../lib/utils.ts";
import { Logo } from "./Logo.tsx";
import { ProfileSwitcher } from "./ProfileSwitcher.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { Avatar } from "./ui/avatar.tsx";
import { Button } from "./ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground");

export function Layout() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();
  const { member, household, isChild, ownMemberId, user } = useSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  useHouseholdEvents();

  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  // Un profil enfant n'a accès qu'à la liste, à ses repas et aux réglages (changement de profil)
  const tabs = [
    { to: "/", icon: ShoppingCart, label: t("nav.list"), end: true },
    { to: "/tickets", icon: Receipt, label: t("nav.receipts"), hidden: isChild },
    { to: "/repas", icon: UtensilsCrossed, label: t("nav.meals") },
    { to: "/bilan", icon: ChartPie, label: t("nav.stats"), hidden: isChild },
    { to: "/reglages", icon: Settings, label: t("nav.settings") },
  ].filter((tab) => !tab.hidden);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="bg-background sr-only rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50">
        {t("nav.skip")}
      </a>
      <header className="bg-card/80 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-semibold">
            <Logo />
            <span>{config?.appName ?? "Cabas"}</span>
            <span className="text-muted-foreground hidden truncate text-sm font-normal sm:inline">· {household.name}</span>
          </Link>
          <nav aria-label={t("nav.main")} className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={navClass}>
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar size="sm" name={member.displayName} color={member.color} />
                  <span className="hidden max-w-40 truncate sm:inline">{member.displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="truncate">{member.displayName}</span>
                  <span className="text-muted-foreground truncate text-xs font-normal">{isChild ? t("role.CHILD") : user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSwitcherOpen(true)}>
                  <Users /> {t("profile.switchTitle")}
                </DropdownMenuItem>
                {member.id === ownMemberId && (
                  <>
                    <DropdownMenuItem onSelect={() => navigate("/reglages/compte")}>
                      <UserRound /> {t("settings.account")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => logout.mutate()}>
                      <LogOut /> {t("auth.logout")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-40 md:pt-8 md:pb-12">
        <Outlet />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30">
        {/* Emplacement où une page ancre un élément au-dessus de la navigation (ex. saisie de la liste sur mobile) */}
        <div id="bottom-slot" />
        <nav aria-label={t("nav.main")} className="bg-card/95 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="flex">
            {tabs.map((tab) => (
              <li key={tab.to} className="flex-1">
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn("flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground")
                  }
                >
                  <tab.icon className="size-5" aria-hidden />
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ProfileSwitcher open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </div>
  );
}
