import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { priceIsForWholeLine, UNITS } from "../../../shared/text.ts";
import type { ListItemDto } from "../../../shared/types.ts";
import { Avatar, Button, cx, Input, Select, Sheet, Toggle } from "../../components/ui.tsx";
import { api, centsToInput, parseMoney } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useMembers, useSession, useStores } from "../../lib/queries.ts";
import type { ItemPatch } from "./useListActions.ts";

/** Fiche d'un article : quantité, prix, rayon, pour qui, magasin, note, favori / récurrent */
export function ItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: ListItemDto | null;
  onClose: () => void;
  onSave: (patch: ItemPatch) => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.name ?? t("list.item")}>
      {item && <ItemForm key={item.id} item={item} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function ItemForm({ item, onSave, onDelete }: { item: ListItemDto; onSave: (patch: ItemPatch) => void; onDelete: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { isAdult } = useSession();
  const { data: categories = [] } = useCategories();
  const { data: stores = [] } = useStores();
  const { data: members = [] } = useMembers();
  const [form, setForm] = useState({
    name: item.name,
    quantity: String(item.quantity).replace(".", ","),
    unit: item.unit,
    price: centsToInput(item.estUnitPriceCents),
    categoryId: item.categoryId ?? "",
    storeId: item.storeId ?? "",
    note: item.note ?? "",
    forMemberIds: item.forMemberIds,
  });
  const [product, setProduct] = useState(item.product);

  const toggleProduct = useMutation({
    mutationFn: (patch: { isFavorite?: boolean; isRecurring?: boolean }) => api.patch(`/products/${item.productId}`, patch),
    onMutate: (patch) => setProduct((p) => ({ ...p, ...patch })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const toggleMember = (id: string) =>
    setForm((f) => ({ ...f, forMemberIds: f.forMemberIds.includes(id) ? f.forMemberIds.filter((m) => m !== id) : [...f.forMemberIds, id] }));

  function save() {
    const quantity = Number(form.quantity.replace(",", "."));
    onSave({
      name: form.name.trim() || item.name,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : item.quantity,
      unit: form.unit,
      estUnitPriceCents: parseMoney(form.price),
      categoryId: form.categoryId || null,
      storeId: form.storeId || null,
      note: form.note.trim() || null,
      forMemberIds: form.forMemberIds,
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input label={t("list.name")} required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <Input label={t("list.quantity")} inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <Select label={t("list.unit")} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {t(`units.${u}`)}
            </option>
          ))}
        </Select>
        <Input
          label={priceIsForWholeLine(form.unit) ? t("list.priceTotal") : t("list.priceUnit")}
          inputMode="decimal"
          placeholder="0,00"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
        />
      </div>
      <Select label={t("list.category")} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
        <option value="">📦 {t("list.noCategory")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.name}
          </option>
        ))}
      </Select>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-700 dark:text-stone-300">{t("list.forWhom")}</legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={form.forMemberIds.length === 0}
            onClick={() => setForm({ ...form, forMemberIds: [] })}
            className={cx("rounded-full px-3 py-1.5 text-sm ring-1", form.forMemberIds.length === 0 ? "bg-accent/15 ring-accent" : "ring-stone-300 dark:ring-stone-700")}
          >
            🏠 {t("list.everyone")}
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={form.forMemberIds.includes(m.id)}
              onClick={() => toggleMember(m.id)}
              className={cx(
                "flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-sm ring-1",
                form.forMemberIds.includes(m.id) ? "bg-accent/15 ring-accent" : "ring-stone-300 dark:ring-stone-700",
              )}
            >
              <Avatar size="xs" emoji={m.emoji} color={m.color} />
              {m.displayName}
            </button>
          ))}
        </div>
      </fieldset>

      <Select label={t("list.store")} value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
        <option value="">{t("list.anyStore")}</option>
        {stores
          .filter((s) => !s.archived || s.id === form.storeId)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.city ? ` · ${s.city}` : ""}
            </option>
          ))}
      </Select>
      <Input label={t("list.note")} placeholder={t("list.notePlaceholder")} maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />

      {isAdult && (
        <div className="divide-y divide-stone-200 dark:divide-stone-800">
          <Toggle label={`⭐ ${t("list.favorite")}`} checked={product.isFavorite} onChange={(v) => toggleProduct.mutate({ isFavorite: v })} />
          <Toggle
            label={`🔁 ${t("list.recurring")}`}
            description={t("list.recurringHint")}
            checked={product.isRecurring}
            onChange={(v) => toggleProduct.mutate({ isRecurring: v })}
          />
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onDelete} aria-label={t("common.delete")}>
          🗑️
        </Button>
        <Button type="submit" className="flex-1">
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
