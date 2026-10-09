import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCheck, ExternalLink, MoreHorizontal, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { ReceiptDetailDto, ReceiptLineDto } from "../../../shared/types.ts";
import { ChainLogo } from "../../components/ChainLogo.tsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { EmptyState, Spinner } from "../../components/ui/misc.tsx";
import { api, centsToInput, errorMessage, parseSignedMoney } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useLists, useReceipt, useStores } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
import { useMoney } from "../list/format.ts";
import { ProductPicker } from "./ProductPicker.tsx";
import { formatDateTime, SourceIcon, StatusBadge, toLocalInput } from "./shared.tsx";

type EditLine = Omit<ReceiptLineDto, "id" | "position" | "ean"> & { id?: string; key: string };

const toEdit = (l: ReceiptLineDto): EditLine => ({ ...l, key: l.id });

export function ReceiptDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const { data: receipt, isPending, isError } = useReceipt(id);
  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError || !receipt) return <EmptyState icon={<X />} title={t("common.notFound")} />;
  return <ReceiptEditor key={receipt.id} receipt={receipt} />;
}

/** Montant éditable : texte libre (« 1,05 », « -0,50 »), converti en centimes à la sortie du champ */
function MoneyInput({ cents, onChange, ...props }: { cents: number | null; onChange: (cents: number | null) => void } & Omit<React.ComponentProps<"input">, "onChange">) {
  const [text, setText] = useState(centsToInput(cents));
  useEffect(() => setText(centsToInput(cents)), [cents]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const value = text.trim() ? parseSignedMoney(text) : null;
        if (text.trim() && value === null) setText(centsToInput(cents));
        else onChange(value);
      }}
      {...props}
    />
  );
}

/** Petit libellé au-dessus d'un champ, sur mobile uniquement (sur grand écran, l'en-tête du tableau suffit) */
function MobileCaption({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <span aria-hidden className="text-muted-foreground text-[11px] md:hidden">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Quantité éditable (« 0,756 » pour une pesée) */
function QuantityInput({ value, onChange, ...props }: { value: number; onChange: (value: number) => void } & Omit<React.ComponentProps<"input">, "onChange" | "value">) {
  const format = (n: number) => String(n).replace(".", ",");
  const [text, setText] = useState(format(value));
  useEffect(() => setText(format(value)), [value]);
  return (
    <Input
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const quantity = Number(text.replace(",", "."));
        if (quantity > 0) onChange(quantity);
        else setText(format(value));
      }}
      {...props}
    />
  );
}

