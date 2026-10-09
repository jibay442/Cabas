import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import { lineTotalCents } from "../../../shared/text.ts";
import type { CategoryDto, ListItemDto, ListSummaryDto } from "../../../shared/types.ts";
import { ChainLogo } from "../../components/ChainLogo.tsx";
import { Button, cx, EmptyState, Input, Sheet, Spinner } from "../../components/ui.tsx";
import { api } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useCategories, useList, useLists, useMembers, useSession, useStores } from "../../lib/queries.ts";
import { FavoritesSheet } from "./FavoritesSheet.tsx";
import { useMoney } from "./format.ts";
import { ItemRow } from "./ItemRow.tsx";
import { ItemSheet } from "./ItemSheet.tsx";
import { ListMenuSheet } from "./ListMenuSheet.tsx";
import { QuickAdd } from "./QuickAdd.tsx";
import { useListActions } from "./useListActions.ts";

const NO_CATEGORY: CategoryDto = { id: "", name: "", emoji: "📦", sortOrder: 9999 };

export function ListPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const { data: lists, isPending } = useLists();
  const [newListOpen, setNewListOpen] = useState(false);
  const { isAdult } = useSession();

  const selectedId = params.get("liste");
  const current = lists?.find((l) => l.id === selectedId) ?? lists?.[0];
  const select = (id: string | null) => setParams(id ? { liste: id } : {}, { replace: true });

  if (isPending) {
    return (
      <div className="flex justify-center py-16 text-accent-ink">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {lists?.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={l.id === current?.id}
            onClick={() => select(l.id)}
            className={cx(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
              l.id === current?.id ? "bg-accent text-white shadow-sm" : "bg-white ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-700",
            )}
          >
            {l.name}
            <span className={cx("rounded-full px-1.5 text-xs", l.id === current?.id ? "bg-white/25" : "bg-stone-100 dark:bg-stone-800")}>
              {l.itemCount - l.checkedCount}
            </span>
          </button>
        ))}
        {isAdult && (
          <button
            type="button"
            onClick={() => setNewListOpen(true)}
            className="shrink-0 rounded-full px-4 py-2 text-sm font-medium border border-dashed border-stone-300 text-accent-ink dark:border-stone-700"
          >
            + {t("list.newList")}
          </button>
        )}
      </div>

      {current ? (
        <ListView key={current.id} summary={current} onSwitch={select} />
      ) : (
        <EmptyState emoji="🛒" title={t("list.noList")}>
          {isAdult && (
            <Button className="mt-3" onClick={() => setNewListOpen(true)}>
              + {t("list.newList")}
            </Button>
          )}
        </EmptyState>
      )}

      <NewListSheet open={newListOpen} onClose={() => setNewListOpen(false)} onCreated={select} />
    </>
  );
}

