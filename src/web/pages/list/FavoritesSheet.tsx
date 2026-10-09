import { useState } from "react";
import type { ListItemDto, ProductDto } from "../../../shared/types.ts";
import { Button, cx, Sheet } from "../../components/ui.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useProducts } from "../../lib/queries.ts";
import { useMoney } from "./format.ts";

/** Favoris et produits récurrents : réajout en un clic */
export function FavoritesSheet({
  open,
  onClose,
  items,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  items: ListItemDto[];
  onAdd: (productIds: string[]) => void;
}) {
  const t = useT();
  const money = useMoney();
  const [tab, setTab] = useState<"recurring" | "favorite">("recurring");
  const { data: products = [], isPending } = useProducts(tab);
  const { data: categories = [] } = useCategories();
  const onList = new Set(items.filter((i) => !i.checked).map((i) => i.productId));
  const missing = products.filter((p) => !onList.has(p.id));
  const emojiOf = (p: ProductDto) => categories.find((c) => c.id === p.categoryId)?.emoji ?? "🛍️";

  return (
    <Sheet open={open} onClose={onClose} title={t("list.quickPicks")}>
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
        {(["recurring", "favorite"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx("rounded-lg py-2 text-sm font-medium", tab === key && "bg-white shadow-sm dark:bg-stone-900")}
          >
            {key === "recurring" ? `🔁 ${t("list.recurringTab")}` : `⭐ ${t("list.favoritesTab")}`}
          </button>
        ))}
      </div>

      {!isPending && products.length === 0 && (
        <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">{tab === "recurring" ? t("list.noRecurring") : t("list.noFavorites")}</p>
      )}

      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {products.map((p) => {
          const already = onList.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span aria-hidden className="text-xl">
                {emojiOf(p)}
              </span>
              <span className="flex-1">
                <span className="block">{p.name}</span>
                {p.lastUnitPriceCents != null && <span className="text-xs text-stone-500">{money(p.lastUnitPriceCents)}</span>}
              </span>
              <Button size="sm" variant={already ? "ghost" : "secondary"} disabled={already} onClick={() => onAdd([p.id])}>
                {already ? `✓ ${t("list.onList")}` : `+ ${t("common.add")}`}
              </Button>
            </li>
          );
        })}
      </ul>

      {missing.length > 1 && (
        <Button className="mt-4 w-full" onClick={() => onAdd(missing.map((p) => p.id))}>
          {t("list.addAll", { count: missing.length })}
        </Button>
      )}
    </Sheet>
  );
}
