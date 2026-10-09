import { lineTotalCents } from "../../../shared/text.ts";
import type { ListItemDto, MemberDto, StoreDto } from "../../../shared/types.ts";
import { Avatar, cx } from "../../components/ui.tsx";
import { useI18n } from "../../lib/i18n.tsx";
import { formatQuantity, useMoney } from "./format.ts";

export function ItemRow({
  item,
  members,
  stores,
  canEdit,
  onToggle,
  onOpen,
}: {
  item: ListItemDto;
  members: Map<string, MemberDto>;
  stores: Map<string, StoreDto>;
  canEdit: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const author = item.addedById ? members.get(item.addedById) : undefined;
  const forMembers = item.forMemberIds.map((id) => members.get(id)).filter((m): m is MemberDto => !!m);
  const total = lineTotalCents(item);
  const quantity = formatQuantity(item.quantity, item.unit, locale);
  const store = item.storeId ? stores.get(item.storeId) : undefined;
  const details = [item.note, store?.name].filter(Boolean).join(" · ");

  return (
    <li
      className={cx(
        "flex items-center gap-2 rounded-2xl bg-white py-1.5 pl-1.5 pr-3 shadow-sm ring-1 ring-stone-200/70 transition dark:bg-stone-900 dark:ring-stone-800",
        item.checked && "opacity-60",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={t(item.checked ? "list.uncheck" : "list.check", { name: item.name })}
        onClick={onToggle}
        className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span
          className={cx(
            "flex size-7 items-center justify-center rounded-full border-2 text-sm font-bold text-white transition",
            item.checked ? "scale-95 border-accent bg-accent" : "border-stone-300 dark:border-stone-600",
          )}
        >
          {item.checked && "✓"}
        </span>
      </button>

      <button type="button" onClick={onOpen} disabled={!canEdit} className="min-w-0 flex-1 py-1 text-left disabled:cursor-default">
        <span className="flex items-baseline gap-2">
          <span className={cx("truncate font-medium", item.checked && "line-through decoration-2")}>{item.name}</span>
          {quantity && <span className="shrink-0 text-sm font-semibold text-accent-ink">{quantity}</span>}
          {item.product.isFavorite && <span aria-label={t("list.favorite")} className="text-xs">⭐</span>}
        </span>
        {details && <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{details}</span>}
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {total > 0 && <span className="text-sm tabular-nums text-stone-600 dark:text-stone-300">{money(total)}</span>}
        <span className="flex items-center gap-0.5">
          {author && <Avatar size="xs" emoji={author.emoji} color={author.color} label={t("list.addedBy", { name: author.displayName })} />}
          {forMembers.length > 0 && (
            <>
              <span aria-hidden className="px-0.5 text-[10px] text-stone-400">
                →
              </span>
              {forMembers.map((m) => (
                <Avatar key={m.id} size="xs" emoji={m.emoji} color={m.color} label={t("list.forMember", { name: m.displayName })} />
              ))}
            </>
          )}
        </span>
      </div>
    </li>
  );
}
