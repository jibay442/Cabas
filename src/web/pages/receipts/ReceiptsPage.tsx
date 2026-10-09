import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, PenLine, ReceiptText, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import type { ReceiptStatus, ReceiptSummaryDto } from "../../../shared/types.ts";
import { ChainLogo } from "../../components/ChainLogo.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { EmptyState, PageHeader, Spinner } from "../../components/ui/misc.tsx";
import { errorMessage, upload } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useReceipts, useSession } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
import { useMoney } from "../list/format.ts";
import { ManualReceiptSheet } from "./ManualReceiptSheet.tsx";
import { formatDateTime, SourceIcon, StatusBadge } from "./shared.tsx";

const FILTERS: (ReceiptStatus | undefined)[] = [undefined, "TO_REVIEW", "VALIDATED"];

export function ReceiptsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isParent } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<ReceiptStatus | undefined>(undefined);
  const [manualOpen, setManualOpen] = useState(false);
  const { data: receipts, isPending } = useReceipts(filter);

  const send = useMutation({
    mutationFn: (file: File) => upload<ReceiptSummaryDto & { duplicate: boolean }>("/receipts/upload", file),
    onMutate: () => toast.loading(t("receipts.uploading"), { id: "upload" }),
    onSuccess: (receipt) => {
      void queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success(receipt.duplicate ? t("receipts.duplicate") : t("receipts.imported", { count: receipt.lineCount }), { id: "upload" });
      navigate(`/tickets/${receipt.id}`);
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error")), { id: "upload" }),
  });

  return (
    <>
      <PageHeader
        title={t("nav.receipts")}
        description={t("receipts.description")}
        actions={
          <>
            <Button variant="outline" onClick={() => setManualOpen(true)}>
              <PenLine /> <span className="hidden sm:inline">{t("receipts.manual")}</span>
            </Button>
            <Button loading={send.isPending} onClick={() => fileInput.current?.click()}>
              <Upload /> {t("receipts.import")}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) send.mutate(file);
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <div role="tablist" className="bg-muted mb-4 inline-flex gap-1 rounded-lg p-1">
        {FILTERS.map((f) => (
          <button
            key={f ?? "all"}
            role="tab"
            type="button"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded-md px-3 py-1 text-sm font-medium", filter === f ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {f ? t(`receipts.filter.${f}`) : t("receipts.filter.all")}
          </button>
        ))}
      </div>

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : !receipts?.length ? (
        <div className="bg-card rounded-xl border shadow-sm">
          <EmptyState icon={<ReceiptText />} title={t("receipts.empty")}>
            {t("receipts.emptyHint")}{" "}
            {isParent && (
              <Link to="/reglages/foyer" className="text-primary hover:underline">
                {t("receipts.setupWebhook")}
              </Link>
            )}
          </EmptyState>
        </div>
      ) : (
        <ReceiptList receipts={receipts} />
      )}

      <ManualReceiptSheet open={manualOpen} onOpenChange={setManualOpen} />
    </>
  );
}

function ReceiptList({ receipts }: { receipts: ReceiptSummaryDto[] }) {
  const { t, locale } = useI18n();
  const money = useMoney();
  return (
    <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
      {receipts.map((r) => (
        <li key={r.id}>
          <Link to={`/tickets/${r.id}`} className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3 transition-colors">
            <ChainLogo chain={r.chain} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.storeName ?? t("receipts.unknownStore")}</span>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <SourceIcon source={r.source} />
                {formatDateTime(r.purchasedAt, locale)}
                <span aria-hidden>·</span>
                {t("receipts.lines", { count: r.lineCount })}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-medium tabular-nums">{money(r.totalCents)}</span>
              <span className="flex items-center gap-1">
                {r.status !== "VALIDATED" && r.unmatchedCount > 0 && <Badge variant="outline">{t("receipts.toMatch", { count: r.unmatchedCount })}</Badge>}
                <StatusBadge status={r.status} />
              </span>
            </span>
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
