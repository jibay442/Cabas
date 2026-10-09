import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import type { Theme } from "../../shared/types.ts";
import { api } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useMe } from "../lib/queries.ts";
import { applyTheme, storedTheme } from "../lib/theme.ts";
import { Button } from "./ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";

/** Thème clair / sombre / système ; le choix est mémorisé sur le compte. */
export function ThemeToggle() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const theme = me?.user.theme ?? storedTheme();
  const save = useMutation({
    mutationFn: (next: Theme) => api.patch("/auth/me", { theme: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });

  const choose = (next: Theme) => {
    applyTheme(next);
    if (me) save.mutate(next);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme.label")}>
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => choose(v as Theme)}>
          <DropdownMenuRadioItem value="LIGHT">
            <Sun /> {t("theme.LIGHT")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="DARK">
            <Moon /> {t("theme.DARK")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="SYSTEM">
            <Monitor /> {t("theme.SYSTEM")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
