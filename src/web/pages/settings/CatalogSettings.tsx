// Réglages des rayons (catégories) et des magasins.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { CategoryDto, StoreDto } from "../../../shared/types.ts";
import { ChainLogo } from "../../components/ChainLogo.tsx";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { PageHeader } from "../../components/ui/misc.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useChains, useStores } from "../../lib/queries.ts";
import { BackToSettings, SettingsCard } from "./SettingsShared.tsx";

function useCatalogMutation<T>(key: string, fn: (arg: T) => Promise<unknown>) {
  const t = useT();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });
}

export function CategoriesSettings() {
  const t = useT();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState({ emoji: "🛍️", name: "" });
  const [deleting, setDeleting] = useState<CategoryDto | null>(null);

  const add = useCatalogMutation("categories", () => api.post("/categories", draft).then(() => setDraft({ emoji: "🛍️", name: "" })));
  const update = useCatalogMutation("categories", ({ id, ...body }: Partial<CategoryDto> & { id: string }) => api.patch(`/categories/${id}`, body));
  const remove = useCatalogMutation("categories", (id: string) => api.del(`/categories/${id}`).then(() => setDeleting(null)));
  const reorder = useCatalogMutation("categories", (ids: string[]) => api.put("/categories/order", { ids }));

  const move = (index: number, delta: number) => {
    const ids = categories.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids);
  };

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader back={<BackToSettings />} title={t("settings.categories")} description={t("categories.hint")} />
      <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <Input
              aria-label={t("categories.emoji")}
              defaultValue={c.emoji}
              className="w-12 px-0 text-center"
              onBlur={(e) => e.target.value && e.target.value !== c.emoji && update.mutate({ id: c.id, emoji: e.target.value })}
            />
            <Input
              aria-label={t("categories.name")}
              defaultValue={c.name}
              className="hover:border-input border-transparent shadow-none dark:bg-transparent"
              onBlur={(e) => e.target.value && e.target.value !== c.name && update.mutate({ id: c.id, name: e.target.value })}
            />
            <Button size="icon" variant="ghost" className="size-8" aria-label={t("common.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" aria-label={t("common.moveDown")} disabled={i === categories.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown />
            </Button>
            <Button size="icon" variant="ghost" className="text-muted-foreground size-8" aria-label={t("common.delete")} onClick={() => setDeleting(c)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <SettingsCard title={t("categories.new")}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined);
          }}
        >
          <Input aria-label={t("categories.emoji")} className="w-12 px-0 text-center" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} />
          <Input aria-label={t("categories.name")} placeholder={t("categories.newPlaceholder")} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Button type="submit" loading={add.isPending}>
            <Plus /> {t("common.add")}
          </Button>
        </form>
      </SettingsCard>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("common.delete")}
        description={deleting ? t("categories.deleteConfirm", { name: deleting.name }) : undefined}
        confirmLabel={t("common.delete")}
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

export function StoresSettings() {
  const t = useT();
  const { data: stores = [] } = useStores();
  const { data: chains = [] } = useChains();
  const [draft, setDraft] = useState({ chain: "leclerc", name: "", city: "" });
  const [deleting, setDeleting] = useState<StoreDto | null>(null);
  const chainName = (slug: string) => chains.find((c) => c.slug === slug)?.name ?? slug;

  const add = useCatalogMutation("stores", () =>
    api.post("/stores", { chain: draft.chain, name: draft.name || chainName(draft.chain), city: draft.city || null }).then(() => setDraft({ ...draft, name: "", city: "" })),
  );
  const update = useCatalogMutation("stores", ({ id, ...body }: Partial<StoreDto> & { id: string }) => api.patch(`/stores/${id}`, body));
  const remove = useCatalogMutation("stores", (id: string) => api.del(`/stores/${id}`).then(() => setDeleting(null)));

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <PageHeader back={<BackToSettings />} title={t("settings.stores")} description={t("settings.storesDesc")} />
      <ul className="bg-card divide-y overflow-hidden rounded-xl border shadow-sm">
        {stores.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 data-[archived=true]:opacity-50" data-archived={s.archived}>
            <ChainLogo chain={s.chain} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="text-muted-foreground block truncate text-xs">
                {chainName(s.chain)}
                {s.city && ` · ${s.city}`}
              </span>
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label={s.archived ? t("stores.unarchive") : t("stores.archive")}
              title={s.archived ? t("stores.unarchive") : t("stores.archive")}
              onClick={() => update.mutate({ id: s.id, archived: !s.archived })}
            >
              {s.archived ? <Eye /> : <EyeOff />}
            </Button>
            <Button size="icon" variant="ghost" className="text-muted-foreground size-8" aria-label={t("common.delete")} onClick={() => setDeleting(s)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <SettingsCard title={t("stores.add")}>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined);
          }}
        >
          <Field label={t("stores.chain")}>
            {(id) => (
              <NativeSelect id={id} value={draft.chain} onChange={(e) => setDraft({ ...draft, chain: e.target.value })}>
                {chains.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("stores.name")}>
              {(id) => <Input id={id} placeholder={chainName(draft.chain)} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
            </Field>
            <Field label={t("stores.city")}>{(id) => <Input id={id} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />}</Field>
          </div>
          <div>
            <Button type="submit" loading={add.isPending}>
              <Plus /> {t("common.add")}
            </Button>
          </div>
        </form>
      </SettingsCard>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("common.delete")}
        description={deleting ? t("stores.deleteConfirm", { name: deleting.name }) : undefined}
        confirmLabel={t("common.delete")}
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
