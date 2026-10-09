import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronDown, ChevronsUpDown, NotebookPen, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { lineTotalCents } from "../../../shared/text.ts";
import type { CategoryDto, ListItemDto, ListSummaryDto } from "../../../shared/types.ts";
import { ChainLogo } from "../../components/ChainLogo.tsx";
import { Avatar } from "../../components/ui/avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Sheet } from "../../components/ui/dialog.tsx";
import { EmptyState, Spinner } from "../../components/ui/misc.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useI18n } from "../../lib/i18n.tsx";
import { useCategories, useList, useLists, useMembers, useSession, useStores } from "../../lib/queries.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { cn } from "../../lib/utils.ts";
import { FavoritesSheet } from "./FavoritesSheet.tsx";
import { useMoney } from "./format.ts";
import { ItemRow } from "./ItemRow.tsx";
import { ItemSheet } from "./ItemSheet.tsx";
import { ListMenu } from "./ListMenu.tsx";
import { ListsNav } from "./ListsNav.tsx";
import { NoteComposer } from "./NoteComposer.tsx";
import { useListActions } from "./useListActions.ts";

const NO_CATEGORY: CategoryDto = { id: "", key: null, name: "", emoji: "•", sortOrder: 9999 };

export function ListPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { isAdult } = useSession();
  const { data: active, isPending } = useLists("active");
  const { data: archived = [] } = useLists("archived");
  const [listsOpen, setListsOpen] = useState(false);

  const selectedId = params.get("liste");
  const current = [...(active ?? []), ...archived].find((l) => l.id === selectedId) ?? active?.[0];
  const select = (id: string | null) => {
    setParams(id ? { liste: id } : {}, { replace: true });
    setListsOpen(false);
  };

  const create = useMutation({
    mutationFn: () => api.post<ListSummaryDto>("/lists"),
    onSuccess: async (list) => {
      await queryClient.invalidateQueries({ queryKey: ["lists"] });
      select(list.id);
      toast.success(t("list.created", { name: list.name }));
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const nav = (
    <ListsNav
      active={active ?? []}
      archived={archived}
      currentId={current?.id}
      canCreate={isAdult}
      creating={create.isPending}
      onSelect={select}
      onCreate={() => create.mutate()}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <aside className="bg-card sticky top-20 hidden rounded-xl border p-2 shadow-sm lg:block">{nav}</aside>

      <div className="min-w-0">
        {current ? (
          <ListView key={current.id} summary={current} onSwitch={select} onOpenLists={() => setListsOpen(true)} />
        ) : (
          <div className="bg-card rounded-xl border shadow-sm">
            <EmptyState icon={<NotebookPen />} title={t("list.noList")}>
              {isAdult && (
                <Button className="mt-3" loading={create.isPending} onClick={() => create.mutate()}>
                  {t("list.newList")}
                </Button>
              )}
            </EmptyState>
          </div>
        )}
      </div>

      <Sheet open={listsOpen} onOpenChange={setListsOpen} title={t("list.lists")}>
        {nav}
      </Sheet>
    </div>
  );
}

function ListView({ summary, onSwitch, onOpenLists }: { summary: ListSummaryDto; onSwitch: (id: string | null) => void; onOpenLists: () => void }) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { member, isAdult, isChild } = useSession();
  const { data: list } = useList(summary.id);
  const { data: categories = [] } = useCategories();
  const { data: memberList = [] } = useMembers();
  const { data: storeList = [] } = useStores();
  const actions = useListActions(summary.id);
  const [editing, setEditing] = useState<ListItemDto | null>(null);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [showChecked, setShowChecked] = useState(true);

  const members = useMemo(() => new Map(memberList.map((m) => [m.id, m])), [memberList]);
  const stores = useMemo(() => new Map(storeList.map((s) => [s.id, s])), [storeList]);
  const items = list?.items ?? [];
  const archived = summary.status === "ARCHIVED";
  const store = summary.storeId ? stores.get(summary.storeId) : undefined;
  const creator = summary.createdById ? members.get(summary.createdById) : undefined;

  // Articles à prendre, regroupés par rayon dans l'ordre des rayons ; articles pris à part
  const groups = useMemo(() => {
    const byCategory = new Map<string, ListItemDto[]>();
    for (const item of items.filter((i) => !i.checked)) {
      const key = item.categoryId ?? "";
      byCategory.set(key, [...(byCategory.get(key) ?? []), item]);
    }
    return [...byCategory.entries()]
      .map(([id, groupItems]) => ({
        category: categories.find((c) => c.id === id) ?? NO_CATEGORY,
        items: groupItems.sort((a, b) => a.name.localeCompare(b.name, locale)),
      }))
      .sort((a, b) => a.category.sortOrder - b.category.sortOrder);
  }, [items, categories, locale]);
  const checked = items.filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));

  const total = items.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const progress = items.length ? Math.round((checked.length / items.length) * 100) : 0;
  const createdAt = new Date(summary.createdAt).toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // Sur mobile, la note est ancrée en bas de l'écran (au-dessus de la navigation)
  const [bottomSlot, setBottomSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setBottomSlot(document.getElementById("bottom-slot")), []);
  const composer = (layout: "dock" | "inline") => <NoteComposer layout={layout} busy={actions.addNote.isPending} onSubmit={(entries) => actions.addNote.mutate(entries)} />;

  const row = (item: ListItemDto) => (
    <ItemRow
      key={item.id}
      item={item}
      members={members}
      stores={stores}
      canEdit={!archived && (!isChild || item.addedById === member.id)}
      canToggle={!archived}
      onToggle={() => actions.update.mutate({ id: item.id, checked: !item.checked })}
      onOpen={() => setEditing(item)}
    />
  );

  return (
    <>
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpenLists} className="flex max-w-full items-center gap-1.5 text-left lg:pointer-events-none" aria-label={t("list.lists")}>
            <h1 className="line-clamp-2 text-xl font-semibold tracking-tight sm:text-2xl">{summary.name}</h1>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0 lg:hidden" />
          </button>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs sm:text-sm">
            {creator && (
              <>
                <Avatar size="xs" name={creator.displayName} color={creator.color} />
                <span>{creator.displayName}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{t("list.createdOn", { date: createdAt })}</span>
            {store && (
              <>
                <span aria-hidden>·</span>
                <ChainLogo chain={store.chain} size="sm" />
                <span>{store.name}</span>
              </>
            )}
          </p>
        </div>
        {isAdult && (
          <div className="flex shrink-0 gap-2">
            {!archived && (
              <Button variant="outline" size="icon" className="hidden sm:inline-flex" aria-label={t("list.quickPicks")} onClick={() => setFavoritesOpen(true)}>
                <Star />
              </Button>
            )}
            <ListMenu list={summary} onSwitch={onSwitch} onFavorites={() => setFavoritesOpen(true)} />
          </div>
        )}
      </header>

      {archived && (
        <div className="bg-muted text-muted-foreground mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
          <Archive className="size-4" />
          {t("list.archivedOn", { date: summary.archivedAt ? new Date(summary.archivedAt).toLocaleDateString(locale) : "" })}
        </div>
      )}

      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-3 text-sm">
          <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("list.progress")}>
            <div className="bg-primary h-full rounded-full transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-muted-foreground tabular-nums">
            {checked.length}/{items.length}
          </span>
          {total > 0 && (
            <span className="font-medium tabular-nums" title={t("list.estimated")}>
              ≈ {money(total)}
            </span>
          )}
        </div>
      )}

      {!archived && isDesktop && <div className="mb-4">{composer("inline")}</div>}

      {!list ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-card rounded-xl border shadow-sm">
          <EmptyState icon={<NotebookPen />} title={t("list.empty")}>
            {t("list.emptyHint")}
          </EmptyState>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
          {groups.map(({ category, items: groupItems }, index) => (
            <section key={category.id || "none"} aria-label={category.name || t("list.noCategory")}>
              <h2 className={cn("bg-muted/50 text-muted-foreground flex items-center gap-2 border-b px-4 py-1.5 text-xs font-medium", index > 0 && "border-t")}>
                <span aria-hidden>{category.emoji}</span>
                {category.name || t("list.noCategory")}
                <span className="ml-auto tabular-nums">{groupItems.length}</span>
              </h2>
              <ul className="divide-y">{groupItems.map(row)}</ul>
            </section>
          ))}

          {groups.length === 0 && <p className="text-muted-foreground px-4 py-6 text-center text-sm">{t("list.allDone")}</p>}

          {checked.length > 0 && (
            <section aria-label={t("list.inCart")}>
              <h2 className="border-t">
                <button
                  type="button"
                  onClick={() => setShowChecked((v) => !v)}
                  aria-expanded={showChecked}
                  className="bg-muted/50 text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-4 py-1.5 text-xs font-medium"
                >
                  <ChevronDown className={cn("size-3.5 transition-transform", !showChecked && "-rotate-90")} />
                  {t("list.inCart")}
                  <span className="ml-auto tabular-nums">{checked.length}</span>
                </button>
              </h2>
              {showChecked && <ul className="divide-y border-t">{checked.map(row)}</ul>}
            </section>
          )}
        </div>
      )}

      {!archived && !isDesktop && bottomSlot && createPortal(composer("dock"), bottomSlot)}

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
      {isAdult && <FavoritesSheet open={favoritesOpen} onOpenChange={setFavoritesOpen} items={items} onAdd={(ids) => actions.addProducts.mutate(ids)} />}
    </>
  );
}
