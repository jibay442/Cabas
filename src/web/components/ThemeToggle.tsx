import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Theme } from "../../shared/types.ts";
import { api } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useMe } from "../lib/queries.ts";
import { applyTheme, storedTheme } from "../lib/theme.ts";

const NEXT: Record<Theme, Theme> = { SYSTEM: "LIGHT", LIGHT: "DARK", DARK: "SYSTEM" };
const ICON: Record<Theme, string> = { SYSTEM: "🌗", LIGHT: "☀️", DARK: "🌙" };

/** Bascule système → clair → sombre ; le choix est mémorisé sur le compte. */
export function ThemeToggle() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const theme = me?.user.theme ?? storedTheme();
  const save = useMutation({
    mutationFn: (next: Theme) => api.patch("/auth/me", { theme: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const next = NEXT[theme];
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        if (me) save.mutate(next);
      }}
      className="rounded-full p-2 text-xl hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-accent dark:hover:bg-stone-800"
      aria-label={t("theme.toggle", { current: t(`theme.${theme}`), next: t(`theme.${next}`) })}
      title={t(`theme.${theme}`)}
    >
      <span aria-hidden>{ICON[theme]}</span>
    </button>
  );
}
