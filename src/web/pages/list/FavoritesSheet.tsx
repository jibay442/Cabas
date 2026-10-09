import { Check, Plus, Repeat, Star } from "lucide-react";
import { useState } from "react";
import type { ListItemDto, ProductDto } from "../../../shared/types.ts";
import { Button } from "../../components/ui/button.tsx";
import { Sheet } from "../../components/ui/dialog.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useProducts } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
import { useMoney } from "./format.ts";

/** Favoris et produits récurrents : réajout en un clic */
export function FavoritesSheet({
  open,
  onOpenChange,
  items,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const emojiOf = (p: ProductDto) => categories.find((c) => c.id === p.categoryId)?.emoji ?? "•";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("list.quickPicks")}>
      <div role="tablist" className="bg-muted mb-4 grid grid-cols-2 gap-1 rounded-lg p-1">
        {(["recurring", "favorite"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium", tab === key ? "bg-card shadow-sm" : "text-muted-foreground")}
          >
            {key === "recurring" ? <Repeat className="size-3.5" /> : <Star className="size-3.5" />}
            {key === "recurring" ? t("list.recurringTab") : t("list.favoritesTab")}
          </button>
        ))}
      </div>

      {!isPending && products.length === 0 && (
        <p className="text-muted-foreground py-6 text-center text-sm">{tab === "recurring" ? t("list.noRecurring") : t("list.noFavorites")}</p>
      )}

      <ul className="divide-y">
        {products.map((p) => {
          const already = onList.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <span aria-hidden className="w-5 text-center text-sm">
                {emojiOf(p)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                {p.lastUnitPriceCents != null && <span className="text-muted-foreground text-xs tabular-nums">{money(p.lastUnitPriceCents)}</span>}
              </span>
              <Button size="sm" variant={already ? "ghost" : "outline"} disabled={already} onClick={() => onAdd([p.id])}>
                {already ? <Check /> : <Plus />}
                {already ? t("list.onList") : t("common.add")}
              </Button>
            </li>
          );
        })}
      </ul>

      {missing.length > 1 && (
        <Button className="mt-4 w-full" onClick={() => onAdd(missing.map((p) => p.id))}>
          <Plus /> {t("list.addAll", { count: missing.length })}
        </Button>
      )}
    </Sheet>
  );
}
