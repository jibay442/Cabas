import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Lock } from "lucide-react";
import { useState } from "react";
import type { MemberDto } from "../../shared/types.ts";
import { api, errorMessage } from "../lib/api.ts";
import { useT } from "../lib/i18n.tsx";
import { useMembers, useSession } from "../lib/queries.ts";
import { cn } from "../lib/utils.ts";
import { Avatar } from "./ui/avatar.tsx";
import { Button } from "./ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

/**
 * Changement de profil sur l'appareil connecté (tablette familiale, téléphone d'un parent) :
 * on passe sur un profil enfant (PIN s'il en a un) et on revient à son profil avec son mot de passe.
 */
export function ProfileSwitcher({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { member: active, ownMemberId } = useSession();
  const { data: members = [] } = useMembers();
  const [target, setTarget] = useState<MemberDto | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const candidates = members.filter((m) => m.id === ownMemberId || m.role === "CHILD");
  const isOwn = target?.id === ownMemberId;

  function close() {
    setTarget(null);
    setSecret("");
    setError(null);
    onOpenChange(false);
  }

  const switchTo = useMutation({
    mutationFn: (body: { memberId: string; pin?: string; password?: string }) => api.post("/auth/switch-profile", body),
    onSuccess: async () => {
      close();
      await queryClient.invalidateQueries();
    },
    onError: (e) => setError(errorMessage(e, t("common.error"))),
  });

  function pick(m: MemberDto) {
    if (m.id === active.id) return close();
    setError(null);
    setSecret("");
    const needsSecret = m.id === ownMemberId ? active.id !== ownMemberId : m.hasPin;
    if (needsSecret) setTarget(m);
    else switchTo.mutate({ memberId: m.id });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("profile.switchTitle")}</DialogTitle>
          <DialogDescription>{t("profile.switchHint")}</DialogDescription>
        </DialogHeader>

        {!target ? (
          <>
            <ul className="grid gap-1">
              {candidates.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pick(m)}
                    className={cn(
                      "hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      m.id === active.id && "bg-accent font-medium",
                    )}
                  >
                    <Avatar name={m.displayName} color={m.color} />
                    <span className="flex-1">{m.displayName}</span>
                    {m.hasPin && m.id !== ownMemberId && <Lock className="text-muted-foreground size-4" aria-label="PIN" />}
                    {m.id === active.id && <span className="text-muted-foreground text-xs">{t("profile.current")}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {candidates.length < 2 && <p className="text-muted-foreground text-sm">{t("profile.noChildren")}</p>}
          </>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              switchTo.mutate(isOwn ? { memberId: target.id, password: secret } : { memberId: target.id, pin: secret });
            }}
          >
            <div className="flex items-center gap-3">
              <Avatar size="lg" name={target.displayName} color={target.color} />
              <span className="font-medium">{target.displayName}</span>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="switch-secret">{isOwn ? t("auth.password") : t("profile.pin")}</Label>
              <Input
                id="switch-secret"
                type="password"
                inputMode={isOwn ? undefined : "numeric"}
                autoComplete={isOwn ? "current-password" : "off"}
                autoFocus
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                aria-invalid={!!error}
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTarget(null)}>
                <ArrowLeft /> {t("common.back")}
              </Button>
              <Button type="submit" className="flex-1" loading={switchTo.isPending}>
                {t("common.ok")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
