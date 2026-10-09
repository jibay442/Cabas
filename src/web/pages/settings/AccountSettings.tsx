import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Theme } from "../../../shared/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { PageHeader } from "../../components/ui/misc.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useSession } from "../../lib/queries.ts";
import { applyTheme } from "../../lib/theme.ts";
import { BackToSettings, SettingsCard } from "./SettingsShared.tsx";

export function AccountSettings() {
  const t = useT();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });

  const update = useMutation({
    mutationFn: (body: object) => api.patch("/auth/me", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSettled: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader back={<BackToSettings />} title={t("settings.account")} description={user.email} />

      <SettingsCard title={t("settings.preferences")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("theme.label")}>
            {(id) => (
              <NativeSelect
                id={id}
                value={user.theme}
                onChange={(e) => {
                  const theme = e.target.value as Theme;
                  applyTheme(theme);
                  update.mutate({ theme });
                }}
              >
                <option value="SYSTEM">{t("theme.SYSTEM")}</option>
                <option value="LIGHT">{t("theme.LIGHT")}</option>
                <option value="DARK">{t("theme.DARK")}</option>
              </NativeSelect>
            )}
          </Field>
          <Field label={t("settings.language")}>
            {(id) => (
              <NativeSelect id={id} value={user.locale} onChange={(e) => update.mutate({ locale: e.target.value })}>
                <option value="fr">Français</option>
                <option value="en">English</option>
              </NativeSelect>
            )}
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title={t("settings.changePassword")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(passwords, {
              onSuccess: () => {
                setPasswords({ currentPassword: "", newPassword: "" });
                toast.success(t("settings.passwordChanged"));
              },
            });
          }}
        >
          <Field label={t("settings.currentPassword")}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={passwords.currentPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            )}
          </Field>
          <Field label={t("settings.newPassword")} hint={t("auth.passwordHint")}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              />
            )}
          </Field>
          <div>
            <Button type="submit" loading={update.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <div>
        <Button variant="outline" onClick={() => logout.mutate()} loading={logout.isPending}>
          <LogOut /> {t("auth.logout")}
        </Button>
      </div>
    </div>
  );
}
