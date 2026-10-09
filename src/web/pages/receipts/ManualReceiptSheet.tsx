import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { ReceiptSummaryDto } from "../../../shared/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { Sheet } from "../../components/ui/dialog.tsx";
import { Input, NativeSelect, Textarea } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { api, errorMessage, parseMoney } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useStores } from "../../lib/queries.ts";

/** « Lait demi-écrémé 2,10 » / « Remise ; -0,50 » → ligne de ticket (le montant est en fin de ligne) */
function parseManualLines(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim().match(/^(.*?)[\s;:]+(-?\d+(?:[.,]\d{1,2})?)\s*€?$/))
    .filter((m): m is RegExpMatchArray => !!m && !!m[1]?.trim())
    .map((m) => ({ label: m[1]!.trim(), totalCents: Math.round(Number(m[2]!.replace(",", ".")) * 100) }));
}

const today = () => new Date().toISOString().slice(0, 10);

export function ManualReceiptSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const [form, setForm] = useState({ storeId: "", date: today(), total: "", lines: "" });
  const lines = parseManualLines(form.lines);
  const linesTotal = lines.reduce((sum, l) => sum + l.totalCents, 0);

  const create = useMutation({
    mutationFn: () =>
      api.post<ReceiptSummaryDto>("/receipts", {
        storeId: form.storeId || null,
        purchasedAt: form.date,
        totalCents: parseMoney(form.total) ?? linesTotal,
        lines,
      }),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      onOpenChange(false);
      setForm({ storeId: "", date: today(), total: "", lines: "" });
      navigate(`/tickets/${receipt.id}`);
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("receipts.manualTitle")} description={t("receipts.manualHint")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Field label={t("receipts.store")}>
          {(id) => (
            <NativeSelect id={id} value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
              <option value="">{t("receipts.unknownStore")}</option>
              {stores
                .filter((s) => !s.archived)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.city ? ` · ${s.city}` : ""}
                  </option>
                ))}
            </NativeSelect>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("receipts.date")}>{(id) => <Input id={id} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label={t("receipts.total")}>
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                placeholder={linesTotal ? (linesTotal / 100).toFixed(2).replace(".", ",") : "0,00"}
                required={!lines.length}
                value={form.total}
                onChange={(e) => setForm({ ...form, total: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label={t("receipts.manualLines")} hint={t("receipts.manualLinesHint", { count: lines.length })}>
          {(id) => (
            <Textarea
              id={id}
              rows={6}
              placeholder={"Lait demi-écrémé 2,10\nBaguette 1,10\nRemise -0,50"}
              value={form.lines}
              onChange={(e) => setForm({ ...form, lines: e.target.value })}
            />
          )}
        </Field>
        <Button type="submit" loading={create.isPending}>
          {t("receipts.create")}
        </Button>
      </form>
    </Sheet>
  );
}
