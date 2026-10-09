import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ACCENT_COLORS } from "../../../shared/defaults.ts";
import type { HouseholdDto } from "../../../shared/types.ts";
import { ColorPicker } from "../../components/Pickers.tsx";
import { Button, Card, Input, PageHeader, Select, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useSession } from "../../lib/queries.ts";
import { applyAccent } from "../../lib/theme.ts";

const CURRENCIES = ["EUR", "CHF", "GBP", "USD", "CAD"];

export function HouseholdSettings() {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { household } = useSession();
  const [form, setForm] = useState({
    name: household.name,
    currency: household.currency,
    accentColor: household.accentColor,
    budget: household.monthlyBudget != null ? String(household.monthlyBudget / 100) : "",
  });

  const save = useMutation({
    mutationFn: () =>
      api.patch<HouseholdDto>("/household", {
        name: form.name,
        currency: form.currency,
        accentColor: form.accentColor,
        monthlyBudget: form.budget.trim() ? Math.round(Number(form.budget.replace(",", ".")) * 100) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast(t("common.saved"));
    },
    onError: (e) => toast(e instanceof ApiError ? e.message : t("common.error"), "error"),
  });

  return (
    <>
      <PageHeader title={t("settings.household")} back="/reglages" />
      <div className="space-y-4">
        <Card>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Input label={t("household.name")} required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t("household.budget")}
                inputMode="decimal"
                placeholder="600"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
              <Select label={t("household.currency")} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <ColorPicker
              label={t("household.accent")}
              choices={ACCENT_COLORS}
              value={form.accentColor}
              onChange={(accentColor) => {
                applyAccent(accentColor);
                setForm({ ...form, accentColor });
              }}
            />
            <Button type="submit" loading={save.isPending}>
              {t("common.save")}
            </Button>
          </form>
        </Card>
        <WebhookCard hint={household.webhookTokenHint} />
      </div>
    </>
  );
}

function WebhookCard({ hint }: { hint: string | null }) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const url = `${window.location.origin}/api/webhooks/receipt`;
  const generate = useMutation({
    mutationFn: () => api.post<{ token: string }>("/household/webhook-token"),
    onSuccess: (data) => {
      setToken(data.token);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast(t("common.copied"));
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">🔗 {t("household.webhookTitle")}</h2>
      <p className="text-sm text-stone-600 dark:text-stone-400">{t("household.webhookHint")}</p>
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="URL" className="font-mono text-sm" />
        <Button variant="secondary" onClick={() => copy(url)} aria-label={t("common.copy")}>
          📋
        </Button>
      </div>
      {token ? (
        <>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⚠️ {t("household.webhookOnce")}</p>
          <div className="flex gap-2">
            <Input readOnly value={token} aria-label="Token" className="font-mono text-sm" />
            <Button variant="secondary" onClick={() => copy(token)} aria-label={t("common.copy")}>
              📋
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm">{hint ? t("household.webhookActive", { hint }) : t("household.webhookNone")}</p>
      )}
      <Button
        variant="secondary"
        loading={generate.isPending}
        onClick={() => (!hint || confirm(t("household.webhookConfirm"))) && generate.mutate()}
      >
        🔑 {hint ? t("household.webhookRegenerate") : t("household.webhookGenerate")}
      </Button>
    </Card>
  );
}
