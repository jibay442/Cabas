import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Theme } from "../../../shared/types.ts";
import { Button, Card, cx, Input, PageHeader, Select, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useSession } from "../../lib/queries.ts";
import { applyTheme } from "../../lib/theme.ts";

export function AccountSettings() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });

  const update = useMutation({
    mutationFn: (body: object) => api.patch("/auth/me", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
    onError: (e) => toast(e instanceof ApiError ? e.message : t("common.error"), "error"),
  });
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  const themes: { value: Theme; emoji: string }[] = [
    { value: "SYSTEM", emoji: "🌗" },
    { value: "LIGHT", emoji: "☀️" },
    { value: "DARK", emoji: "🌙" },
  ];

  return (
    <>
      <PageHeader title={t("settings.account")} back="/reglages" />
      <div className="space-y-4">
        <Card className="space-y-4">
          <p className="text-sm text-stone-500 dark:text-stone-400">{user.email}</p>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">{t("theme.label")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={user.theme === theme.value}
                  onClick={() => {
                    applyTheme(theme.value);
                    update.mutate({ theme: theme.value });
                  }}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-xl py-3 ring-1 ring-stone-200 dark:ring-stone-700",
                    user.theme === theme.value && "bg-accent/10 ring-2 ring-accent",
                  )}
                >
                  <span className="text-2xl" aria-hidden>
                    {theme.emoji}
                  </span>
                  <span className="text-sm">{t(`theme.${theme.value}`)}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <Select label={t("settings.language")} value={user.locale} onChange={(e) => update.mutate({ locale: e.target.value })}>
            <option value="fr">🇫🇷 Français</option>
            <option value="en">🇬🇧 English</option>
          </Select>
        </Card>

        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate(passwords, {
                onSuccess: () => {
                  setPasswords({ currentPassword: "", newPassword: "" });
                  toast(t("settings.passwordChanged"));
                },
              });
            }}
          >
            <h2 className="font-semibold">{t("settings.changePassword")}</h2>
            <Input
              label={t("settings.currentPassword")}
              type="password"
              autoComplete="current-password"
              required
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
            />
            <Input
              label={t("settings.newPassword")}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint={t("auth.passwordHint")}
              value={passwords.newPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
            />
            <Button type="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
          </form>
        </Card>

        <Button variant="secondary" className="w-full" onClick={() => logout.mutate()} loading={logout.isPending}>
          🚪 {t("auth.logout")}
        </Button>
      </div>
    </>
  );
}
