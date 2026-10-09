import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ListSummaryDto } from "../../../shared/types.ts";
import { Button, Card, Input, Select, Sheet, Toggle, useToast } from "../../components/ui.tsx";
import { api, ApiError } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useStores } from "../../lib/queries.ts";

/** Réglages d'une liste : nom, magasin prévu, fin des courses, suppression */
export function ListMenuSheet({
  list,
  open,
  onClose,
  onSwitch,
}: {
  list: ListSummaryDto;
  open: boolean;
  onClose: () => void;
  /** Liste à afficher ensuite (null = la première active) */
  onSwitch: (id: string | null) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={list.name}>
      {open && <ListMenu key={list.id} list={list} onClose={onClose} onSwitch={onSwitch} />}
    </Sheet>
  );
}

function ListMenu({ list, onClose, onSwitch }: { list: ListSummaryDto; onClose: () => void; onSwitch: (id: string | null) => void }) {
  const t = useT();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const [name, setName] = useState(list.name);
  const [storeId, setStoreId] = useState(list.storeId ?? "");
  const [carryOver, setCarryOver] = useState(true);
  const remaining = list.itemCount - list.checkedCount;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["lists"] });
    void queryClient.invalidateQueries({ queryKey: ["list", list.id] });
  };
  const onError = (e: Error) => toast(e instanceof ApiError ? e.message : t("common.error"), "error");

  const save = useMutation({
    mutationFn: () => api.patch(`/lists/${list.id}`, { name, storeId: storeId || null }),
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError,
  });
  const finish = useMutation({
    mutationFn: () => api.post<{ newListId: string | null }>(`/lists/${list.id}/finish`, { carryOver }),
    onSuccess: ({ newListId }) => {
      refresh();
      toast(t("list.finished"));
      onSwitch(newListId);
      onClose();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/lists/${list.id}`),
    onSuccess: () => {
      refresh();
      onSwitch(null);
      onClose();
    },
    onError,
  });

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Input label={t("list.listName")} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <Select label={t("list.plannedStore")} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">{t("list.anyStore")}</option>
          {stores
            .filter((s) => !s.archived || s.id === storeId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.city ? ` · ${s.city}` : ""}
              </option>
            ))}
        </Select>
        <Button type="submit" variant="secondary" loading={save.isPending}>
          {t("common.save")}
        </Button>
      </form>

      <Card className="space-y-2 bg-stone-50 dark:bg-stone-950">
        <h3 className="font-semibold">🏁 {t("list.finishTitle")}</h3>
        <p className="text-sm text-stone-600 dark:text-stone-400">{t("list.finishHint")}</p>
        {remaining > 0 && (
          <Toggle label={t("list.carryOver", { count: remaining })} checked={carryOver} onChange={setCarryOver} />
        )}
        <Button className="w-full" loading={finish.isPending} onClick={() => finish.mutate()}>
          ✓ {t("list.finish")}
        </Button>
      </Card>

      <Button
        variant="ghost"
        className="w-full text-red-700 dark:text-red-400"
        loading={remove.isPending}
        onClick={() => confirm(t("list.deleteConfirm", { name: list.name })) && remove.mutate()}
      >
        🗑️ {t("list.delete")}
      </Button>
    </div>
  );
}
