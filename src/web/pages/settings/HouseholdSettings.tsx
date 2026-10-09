import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ACCENT_COLORS } from "../../../shared/defaults.ts";
import type { HouseholdDto } from "../../../shared/types.ts";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { ColorPicker } from "../../components/Pickers.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { PageHeader } from "../../components/ui/misc.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useSession } from "../../lib/queries.ts";
import { applyAccent } from "../../lib/theme.ts";
import { BackToSettings, SettingsCard } from "./SettingsShared.tsx";

const CURRENCIES = ["EUR", "CHF", "GBP", "USD", "CAD"];

export function HouseholdSettings() {
  const t = useT();
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
      toast.success(t("common.saved"));
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader back={<BackToSettings />} title={t("settings.household")} />
      <SettingsCard>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("household.name")}>
            {(id) => <Input id={id} required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("household.budget")}>
              {(id) => <Input id={id} inputMode="decimal" placeholder="600" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />}
            </Field>
            <Field label={t("household.currency")}>
              {(id) => (
                <NativeSelect id={id} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
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
          <div>
            <Button type="submit" loading={save.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </SettingsCard>
      <WebhookCard hint={household.webhookTokenHint} />
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const t = useT();
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
      <Button
        variant="outline"
        size="icon"
        aria-label={t("common.copy")}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          toast.success(t("common.copied"));
        }}
      >
        <Copy />
      </Button>
    </div>
  );
}

function WebhookCard({ hint }: { hint: string | null }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const generate = useMutation({
    mutationFn: () => api.post<{ token: string }>("/household/webhook-token"),
    onSuccess: (data) => {
      setToken(data.token);
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <SettingsCard title={t("household.webhookTitle")} description={t("household.webhookHint")}>
      <div className="grid gap-3">
        <CopyField value={`${window.location.origin}/api/webhooks/receipt`} label="URL" />
        {token ? (
          <>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t("household.webhookOnce")}</p>
            <CopyField value={token} label="Token" />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">{hint ? t("household.webhookActive", { hint }) : t("household.webhookNone")}</p>
        )}
        <div>
          <Button variant="outline" loading={generate.isPending} onClick={() => (hint ? setConfirming(true) : generate.mutate())}>
            <KeyRound /> {hint ? t("household.webhookRegenerate") : t("household.webhookGenerate")}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("household.webhookRegenerate")}
        description={t("household.webhookConfirm")}
        loading={generate.isPending}
        onConfirm={() => generate.mutate()}
      />
    </SettingsCard>
  );
}
