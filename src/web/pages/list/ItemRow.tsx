import { Check, Star } from "lucide-react";
import { lineTotalCents } from "../../../shared/text.ts";
import type { ListItemDto, MemberDto, StoreDto } from "../../../shared/types.ts";
import { Avatar } from "../../components/ui/avatar.tsx";
import { useI18n } from "../../lib/i18n.tsx";
import { cn } from "../../lib/utils.ts";
import { formatQuantity, useMoney } from "./format.ts";

export function ItemRow({
  item,
  members,
  stores,
  canEdit,
  canToggle,
  onToggle,
  onOpen,
}: {
  item: ListItemDto;
  members: Map<string, MemberDto>;
  stores: Map<string, StoreDto>;
  canEdit: boolean;
  canToggle: boolean;
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
    <li className={cn("hover:bg-accent/40 flex min-h-12 items-center pr-3 transition-colors sm:pr-4", item.checked && "text-muted-foreground")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={t(item.checked ? "list.uncheck" : "list.check", { name: item.name })}
        disabled={!canToggle}
        onClick={onToggle}
        className="group flex size-11 shrink-0 items-center justify-center outline-none sm:size-12"
      >
        <span
          className={cn(
            "border-input flex size-5 items-center justify-center rounded-[5px] border shadow-xs transition-colors group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50",
            item.checked && "bg-primary border-primary text-primary-foreground",
          )}
        >
          {item.checked && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>

      <button type="button" onClick={onOpen} disabled={!canEdit} className="min-w-0 flex-1 py-2 text-left outline-none disabled:cursor-default">
        <span className="flex items-center gap-2 text-sm">
          <span className={cn("truncate font-medium", item.checked && "line-through")}>{item.name}</span>
          {quantity && <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{quantity}</span>}
          {item.product.isFavorite && <Star className="fill-warning text-warning size-3 shrink-0" aria-label={t("list.favorite")} />}
        </span>
        {details && <span className="text-muted-foreground block truncate text-xs">{details}</span>}
      </button>

      <div className="flex shrink-0 items-center gap-2 pl-2">
        {forMembers.length > 0 && (
          <span className="flex -space-x-1" aria-label={t("list.forWhom")}>
            {forMembers.map((m) => (
              <Avatar key={m.id} size="xs" name={m.displayName} color={m.color} title={t("list.forMember", { name: m.displayName })} className="ring-card ring-2" />
            ))}
          </span>
        )}
        {total > 0 && <span className="text-muted-foreground text-xs tabular-nums sm:text-sm">{money(total)}</span>}
        {author && <Avatar size="xs" name={author.displayName} color={author.color} title={t("list.addedBy", { name: author.displayName })} className="opacity-80" />}
      </div>
    </li>
  );
}
