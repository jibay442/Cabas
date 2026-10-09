import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, ChevronRight, Link2, Share2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import type { InvitationDto, Role } from "../../../shared/types.ts";
import { ColorPicker } from "../../components/Pickers.tsx";
import { Avatar } from "../../components/ui/avatar.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Sheet } from "../../components/ui/dialog.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { PageHeader } from "../../components/ui/misc.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useMembers, useSession } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
import { BackToSettings, SettingsCard } from "./SettingsShared.tsx";

export function MembersSettings() {
  const { t } = useI18n();
  const { isParent, ownMemberId } = useSession();
  const { data: members = [] } = useMembers();
  const [sheet, setSheet] = useState<"child" | "adult" | "invite" | null>(null);
  const close = (open: boolean) => !open && setSheet(null);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader
        back={<BackToSettings />}
        title={t("settings.members")}
        actions={
          isParent && (
            <Button size="sm" onClick={() => setSheet("invite")}>
              <Link2 /> {t("member.invite")}
            </Button>
          )
        }
      />

      <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
        {members.map((m) => {
          const editable = isParent || m.id === ownMemberId;
          const content = (
            <>
              <Avatar name={m.displayName} color={m.color} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {m.displayName} {m.id === ownMemberId && <span className="text-muted-foreground font-normal">({t("member.you")})</span>}
                </span>
                <span className="text-muted-foreground block truncate text-xs">{m.email ?? (m.role === "CHILD" ? t("member.noAccount") : "")}</span>
              </span>
              <Badge variant={m.role === "PARENT" ? "default" : "secondary"}>{t(`role.${m.role}`)}</Badge>
              {editable && <ChevronRight className="text-muted-foreground size-4" />}
            </>
          );
          return (
            <li key={m.id}>
              {editable ? (
                <Link to={`/reglages/membres/${m.id}`} className="hover:bg-accent/60 flex items-center gap-3 px-4 py-3 transition-colors">
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {isParent && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSheet("child")}>
            <Baby /> {t("member.addChild")}
          </Button>
          <Button variant="outline" onClick={() => setSheet("adult")}>
            <UserPlus /> {t("member.addAdult")}
          </Button>
        </div>
      )}
      {isParent && <PendingInvitations />}

      <Sheet open={sheet === "child" || sheet === "adult"} onOpenChange={close} title={sheet === "adult" ? t("member.addAdult") : t("member.addChild")}>
        {(sheet === "child" || sheet === "adult") && <NewMemberForm kind={sheet} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === "invite"} onOpenChange={close} title={t("member.invite")} description={t("member.inviteHint")}>
        {sheet === "invite" && <InviteForm />}
      </Sheet>
    </div>
  );
}

function NewMemberForm({ kind, onDone }: { kind: "child" | "adult"; onDone: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ displayName: "", color: "#0ea5e9", pin: "", email: "", password: "", role: "MEMBER" as Exclude<Role, "CHILD"> });
  const create = useMutation({
    mutationFn: () =>
      api.post(
        "/members",
        kind === "child"
          ? { kind, displayName: form.displayName, color: form.color, pin: form.pin || undefined }
          : { kind, displayName: form.displayName, color: form.color, email: form.email, password: form.password, role: form.role },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success(t("member.added", { name: form.displayName }));
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Field label={t("member.displayName")}>
        {(id) => <Input id={id} required maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}
      </Field>
      <ColorPicker label={t("member.color")} value={form.color} onChange={(color) => setForm({ ...form, color })} />
      {kind === "child" ? (
        <Field label={t("member.pinOptional")} hint={t("member.pinHint")}>
          {(id) => (
            <Input
              id={id}
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
            />
          )}
        </Field>
      ) : (
        <>
          <Field label={t("auth.email")}>
            {(id) => <Input id={id} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
          </Field>
          <Field label={t("member.initialPassword")} hint={t("auth.passwordHint")}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            )}
          </Field>
          <Field label={t("member.role")}>
            {(id) => (
              <NativeSelect id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "PARENT" | "MEMBER" })}>
                <option value="MEMBER">{t("role.MEMBER")}</option>
                <option value="PARENT">{t("role.PARENT")}</option>
              </NativeSelect>
            )}
          </Field>
        </>
      )}
      <Button type="submit" className="w-full" loading={create.isPending}>
        {t("common.add")}
      </Button>
    </form>
  );
}

function InviteForm() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<"MEMBER" | "PARENT">("MEMBER");
  const [url, setUrl] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ url: string }>("/household/invitations", { role }),
    onSuccess: (data) => {
      setUrl(data.url);
      void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
  });

  const share = async () => {
    if (!url) return;
    if (navigator.share) await navigator.share({ title: t("member.invite"), url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success(t("common.copied"));
    }
  };

  return url ? (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">{t("member.inviteReady")}</p>
      <Input readOnly value={url} aria-label="URL" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button onClick={share}>
        <Share2 /> {t("common.share")}
      </Button>
    </div>
  ) : (
    <div className="grid gap-4">
      <Field label={t("member.role")}>
        {(id) => (
          <NativeSelect id={id} value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "PARENT")}>
            <option value="MEMBER">{t("role.MEMBER")}</option>
            <option value="PARENT">{t("role.PARENT")}</option>
          </NativeSelect>
        )}
      </Field>
      <Button loading={create.isPending} onClick={() => create.mutate()}>
        {t("member.createLink")}
      </Button>
    </div>
  );
}

function PendingInvitations() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["invitations"], queryFn: () => api.get<InvitationDto[]>("/household/invitations") });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/household/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
  if (!data.length) return null;
  return (
    <SettingsCard title={t("member.pendingInvites")} className="py-4">
      <ul className={cn("divide-y text-sm")}>
        {data.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              {t(`role.${i.role}`)} <span className="text-muted-foreground">· {t("member.expires", { date: new Date(i.expiresAt).toLocaleDateString(locale) })}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
              <X /> {t("common.revoke")}
            </Button>
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}
