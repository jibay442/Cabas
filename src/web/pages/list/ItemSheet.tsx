import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { priceIsForWholeLine, UNITS } from "../../../shared/text.ts";
import type { ListItemDto } from "../../../shared/types.ts";
import { Avatar } from "../../components/ui/avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Sheet } from "../../components/ui/dialog.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field, Label } from "../../components/ui/label.tsx";
import { SwitchRow } from "../../components/ui/switch.tsx";
import { api, centsToInput, parseMoney } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useCategories, useMembers, useSession, useStores } from "../../lib/queries.ts";
import { cn } from "../../lib/utils.ts";
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
  const { t } = useI18n();
  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()} title={item?.name ?? t("list.item")}>
      {item && <ItemForm key={item.id} item={item} onSave={onSave} onDelete={onDelete} />}
    </Sheet>
  );
}

function ItemForm({ item, onSave, onDelete }: { item: ListItemDto; onSave: (patch: ItemPatch) => void; onDelete: () => void }) {
  const { t } = useI18n();
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

  const chip = (selected: boolean) =>
    cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors", selected ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent");

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label={t("list.name")}>{(id) => <Input id={id} required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("list.quantity")}>
          {(id) => <Input id={id} inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />}
        </Field>
        <Field label={t("list.unit")}>
          {(id) => (
            <NativeSelect id={id} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`units.${u}`)}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label={priceIsForWholeLine(form.unit) ? t("list.priceTotal") : t("list.priceUnit")}>
          {(id) => <Input id={id} inputMode="decimal" placeholder="0,00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />}
        </Field>
      </div>
      <Field label={t("list.category")}>
        {(id) => (
          <NativeSelect id={id} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">{t("list.noCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <fieldset className="grid gap-2">
        <Label asChild>
          <legend>{t("list.forWhom")}</legend>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={form.forMemberIds.length === 0} onClick={() => setForm({ ...form, forMemberIds: [] })} className={chip(form.forMemberIds.length === 0)}>
            {t("list.everyone")}
          </button>
          {members.map((m) => (
            <button key={m.id} type="button" aria-pressed={form.forMemberIds.includes(m.id)} onClick={() => toggleMember(m.id)} className={chip(form.forMemberIds.includes(m.id))}>
              <Avatar size="xs" name={m.displayName} color={m.color} />
              {m.displayName}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label={t("list.store")}>
        {(id) => (
          <NativeSelect id={id} value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })}>
            <option value="">{t("list.anyStore")}</option>
            {stores
              .filter((s) => !s.archived || s.id === form.storeId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.city ? ` · ${s.city}` : ""}
                </option>
              ))}
          </NativeSelect>
        )}
      </Field>
      <Field label={t("list.note")}>
        {(id) => <Input id={id} placeholder={t("list.notePlaceholder")} maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}
      </Field>

      {isAdult && (
        <div className="divide-y border-y">
          <SwitchRow label={t("list.favorite")} checked={product.isFavorite} onCheckedChange={(v) => toggleProduct.mutate({ isFavorite: v })} />
          <SwitchRow label={t("list.recurring")} description={t("list.recurringHint")} checked={product.isRecurring} onCheckedChange={(v) => toggleProduct.mutate({ isRecurring: v })} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="text-destructive" onClick={onDelete}>
          <Trash2 /> {t("common.delete")}
        </Button>
        <Button type="submit" className="flex-1">
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