function ListView({ summary, onSwitch }: { summary: ListSummaryDto; onSwitch: (id: string | null) => void }) {
  const { t } = useI18n();
  const money = useMoney();
  const { member, isAdult, isChild } = useSession();
  const { data: list } = useList(summary.id);
  const { data: categories = [] } = useCategories();
  const { data: memberList = [] } = useMembers();
  const { data: storeList = [] } = useStores();
  const actions = useListActions(summary.id);
  const [editing, setEditing] = useState<ListItemDto | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const members = useMemo(() => new Map(memberList.map((m) => [m.id, m])), [memberList]);
  const stores = useMemo(() => new Map(storeList.map((s) => [s.id, s])), [storeList]);
  const items = list?.items ?? [];
  const store = summary.storeId ? stores.get(summary.storeId) : undefined;

  // Articles à prendre, regroupés par rayon dans l'ordre des rayons ; articles pris en bas
  const groups = useMemo(() => {
    const byCategory = new Map<string, ListItemDto[]>();
    for (const item of items.filter((i) => !i.checked)) {
      const key = item.categoryId ?? "";
      byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
    }
    return [...byCategory.entries()]
      .map(([id, groupItems]) => ({
        category: categories.find((c) => c.id === id) ?? NO_CATEGORY,
        items: groupItems.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder);
  }, [items, categories]);
  const checked = items.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));

  const total = items.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const inCart = checked.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const canEdit = (item: ListItemDto) => !isChild || item.addedById === member.id;

  const row = (item: ListItemDto) => (
    <ItemRow
      key={item.id}
      item={item}
      members={members}
      stores={stores}
      canEdit={canEdit(item)}
      onToggle={() => actions.update.mutate({ id: item.id, checked: !item.checked })}
      onOpen={() => setEditing(item)}
    />
  );

  // L'emplacement est rendu par la mise en page : on le récupère une fois monté
  const [bottomSlot, setBottomSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setBottomSlot(document.getElementById("bottom-slot")), []);

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <QuickAdd busy={actions.add.isPending} onAdd={(item) => actions.add.mutate(item)} />
        {isAdult && (
          <>
            <Button variant="secondary" className="size-12 shrink-0 rounded-2xl px-0 text-xl" aria-label={t("list.quickPicks")} onClick={() => setFavoritesOpen(true)}>
              ⭐
            </Button>
            <Button variant="secondary" className="size-12 shrink-0 rounded-2xl px-0 text-xl" aria-label={t("list.menu")} onClick={() => setMenuOpen(true)}>
              ⋯
            </Button>
          </>
        )}
      </div>

      {store && (
        <p className="-mt-2 mb-3 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
          <ChainLogo chain={store.chain} size="sm" /> {store.name}
        </p>
      )}

      {!list ? (
        <div className="flex justify-center py-16 text-accent-ink">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState emoji="🧺" title={t("list.empty")}>
          {t("list.emptyHint")}
        </EmptyState>
      ) : (
        <div className="space-y-5 pb-20">
          {groups.map(({ category, items: groupItems }) => (
            <section key={category.id || "none"} aria-label={category.name || t("list.noCategory")}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-stone-600 dark:text-stone-400">
                <span aria-hidden className="text-lg">
                  {category.emoji}
                </span>
                {category.name || t("list.noCategory")}
              </h2>
              <ul className="space-y-1.5">{groupItems.map(row)}</ul>
            </section>
          ))}

          {groups.length === 0 && <EmptyState emoji="🎉" title={t("list.allDone")} />}

          {checked.length > 0 && (
            <section aria-label={t("list.inCart")}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-stone-600 dark:text-stone-400">
                <span aria-hidden className="text-lg">
                  🧺
                </span>
                {t("list.inCart")} ({checked.length})
              </h2>
              <ul className="space-y-1.5">{checked.map(row)}</ul>
            </section>
          )}
        </div>
      )}

      {bottomSlot &&
        items.length > 0 &&
        createPortal(
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900">
              <span>
                <span className="opacity-75">{t("list.estimated")}</span> <strong className="text-base tabular-nums">{money(total)}</strong>
              </span>
              <span className="tabular-nums">
                🧺 {money(inCart)} · {checked.length}/{items.length}
              </span>
            </div>
          </div>,
          bottomSlot,
        )}

      <ItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) actions.update.mutate({ id: editing.id, ...patch });
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) actions.remove.mutate(editing.id);
          setEditing(null);
        }}
      />
      {isAdult && (
        <>
          <FavoritesSheet open={favoritesOpen} onClose={() => setFavoritesOpen(false)} items={items} onAdd={(ids) => actions.addProducts.mutate(ids)} />
          <ListMenuSheet list={summary} open={menuOpen} onClose={() => setMenuOpen(false)} onSwitch={onSwitch} />
        </>
      )}
    </>
  );
}

function NewListSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post<ListSummaryDto>("/lists", { name }),
    onSuccess: async (list) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      onCreated(list.id);
      setName("");
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={t("list.newList")}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Input label={t("list.listName")} placeholder={t("list.listNamePlaceholder")} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" className="w-full" loading={create.isPending}>
          {t("common.add")}
        </Button>
      </form>
    </Sheet>
  );
}
