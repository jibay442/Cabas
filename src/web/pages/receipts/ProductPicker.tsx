import { Check, Link2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { productNameFromLabel } from "../../../shared/text.ts";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useProductSuggest } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";

export interface ProductChoice {
  productId: string | null;
  productName: string | null;
}

/**
 * Produit associé à une ligne de ticket : un produit existant du foyer,
 * ou un nouveau produit (créé à la validation, nommé d'après le libellé).
 */
export function ProductPicker({ label, value, onChange }: { label: string; value: ProductChoice; onChange: (choice: ProductChoice) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const firstWord = label.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const [query, setQuery] = useState(firstWord);
  const { data: products = [] } = useProductSuggest(open ? query : "");
  const proposed = productNameFromLabel(label);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuery(firstWord);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input dark:bg-input/30 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border bg-transparent px-3 text-left text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            !value.productId && "text-muted-foreground",
          )}
        >
          {value.productId ? <Link2 className="text-primary size-3.5 shrink-0" /> : <Plus className="size-3.5 shrink-0" />}
          <span className="truncate">{value.productId ? value.productName : t("receipts.newProduct", { name: proposed })}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("receipts.searchProduct")}
            aria-label={t("receipts.searchProduct")}
            className="h-10 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onChange({ productId: p.id, productName: p.name });
                  setOpen(false);
                }}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
              >
                <Check className={cn("size-4", value.productId === p.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
          {query.trim() && products.length === 0 && <li className="text-muted-foreground px-2 py-1.5 text-sm">{t("receipts.noProduct")}</li>}
          <li className="mt-1 border-t pt-1">
            <button
              type="button"
              onClick={() => {
                onChange({ productId: null, productName: null });
                setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
            >
              <Plus className="size-4" />
              <span className="truncate">{t("receipts.createProduct", { name: proposed })}</span>
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
