import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ALLERGENS } from "../../../shared/defaults.ts";
import { ACTIVITY_FACTORS, suggestKcalGoal } from "../../../shared/nutrition.ts";
import type { MemberDto, Sex } from "../../../shared/types.ts";
import { ColorPicker, EmojiPicker } from "../../components/Pickers.tsx";
import { Button, Card, cx, EmptyState, Input, PageHeader, Select, Toggle, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useMembers, useSession } from "../../lib/queries.ts";

export function MemberEditor() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data: members } = useMembers();
  const member = members?.find((m) => m.id === id);
  if (!members) return null;
  if (!member) return <EmptyState emoji="🤷" title={t("common.notFound")} />;
  return <MemberForm key={member.id} member={member} />;
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

function MemberForm({ member }: { member: MemberDto }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isParent, ownMemberId } = useSession();
  const isSelf = member.id === ownMemberId;
  const body = member.body;

  const [form, setForm] = useState({
    displayName: member.displayName,
    emoji: member.emoji,
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
  const onError = (e: Error) => toast(e instanceof ApiError ? e.message : t("common.error"), "error");

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/members/${member.id}`, {
        displayName: form.displayName,
        emoji: form.emoji,
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
      toast(t("common.saved"));
    },
    onError,
  });
  const savePin = useMutation({
    mutationFn: (pin: string | null) => api.patch(`/members/${member.id}`, { pin }),
    onSuccess: async () => {
      set("pin", "");
      await invalidate();
      toast(t("common.saved"));
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

  const toggleAllergen = (tag: string) =>
    set("allergens", form.allergens.includes(tag) ? form.allergens.filter((a) => a !== tag) : [...form.allergens, tag]);

  return (
    <>
      <PageHeader title={isSelf ? t("settings.myProfile") : member.displayName} back={isSelf ? "/reglages" : "/reglages/membres"} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Card className="space-y-4">
          <Input label={t("member.displayName")} required maxLength={40} value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          <EmojiPicker label={t("member.avatar")} value={form.emoji} onChange={(v) => set("emoji", v)} />
          <ColorPicker label={t("member.color")} value={form.color} onChange={(v) => set("color", v)} />
          {isParent && member.role !== "CHILD" && (
            <Select label={t("member.role")} value={form.role} onChange={(e) => set("role", e.target.value as "PARENT" | "MEMBER")}>
              <option value="MEMBER">{t("role.MEMBER")}</option>
              <option value="PARENT">{t("role.PARENT")}</option>
            </Select>
          )}
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">🍽️ {t("member.nutrition")}</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">{t("member.nutritionHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("member.birthDate")} type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            <Select label={t("member.sex")} value={form.sex} onChange={(e) => set("sex", e.target.value as Sex | "")}>
              <option value="">–</option>
              <option value="FEMALE">{t("member.female")}</option>
              <option value="MALE">{t("member.male")}</option>
            </Select>
            <Input label={t("member.height")} inputMode="decimal" value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
            <Input label={t("member.weight")} inputMode="decimal" value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
          </div>
          <Select label={t("member.activity")} value={form.activityFactor} onChange={(e) => set("activityFactor", e.target.value)}>
            {ACTIVITY_FACTORS.map((a) => (
              <option key={a.value} value={a.value}>
                {t(`activity.${a.key}`)}
              </option>
            ))}
          </Select>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input label={t("member.kcalGoal")} inputMode="numeric" value={form.kcalGoal} onChange={(e) => set("kcalGoal", e.target.value)} />
            </div>
            {suggestion && (
              <Button variant="secondary" onClick={() => set("kcalGoal", String(suggestion))}>
                💡 {suggestion.toLocaleString(locale)} kcal
              </Button>
            )}
          </div>
          {suggestion && <p className="text-xs text-stone-500 dark:text-stone-400">{t("member.kcalSuggestionHint")}</p>}
          {isSelf && member.role !== "CHILD" && (
            <Toggle label={t("member.journalPrivate")} description={t("member.journalPrivateHint")} checked={form.journalPrivate} onChange={(v) => set("journalPrivate", v)} />
          )}
        </Card>

        <Card>
          <fieldset>
            <legend className="font-semibold">🚫 {t("member.allergens")}</legend>
            <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{t("member.allergensHint")}</p>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => {
                const on = form.allergens.includes(a.tag);
                return (
                  <button
                    key={a.tag}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleAllergen(a.tag)}
                    className={cx(
                      "rounded-full px-3 py-1.5 text-sm ring-1 transition",
                      on ? "bg-red-50 font-medium text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-800" : "ring-stone-300 dark:ring-stone-700",
                    )}
                  >
                    {a.emoji} {a.name[locale]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Button type="submit" className="w-full" size="lg" loading={save.isPending}>
          {t("common.save")}
        </Button>
      </form>

      {isParent && member.role === "CHILD" && (
        <Card className="mt-4 space-y-3">
          <h2 className="font-semibold">🔒 {t("member.pin")}</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">{member.hasPin ? t("member.pinSet") : t("member.pinNone")}</p>
          <div className="flex gap-2">
            <Input
              aria-label={t("member.pin")}
              inputMode="numeric"
              pattern="\d{4,6}"
              maxLength={6}
              placeholder="1234"
              value={form.pin}
              onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))}
            />
            <Button variant="secondary" disabled={form.pin.length < 4} onClick={() => savePin.mutate(form.pin)}>
              {t("common.save")}
            </Button>
          </div>
          {member.hasPin && (
            <Button variant="ghost" size="sm" onClick={() => savePin.mutate(null)}>
              {t("member.pinRemove")}
            </Button>
          )}
        </Card>
      )}

      {isParent && !isSelf && (
        <Button
          variant="danger"
          className="mt-6 w-full"
          loading={remove.isPending}
          onClick={() => confirm(t("member.removeConfirm", { name: member.displayName })) && remove.mutate()}
        >
          {t("member.remove")}
        </Button>
      )}
    </>
  );
}
