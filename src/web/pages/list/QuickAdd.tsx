import { useId, useRef, useState, type KeyboardEvent } from "react";
import { parseQuickAdd } from "../../../shared/text.ts";
import type { ProductDto } from "../../../shared/types.ts";
import { cx } from "../../components/ui.tsx";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useProductSuggest } from "../../lib/queries.ts";
import { useMoney } from "./format.ts";
import type { NewItem } from "./useListActions.ts";

/**
 * Champ unique de saisie rapide : « 2 lait », « 1,5 kg pommes »…
 * Entrée ajoute l'article ; les flèches parcourent les suggestions issues de l'historique du foyer.
 */
export function QuickAdd({ onAdd, busy }: { onAdd: (item: NewItem) => void; busy: boolean }) {
  const t = useT();
  const money = useMoney();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const parsed = parseQuickAdd(text);
  const { data: suggestions = [] } = useProductSuggest(text.trim() ? parsed.name : "");
  const { data: categories = [] } = useCategories();
  const shown = open && text.trim() ? suggestions : [];
  const emojiOf = (p: ProductDto) => categories.find((c) => c.id === p.categoryId)?.emoji ?? "🛍️";

  function submit(product?: ProductDto) {
    if (!text.trim() && !product) return;
    const quantity = parsed.quantity;
    const unit = parsed.unit ?? undefined;
    onAdd(product ? { productId: product.id, quantity, unit } : { name: parsed.name, quantity, unit });
    setText("");
    setActive(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && shown.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === "ArrowUp" && shown.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(active >= 0 ? shown[active] : undefined);
    }
  }

  return (
    <div className="relative flex-1">
      <label htmlFor={`${listboxId}-input`} className="sr-only">
        {t("list.addPlaceholder")}
      </label>
      <input
        id={`${listboxId}-input`}
        ref={inputRef}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={active >= 0 ? `${listboxId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        enterKeyHint="done"
        placeholder={t("list.addPlaceholder")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-12 w-full rounded-2xl bg-white pl-11 pr-12 text-base shadow-sm ring-1 ring-stone-200 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent dark:bg-stone-900 dark:ring-stone-700"
      />
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-3 text-xl">
        ➕
      </span>
      <button
        type="button"
        onClick={() => submit()}
        disabled={!text.trim() || busy}
        aria-label={t("common.add")}
        className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-xl bg-accent text-lg text-white transition disabled:opacity-0"
      >
        ↵
      </button>

      {shown.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="animate-pop absolute inset-x-0 top-14 z-30 overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700"
        >
          {shown.map((p, i) => (
            <li
              key={p.id}
              id={`${listboxId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(p)}
              className={cx("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active ? "bg-accent/10" : "hover:bg-stone-100 dark:hover:bg-stone-800")}
            >
              <span aria-hidden>{emojiOf(p)}</span>
              <span className="flex-1 truncate">
                {p.name}
                {p.isFavorite && <span aria-hidden> ⭐</span>}
              </span>
              {p.lastUnitPriceCents != null && <span className="text-sm tabular-nums text-stone-500">{money(p.lastUnitPriceCents)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
