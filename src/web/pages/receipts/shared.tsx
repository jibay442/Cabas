import { Mail, PenLine, Upload } from "lucide-react";
import type { ReceiptSource, ReceiptStatus } from "../../../shared/types.ts";
import { Badge } from "../../components/ui/badge.tsx";
import { useT } from "../../lib/i18n.tsx";

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  const t = useT();
  const variant = status === "VALIDATED" ? "success" : status === "FAILED" ? "destructive" : "warning";
  return <Badge variant={variant}>{t(`receipts.status.${status}`)}</Badge>;
}

export function SourceIcon({ source }: { source: ReceiptSource }) {
  const t = useT();
  const Icon = source === "WEBHOOK" ? Mail : source === "UPLOAD" ? Upload : PenLine;
  return <Icon className="size-3.5" aria-label={t(`receipts.source.${source}`)} />;
}

export const formatDateTime = (iso: string, locale: string) =>
  new Date(iso).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Valeur pour <input type="datetime-local"> en heure locale */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