function ReceiptEditor({ receipt }: { receipt: ReceiptDetailDto }) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const { data: activeLists = [] } = useLists("active");
  const { data: archivedLists = [] } = useLists("archived");
  const [draft, setDraft] = useState<EditLine[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const lines = draft ?? receipt.lines.map(toEdit);
  const dirty = draft !== null;

  const linesTotal = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const gap = linesTotal - receipt.totalCents;
  const setCache = (data: ReceiptDetailDto) => {
    queryClient.setQueryData(["receipt", receipt.id], data);
    void queryClient.invalidateQueries({ queryKey: ["receipts"] });
  };
  const onError = (e: Error) => toast.error(errorMessage(e, t("common.error")));

  const update = (key: string, patch: Partial<EditLine>) => setDraft(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const remove = (key: string) => setDraft(lines.filter((l) => l.key !== key));
  const addLine = () =>
    setDraft([
      ...lines,
      { key: crypto.randomUUID(), rawLabel: "", label: "", quantity: 1, unitPriceCents: null, totalCents: 0, isDiscount: false, productId: null, productName: null, categoryId: null },
    ]);

  const linesPayload = () => ({
    lines: lines
      .filter((l) => l.label.trim())
      .map((l) => ({
        id: l.id,
        label: l.label.trim(),
        rawLabel: l.rawLabel || l.label.trim(),
        quantity: l.quantity > 0 ? l.quantity : 1,
        unitPriceCents: l.unitPriceCents,
        totalCents: l.totalCents,
        productId: l.isDiscount ? null : l.productId,
        categoryId: l.categoryId,
        isDiscount: l.isDiscount || l.totalCents < 0,
      })),
  });

  const saveLines = useMutation({
    mutationFn: () => api.put<ReceiptDetailDto>(`/receipts/${receipt.id}/lines`, linesPayload()),
    onSuccess: (data) => {
      setCache(data);
      setDraft(null);
      toast.success(t("common.saved"));
    },
    onError,
  });
  const validate = useMutation({
    mutationFn: async () => {
      if (dirty) await api.put(`/receipts/${receipt.id}/lines`, linesPayload());
      return api.post<ReceiptDetailDto>(`/receipts/${receipt.id}/validate`);
    },
    onSuccess: (data) => {
      setCache(data);
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("receipts.validated"));
    },
    onError,
  });
  const patch = useMutation({
    mutationFn: (body: object) => api.patch<ReceiptDetailDto>(`/receipts/${receipt.id}`, body),
    onSuccess: setCache,
    onError,
  });
  const reparse = useMutation({
    mutationFn: () => api.post<ReceiptDetailDto>(`/receipts/${receipt.id}/reparse`),
    onSuccess: (data) => {
      setCache(data);
      setDraft(null);
    },
    onError,
  });
  const destroy = useMutation({
    mutationFn: () => api.del(`/receipts/${receipt.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      navigate("/tickets");
    },
    onError,
  });

  const lists = [...activeLists, ...archivedLists];

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div>
        <Link to="/tickets" className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> {t("nav.receipts")}
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <ChainLogo chain={receipt.chain} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{receipt.storeName ?? t("receipts.unknownStore")}</h1>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <StatusBadge status={receipt.status} />
              <span className="flex items-center gap-1">
                <SourceIcon source={receipt.source} /> {t(`receipts.source.${receipt.source}`)}
              </span>
              <span aria-hidden>·</span>
              <span>{formatDateTime(receipt.purchasedAt, locale)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {receipt.hasFile && (
              <Button variant="outline" asChild>
                <a href={`/api/receipts/${receipt.id}/file`} target="_blank" rel="noreferrer">
                  <ExternalLink /> <span className="hidden sm:inline">{t("receipts.viewFile")}</span>
                </a>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label={t("list.menu")}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {receipt.rawText && (
                  <DropdownMenuItem onSelect={() => reparse.mutate()}>
                    <RefreshCw /> {t("receipts.reparse")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleting(true)}>
                  <Trash2 className="text-destructive" /> {t("receipts.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Informations du ticket */}
      <section className="bg-card grid gap-4 rounded-xl border p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("receipts.store")}>
          {(fieldId) => (
            <NativeSelect id={fieldId} value={receipt.storeId ?? ""} onChange={(e) => patch.mutate({ storeId: e.target.value || null })}>
              <option value="">{t("receipts.unknownStore")}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` · ${s.city}` : ""}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label={t("receipts.date")}>
          {(fieldId) => (
            <Input
              id={fieldId}
              type="datetime-local"
              defaultValue={toLocalInput(receipt.purchasedAt)}
              onBlur={(e) => e.target.value && patch.mutate({ purchasedAt: new Date(e.target.value).toISOString() })}
            />
          )}
        </Field>
        <Field label={t("receipts.total")}>
          {(fieldId) => <MoneyInput id={fieldId} cents={receipt.totalCents} onChange={(c) => c !== null && c !== receipt.totalCents && patch.mutate({ totalCents: c })} />}
        </Field>
        <Field label={t("receipts.list")}>
          {(fieldId) => (
            <NativeSelect id={fieldId} value={receipt.listId ?? ""} onChange={(e) => patch.mutate({ listId: e.target.value || null })}>
              <option value="">{t("receipts.noList")}</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </section>

      {receipt.status === "FAILED" && (
        <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {t("receipts.failedHint")}
        </p>
      )}

      {/* Lignes du ticket */}
      <section className="bg-card overflow-hidden rounded-xl border shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">{t("receipts.linesTitle")}</h2>
            <p className="text-muted-foreground text-xs">{t("receipts.linesHint")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus /> {t("receipts.addLine")}
          </Button>
        </header>

        <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_4.5rem_6rem_6rem_2.25rem] gap-2 border-b px-4 py-2 text-xs font-medium md:grid">
          <span>{t("receipts.colLabel")}</span>
          <span>{t("receipts.colProduct")}</span>
          <span>{t("receipts.colQty")}</span>
          <span>{t("receipts.colUnit")}</span>
          <span>{t("receipts.colTotal")}</span>
          <span />
        </div>

        <ul className="divide-y">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid grid-cols-[1fr_1fr_1fr_2.25rem] items-center gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_4.5rem_6rem_6rem_2.25rem] md:py-2"
            >
              <div className="col-span-4 min-w-0 md:col-span-1">
                <Input aria-label={t("receipts.colLabel")} value={line.label} placeholder={t("receipts.colLabel")} onChange={(e) => update(line.key, { label: e.target.value })} />
                {line.rawLabel && line.rawLabel !== line.label && <p className="text-muted-foreground mt-1 truncate font-mono text-[11px]">{line.rawLabel}</p>}
              </div>
              <div className="col-span-4 min-w-0 md:col-span-1">
                {line.isDiscount || line.totalCents < 0 ? (
                  <Badge variant="secondary">{t("receipts.discount")}</Badge>
                ) : (
                  <ProductPicker label={line.label || line.rawLabel} value={{ productId: line.productId, productName: line.productName }} onChange={(choice) => update(line.key, choice)} />
                )}
              </div>
              <MobileCaption label={t("receipts.colQty")}>
                <QuantityInput aria-label={t("receipts.colQty")} value={line.quantity} onChange={(quantity) => quantity !== line.quantity && update(line.key, { quantity })} />
              </MobileCaption>
              <MobileCaption label={t("receipts.colUnit")}>
                <MoneyInput aria-label={t("receipts.colUnit")} placeholder="–" cents={line.unitPriceCents} onChange={(c) => c !== line.unitPriceCents && update(line.key, { unitPriceCents: c })} />
              </MobileCaption>
              <MobileCaption label={t("receipts.colTotal")}>
                <MoneyInput
                  aria-label={t("receipts.colTotal")}
                  cents={line.totalCents}
                  className="font-medium"
                  onChange={(c) => c !== null && c !== line.totalCents && update(line.key, { totalCents: c, isDiscount: c < 0 })}
                />
              </MobileCaption>
              <Button variant="ghost" size="icon" className="text-muted-foreground self-end md:self-auto" aria-label={t("common.delete")} onClick={() => remove(line.key)}>
                <Trash2 />
              </Button>
            </li>
          ))}
          {lines.length === 0 && <li className="text-muted-foreground px-4 py-8 text-center text-sm">{t("receipts.noLines")}</li>}
        </ul>

        <footer className="bg-muted/40 flex flex-wrap items-center gap-3 border-t px-4 py-3">
          <div className="text-sm">
            <span className="text-muted-foreground">{t("receipts.linesSum")}</span> <span className="font-medium tabular-nums">{money(linesTotal)}</span>
            {gap !== 0 && lines.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3.5" /> {t("receipts.gap", { amount: money(gap) })}
              </span>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {dirty && (
              <>
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="outline" loading={saveLines.isPending} onClick={() => saveLines.mutate()}>
                  {t("common.save")}
                </Button>
              </>
            )}
            <Button loading={validate.isPending} disabled={!lines.length} onClick={() => validate.mutate()}>
              <CheckCheck /> {receipt.status === "VALIDATED" ? t("receipts.revalidate") : t("receipts.validate")}
            </Button>
          </div>
        </footer>
      </section>

      {receipt.rawText && (
        <details className="bg-card rounded-xl border px-4 py-3 shadow-sm">
          <summary className="cursor-pointer text-sm font-medium">
            {t("receipts.rawText")} <span className="text-muted-foreground font-normal">· {t("receipts.parser", { parser: receipt.parser ?? "?" })}</span>
          </summary>
          <pre className={cn("text-muted-foreground mt-3 max-h-96 overflow-auto font-mono text-xs whitespace-pre-wrap")}>{receipt.rawText}</pre>
        </details>
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("receipts.delete")}
        description={t("receipts.deleteConfirm")}
        confirmLabel={t("common.delete")}
        destructive
        loading={destroy.isPending}
        onConfirm={() => destroy.mutate()}
      />
    </div>
  );
}
