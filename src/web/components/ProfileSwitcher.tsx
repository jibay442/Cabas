import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { MemberDto } from "../../shared/types.ts";
import { api, ApiError } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useMembers, useSession } from "../lib/queries.ts";
import { Avatar, Button, cx, Input, Sheet } from "./ui.tsx";

/**
 * Changement de profil sur l'appareil connecté (tablette familiale, téléphone d'un parent) :
 * on passe sur un profil enfant (PIN s'il en a un) et on revient à son profil avec son mot de passe.
 */
export function ProfileSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { member: active, ownMemberId } = useSession();
  const { data: members = [] } = useMembers();
  const [target, setTarget] = useState<MemberDto | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = members.filter((m) => m.id === ownMemberId || m.role === "CHILD");
  const switchTo = useMutation({
    mutationFn: (body: { memberId: string; pin?: string; password?: string }) => api.post("/auth/switch-profile", body),
    onSuccess: async () => {
      close();
      await queryClient.invalidateQueries();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t("common.error")),
  });
  const logout = useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  function close() {
    setTarget(null);
    setSecret("");
    setError(null);
    onClose();
  }

  function needsSecret(m: MemberDto) {
    if (m.id === ownMemberId) return active.id !== ownMemberId; // retour au profil adulte
    return m.hasPin;
  }

  function pick(m: MemberDto) {
    if (m.id === active.id) return close();
    setError(null);
    setSecret("");
    if (needsSecret(m)) setTarget(m);
    else switchTo.mutate({ memberId: m.id });
  }

  const isOwn = target?.id === ownMemberId;

  return (
    <Sheet open={open} onClose={close} title={t("profile.switchTitle")}>
      {!target ? (
        <>
          <ul className="grid grid-cols-3 gap-3">
            {candidates.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => pick(m)}
                  className={cx(
                    "flex w-full flex-col items-center gap-1.5 rounded-2xl p-3 transition hover:bg-stone-100 dark:hover:bg-stone-800",
                    m.id === active.id && "bg-accent/10 ring-2 ring-accent",
                  )}
                >
                  <Avatar emoji={m.emoji} color={m.color} size="lg" />
                  <span className="text-sm font-medium">{m.displayName}</span>
                  {m.hasPin && m.id !== ownMemberId && <span className="text-xs text-stone-500">🔒 PIN</span>}
                </button>
              </li>
            ))}
          </ul>
          {candidates.length < 2 && <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">{t("profile.noChildren")}</p>}
          {active.id === ownMemberId && (
            <Button variant="ghost" className="mt-4 w-full" onClick={() => logout.mutate()} loading={logout.isPending}>
              🚪 {t("auth.logout")}
            </Button>
          )}
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            switchTo.mutate(isOwn ? { memberId: target.id, password: secret } : { memberId: target.id, pin: secret });
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Avatar emoji={target.emoji} color={target.color} size="lg" />
            <span className="font-medium">{target.displayName}</span>
          </div>
          <Input
            label={isOwn ? t("auth.password") : t("profile.pin")}
            type="password"
            inputMode={isOwn ? undefined : "numeric"}
            autoComplete={isOwn ? "current-password" : "off"}
            pattern={isOwn ? undefined : "\\d{4,6}"}
            autoFocus
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setTarget(null)}>
              {t("common.back")}
            </Button>
            <Button type="submit" className="flex-1" loading={switchTo.isPending}>
              {t("common.ok")}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
