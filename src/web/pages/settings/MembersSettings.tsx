import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import type { InvitationDto, Role } from "../../../shared/types.ts";
import { ColorPicker, EmojiPicker } from "../../components/Pickers.tsx";
import { Avatar, Badge, Button, Card, Input, PageHeader, Select, Sheet, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useMembers, useSession } from "../../lib/queries.ts";

function MaybeLink({ to, className, children }: { to: string | null; className: string; children: ReactNode }) {
  return to ? (
    <Link to={to} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

export function MembersSettings() {
  const { t, locale } = useI18n();
  const { isParent, ownMemberId } = useSession();
  const { data: members = [] } = useMembers();
  const [sheet, setSheet] = useState<"child" | "adult" | "invite" | null>(null);

  return (
    <>
      <PageHeader title={t("settings.members")} back="/reglages" />
      <ul className="space-y-2">
        {members.map((m) => (
          <li key={m.id}>
            <MaybeLink
              to={isParent || m.id === ownMemberId ? `/reglages/membres/${m.id}` : null}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70 dark:bg-stone-900 dark:ring-stone-800"
            >
              <Avatar emoji={m.emoji} color={m.color} />
              <span className="flex-1">
                <span className="block font-medium">
                  {m.displayName} {m.id === ownMemberId && <span className="text-stone-500">({t("member.you")})</span>}
                </span>
                <span className="block text-sm text-stone-500 dark:text-stone-400">{m.email ?? (m.role === "CHILD" ? t("member.noAccount") : "")}</span>
              </span>
              <Badge tone={m.role === "PARENT" ? "accent" : "neutral"}>{t(`role.${m.role}`)}</Badge>
            </MaybeLink>
          </li>
        ))}
      </ul>

      {isParent && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="secondary" onClick={() => setSheet("child")}>
              🧒 {t("member.addChild")}
            </Button>
            <Button variant="secondary" onClick={() => setSheet("adult")}>
              🧑 {t("member.addAdult")}
            </Button>
            <Button variant="secondary" onClick={() => setSheet("invite")}>
              🔗 {t("member.invite")}
            </Button>
          </div>
          <PendingInvitations locale={locale} />
        </>
      )}

      <Sheet open={sheet === "child" || sheet === "adult"} onClose={() => setSheet(null)} title={sheet === "child" ? t("member.addChild") : t("member.addAdult")}>
        {(sheet === "child" || sheet === "adult") && <NewMemberForm kind={sheet} onDone={() => setSheet(null)} />}
      </Sheet>
      <Sheet open={sheet === "invite"} onClose={() => setSheet(null)} title={t("member.invite")}>
        {sheet === "invite" && <InviteForm />}
      </Sheet>
    </>
  );
}

function NewMemberForm({ kind, onDone }: { kind: "child" | "adult"; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    displayName: "",
    emoji: kind === "child" ? "🧒" : "😀",
    color: "#0ea5e9",
    pin: "",
    email: "",
    password: "",
    role: "MEMBER" as Exclude<Role, "CHILD">,
  });
  const create = useMutation({
    mutationFn: () =>
      api.post(
        "/members",
        kind === "child"
          ? { kind, displayName: form.displayName, emoji: form.emoji, color: form.color, pin: form.pin || undefined }
          : { kind, displayName: form.displayName, emoji: form.emoji, color: form.color, email: form.email, password: form.password, role: form.role },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      onDone();
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t("common.error"), "error"),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <Input label={t("member.displayName")} required maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      <EmojiPicker label={t("member.avatar")} value={form.emoji} onChange={(emoji) => setForm({ ...form, emoji })} />
      <ColorPicker label={t("member.color")} value={form.color} onChange={(color) => setForm({ ...form, color })} />
      {kind === "child" ? (
        <Input
          label={t("member.pinOptional")}
          hint={t("member.pinHint")}
          inputMode="numeric"
          pattern="\d{4,6}"
          maxLength={6}
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
        />
      ) : (
        <>
          <Input label={t("auth.email")} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            label={t("member.initialPassword")}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select label={t("member.role")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "PARENT" | "MEMBER" })}>
            <option value="MEMBER">{t("role.MEMBER")}</option>
            <option value="PARENT">{t("role.PARENT")}</option>
          </Select>
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
  const toast = useToast();
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
      toast(t("common.copied"));
    }
  };

  return url ? (
    <div className="space-y-3">
      <p className="text-sm text-stone-600 dark:text-stone-400">{t("member.inviteReady")}</p>
      <Input readOnly value={url} aria-label="URL" className="font-mono text-sm" onFocus={(e) => e.target.select()} />
      <Button className="w-full" onClick={share}>
        📤 {t("common.share")}
      </Button>
    </div>
  ) : (
    <div className="space-y-4">
      <p className="text-sm text-stone-600 dark:text-stone-400">{t("member.inviteHint")}</p>
      <Select label={t("member.role")} value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "PARENT")}>
        <option value="MEMBER">{t("role.MEMBER")}</option>
        <option value="PARENT">{t("role.PARENT")}</option>
      </Select>
      <Button className="w-full" loading={create.isPending} onClick={() => create.mutate()}>
        {t("member.createLink")}
      </Button>
    </div>
  );
}

function PendingInvitations({ locale }: { locale: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["invitations"], queryFn: () => api.get<InvitationDto[]>("/household/invitations") });
  const revoke = useMutation({
    mutationFn: (id: string) => api.del(`/household/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
  if (!data.length) return null;
  return (
    <Card className="mt-4">
      <h2 className="mb-2 font-semibold">{t("member.pendingInvites")}</h2>
      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {data.map((i) => (
          <li key={i.id} className="flex items-center justify-between py-2 text-sm">
            <span>
              {t(`role.${i.role}`)} · {t("member.expires", { date: new Date(i.expiresAt).toLocaleDateString(locale) })}
            </span>
            <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
              {t("common.revoke")}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
