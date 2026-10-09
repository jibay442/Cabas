import { money } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useSession } from "../../lib/queries.ts";

/** Formateur de montants dans la devise du foyer */
export function useMoney() {
  const { locale } = useI18n();
  const { household } = useSession();
  return (cents: number | null | undefined) => money(cents, household.currency, locale);
}

/** « ×2 », « 1,5 kg », « 500 g » ; rien pour une seule pièce */
export function formatQuantity(quantity: number, unit: string, locale: string): string {
  const n = quantity.toLocaleString(locale, { maximumFractionDigits: 2 });
  if (unit === "pcs") return quantity === 1 ? "" : `×${n}`;
  return `${n} ${unit}`;
}
