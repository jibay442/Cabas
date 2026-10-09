import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { ALLERGENS } from "../../../shared/defaults.ts";
import { ACTIVITY_FACTORS, suggestKcalGoal } from "../../../shared/nutrition.ts";
import type { MemberDto, Sex } from "../../../shared/types.ts";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { ColorPicker } from "../../components/Pickers.tsx";
import { Avatar } from "../../components/ui/avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { EmptyState, PageHeader } from "../../components/ui/misc.tsx";
import { SwitchRow } from "../../components/ui/switch.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useMembers, useSession } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
import { BackToSettings, SettingsCard } from "./SettingsShared.tsx";

export function MemberEditor() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data: members } = useMembers();
  const member = members?.find((m) => m.id === id);
  if (!members) return null;
  if (!member) return <EmptyState icon={<Trash2 />} title={t("common.notFound")} />;
  return <MemberForm key={member.id} member={member} />;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function MemberForm({ member }: { member: MemberDto }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isParent, ownMemberId } = useSession();
  const isSelf = member.id === ownMemberId;
  const body = member.body;
  const [removing, setRemoving] = useState(false);

  const [form, setForm] = useState({
    displayName: member.displayName,
    color: member.color,
    role: member.role,
    birthDate: body?.birthDate ?? "",
    sex: (body?.sex ?? "") as Sex | "",
    heightCm: str(body?.heightCm),
    weightKg: str(body?.weightKg),
    activityFactor: str(body?.activityFactor ?? 1.375),
    kcalGoal: str(member.kcalGoal),
    allergens: member.allergens,
    journalPrivate: member.journalPrivate,
    pin: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const suggestion = suggestKcalGoal({
    birthDate: form.birthDate || null,
    sex: form.sex || null,
    heightCm: num(form.heightCm),
    weightKg: num(form.weightKg),
    activityFactor: num(form.activityFactor),
  });

  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: ["members"] }), queryClient.invalidateQueries({ queryKey: ["me"] })]);
  const onError = (e: Error) => toast.error(errorMessage(e, t("common.error")));

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/members/${member.id}`, {
        displayName: form.displayName,
        color: form.color,
        role: isParent && member.role !== "CHILD" && form.role !== member.role ? form.role : undefined,
        birthDate: form.birthDate || null,
        sex: form.sex || null,
        heightCm: num(form.heightCm),
        weightKg: num(form.weightKg),
        activityFactor: num(form.activityFactor),
        kcalGoal: num(form.kcalGoal),
        allergens: form.allergens,
        journalPrivate: isSelf && member.role !== "CHILD" ? form.journalPrivate : undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(t("common.saved"));
    },
    onError,
  });
  const savePin = useMutation({
    mutationFn: (pin: string | null) => api.patch(`/members/${member.id}`, { pin }),
    onSuccess: async () => {
      set("pin", "");
      await invalidate();
      toast.success(t("common.saved"));
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/members/${member.id}`),
    onSuccess: async () => {
      await invalidate();
      navigate("/reglages/membres");
    },
    onError,
  });

  const toggleAllergen = (tag: string) => set("allergens", form.allergens.includes(tag) ? form.allergens.filter((a) => a !== tag) : [...form.allergens, tag]);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader
        back={<BackToSettings to={isSelf ? "/reglages" : "/reglages/membres"} label={isSelf ? undefined : t("settings.members")} />}
        title={
          <span className="flex items-center gap-3">
            <Avatar size="md" name={form.displayName || member.displayName} color={form.color} />
            {isSelf ? t("settings.myProfile") : member.displayName}
          </span>
        }
      />
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <SettingsCard title={t("member.identity")}>
          <div className="grid gap-4">
            <Field label={t("member.displayName")}>
              {(id) => <Input id={id} required maxLength={40} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />}
            </Field>
            <ColorPicker label={t("member.color")} value={form.color} onChange={(v) => set("color", v)} />
            {isParent && member.role !== "CHILD" && (
              <Field label={t("member.role")}>
                {(id) => (
                  <NativeSelect id={id} value={form.role} onChange={(e) => set("role", e.target.value as "PARENT" | "MEMBER")}>
                    <option value="MEMBER">{t("role.MEMBER")}</option>
                    <option value="PARENT">{t("role.PARENT")}</option>
                  </NativeSelect>
                )}
              </Field>
            )}
          </div>
        </SettingsCard>

        <SettingsCard title={t("member.nutrition")} description={t("member.nutritionHint")}>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("member.birthDate")}>{(id) => <Input id={id} type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />}</Field>
              <Field label={t("member.sex")}>
                {(id) => (
                  <NativeSelect id={id} value={form.sex} onChange={(e) => set("sex", e.target.value as Sex | "")}>
                    <option value="">–</option>
                    <option value="FEMALE">{t("member.female")}</option>
                    <option value="MALE">{t("member.male")}</option>
                  </NativeSelect>
                )}
              </Field>
              <Field label={t("member.height")}>{(id) => <Input id={id} inputMode="decimal" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />}</Field>
              <Field label={t("member.weight")}>{(id) => <Input id={id} inputMode="decimal" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />}</Field>
            </div>
            <Field label={t("member.activity")}>
              {(id) => (
                <NativeSelect id={id} value={form.activityFactor} onChange={(e) => set("activityFactor", e.target.value)}>
                  {ACTIVITY_FACTORS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {t(`activity.${a.key}`)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label={t("member.kcalGoal")} hint={suggestion ? t("member.kcalSuggestionHint") : undefined}>
              {(id) => (
                <div className="flex gap-2">
                  <Input id={id} inputMode="numeric" value={form.kcalGoal} onChange={(e) => set("kcalGoal", e.target.value)} />
                  {suggestion && (
                    <Button variant="outline" onClick={() => set("kcalGoal", String(suggestion))}>
                      <Lightbulb /> {suggestion.toLocaleString(locale)} kcal
                    </Button>
                  )}
                </div>
              )}
            </Field>
            {isSelf && member.role !== "CHILD" && (
              <SwitchRow
                label={t("member.journalPrivate")}
                description={t("member.journalPrivateHint")}
                checked={form.journalPrivate}
                onCheckedChange={(v) => set("journalPrivate", v)}
              />
            )}
          </div>
        </SettingsCard>

        <SettingsCard title={t("member.allergens")} description={t("member.allergensHint")}>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGENS.map((a) => {
              const on = form.allergens.includes(a.tag);
              return (
                <button
                  key={a.tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAllergen(a.tag)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    on ? "border-destructive/40 bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {a.name[locale]}
                </button>
              );
            })}
          </div>
        </SettingsCard>

        <div>
          <Button type="submit" loading={save.isPending}>
            {t("common.save")}
          </Button>
        </div>
      </form>

      {isParent && member.role === "CHILD" && (
        <SettingsCard title={t("member.pin")} description={member.hasPin ? t("member.pinSet") : t("member.pinNone")}>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label={t("member.pin")}
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              placeholder="1234"
              className="w-32"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))}
            />
            <Button variant="outline" disabled={form.pin.length < 4} onClick={() => savePin.mutate(form.pin)}>
              {t("common.save")}
            </Button>
            {member.hasPin && (
              <Button variant="ghost" onClick={() => savePin.mutate(null)}>
                {t("member.pinRemove")}
              </Button>
            )}
          </div>
        </SettingsCard>
      )}

      {isParent && !isSelf && (
        <div>
          <Button variant="outline" className="text-destructive" onClick={() => setRemoving(true)}>
            <Trash2 /> {t("member.remove")}
          </Button>
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={t("member.remove")}
            description={t("member.removeConfirm", { name: member.displayName })}
            confirmLabel={t("member.remove")}
            destructive
            loading={remove.isPending}
            onConfirm={() => remove.mutate()}
          />
        </div>
      )}
    </div>
  );
}
