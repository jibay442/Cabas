// Réglages des rayons (catégories) et des magasins.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CategoryDto, StoreDto } from "../../../shared/types.ts";
import { Button, Card, Input, PageHeader, Select, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useCategories, useChains, useStores } from "../../lib/queries.ts";

function useCatalogMutation<T>(key: string, fn: (arg: T) => Promise<unknown>) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [key] }),
    onError: (e) => toast(e instanceof ApiError ? e.message : t("common.error"), "error"),
  });
}

export function CategoriesSettings() {
  const t = useT();
  const { data: categories = [] } = useCategories();
  const [draft, setDraft] = useState({ emoji: "🛍️", name: "" });

  const add = useCatalogMutation("categories", () => api.post("/categories", draft).then(() => setDraft({ emoji: "🛍️", name: "" })));
  const update = useCatalogMutation("categories", ({ id, ...body }: Partial<CategoryDto> & { id: string }) => api.patch(`/categories/${id}`, body));
  const remove = useCatalogMutation("categories", (id: string) => api.del(`/categories/${id}`));
  const reorder = useCatalogMutation("categories", (ids: string[]) => api.put("/categories/order", { ids }));

  const move = (index: number, delta: number) => {
    const ids = categories.map((c) => c.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids);
  };

  return (
    <>
      <PageHeader title={t("settings.categories")} back="/reglages" />
      <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">{t("categories.hint")}</p>
      <ul className="space-y-2">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-stone-200/70 dark:bg-stone-900 dark:ring-stone-800">
            <Input
              aria-label={t("categories.emoji")}
              defaultValue={c.emoji}
              className="w-14 text-center text-xl"
              onBlur={(e) => e.target.value && e.target.value !== c.emoji && update.mutate({ id: c.id, emoji: e.target.value })}
            />
            <Input
              aria-label={t("categories.name")}
              defaultValue={c.name}
              onBlur={(e) => e.target.value && e.target.value !== c.name && update.mutate({ id: c.id, name: e.target.value })}
            />
            <Button size="sm" variant="ghost" aria-label={t("common.moveUp")} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </Button>
            <Button size="sm" variant="ghost" aria-label={t("common.moveDown")} disabled={i === categories.length - 1} onClick={() => move(i, 1)}>
              ↓
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("common.delete")}
              onClick={() => confirm(t("categories.deleteConfirm", { name: c.name })) && remove.mutate(c.id)}
            >
              🗑️
            </Button>
          </li>
        ))}
      </ul>
      <Card className="mt-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined);
          }}
        >
          <Input aria-label={t("categories.emoji")} className="w-14 text-center text-xl" value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} />
          <Input
            aria-label={t("categories.name")}
            placeholder={t("categories.newPlaceholder")}
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Button type="submit" loading={add.isPending}>
            {t("common.add")}
          </Button>
        </form>
      </Card>
    </>
  );
}

export function StoresSettings() {
  const t = useT();
  const { data: stores = [] } = useStores();
  const { data: chains = [] } = useChains();
  const [draft, setDraft] = useState({ chain: "leclerc", name: "", city: "" });
  const chainName = (slug: string) => chains.find((c) => c.slug === slug)?.name ?? slug;

  const add = useCatalogMutation("stores", () =>
    api
      .post("/stores", { chain: draft.chain, name: draft.name || chainName(draft.chain), city: draft.city || null })
      .then(() => setDraft({ ...draft, name: "", city: "" })),
  );
  const update = useCatalogMutation("stores", ({ id, ...body }: Partial<StoreDto> & { id: string }) => api.patch(`/stores/${id}`, body));
  const remove = useCatalogMutation("stores", (id: string) => api.del(`/stores/${id}`));

  return (
    <>
      <PageHeader title={t("settings.stores")} back="/reglages" />
      <ul className="space-y-2">
        {stores.map((s) => {
          const chain = chains.find((c) => c.slug === s.chain);
          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200/70 data-[archived=true]:opacity-60 dark:bg-stone-900 dark:ring-stone-800"
              data-archived={s.archived}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: chain?.color ?? "#64748b" }} aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{s.name}</span>
                <span className="block text-sm text-stone-500 dark:text-stone-400">
                  {chainName(s.chain)}
                  {s.city && ` · ${s.city}`}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: s.id, archived: !s.archived })}>
                {s.archived ? t("stores.unarchive") : t("stores.archive")}
              </Button>
              <Button size="sm" variant="ghost" aria-label={t("common.delete")} onClick={() => confirm(t("stores.deleteConfirm", { name: s.name })) && remove.mutate(s.id)}>
                🗑️
              </Button>
            </li>
          );
        })}
      </ul>
      <Card className="mt-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined);
          }}
        >
          <h2 className="font-semibold">🏪 {t("stores.add")}</h2>
          <Select label={t("stores.chain")} value={draft.chain} onChange={(e) => setDraft({ ...draft, chain: e.target.value })}>
            {chains.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("stores.name")} placeholder={chainName(draft.chain)} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Input label={t("stores.city")} value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          </div>
          <Button type="submit" loading={add.isPending}>
            {t("common.add")}
          </Button>
        </form>
      </Card>
    </>
  );
}
