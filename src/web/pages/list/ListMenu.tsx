import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, MoreHorizontal, Pencil, RotateCcw, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ListSummaryDto } from "../../../shared/types.ts";
import { ConfirmDialog } from "../../components/ConfirmDialog.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog.tsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu.tsx";
import { Input, NativeSelect } from "../../components/ui/input.tsx";
import { Field } from "../../components/ui/label.tsx";
import { SwitchRow } from "../../components/ui/switch.tsx";
import { api, errorMessage } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";
import { useStores } from "../../lib/queries.ts";

/** Menu « ⋯ » d'une liste : modifier, favoris, terminer les courses, rouvrir, supprimer */
export function ListMenu({ list, onSwitch, onFavorites }: { list: ListSummaryDto; onSwitch: (id: string | null) => void; onFavorites: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"edit" | "finish" | "delete" | null>(null);
  const [carryOver, setCarryOver] = useState(true);
  const remaining = list.itemCount - list.checkedCount;
  const archived = list.status === "ARCHIVED";

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["lists"] });
    void queryClient.invalidateQueries({ queryKey: ["list", list.id] });
  };
  const onError = (e: Error) => toast.error(errorMessage(e, t("common.error")));

  const finish = useMutation({
    mutationFn: () => api.post<{ newListId: string | null }>(`/lists/${list.id}/finish`, { carryOver }),
    onSuccess: ({ newListId }) => {
      refresh();
      toast.success(t("list.finished"));
      setDialog(null);
      onSwitch(newListId);
    },
    onError,
  });
  const reopen = useMutation({
    mutationFn: () => api.patch(`/lists/${list.id}`, { status: "ACTIVE" }),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/lists/${list.id}`),
    onSuccess: () => {
      refresh();
      setDialog(null);
      onSwitch(null);
    },
    onError,
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t("list.menu")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {archived ? (
            <DropdownMenuItem onSelect={() => reopen.mutate()}>
              <RotateCcw /> {t("list.reopen")}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <Pencil /> {t("list.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onFavorites}>
                <Star /> {t("list.quickPicks")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("finish")}>
                <CheckCheck /> {t("list.finish")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog("delete")}>
            <Trash2 className="text-destructive" /> {t("list.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditListDialog list={list} open={dialog === "edit"} onOpenChange={(o) => setDialog(o ? "edit" : null)} />
      <ConfirmDialog
        open={dialog === "finish"}
        onOpenChange={(o) => setDialog(o ? "finish" : null)}
        title={t("list.finishTitle")}
        description={t("list.finishHint")}
        confirmLabel={t("list.finish")}
        loading={finish.isPending}
        onConfirm={() => finish.mutate()}
      >
        {remaining > 0 && <SwitchRow label={t("list.carryOver", { count: remaining })} checked={carryOver} onCheckedChange={setCarryOver} />}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => setDialog(o ? "delete" : null)}
        title={t("list.delete")}
        description={t("list.deleteConfirm", { name: list.name })}
        confirmLabel={t("common.delete")}
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

function EditListDialog({ list, open, onOpenChange }: { list: ListSummaryDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: stores = [] } = useStores();
  const [name, setName] = useState(list.name);
  const [storeId, setStoreId] = useState(list.storeId ?? "");
  const save = useMutation({
    mutationFn: () => api.patch(`/lists/${list.id}`, { name, storeId: storeId || null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e, t("common.error"))),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setName(list.name);
          setStoreId(list.storeId ?? "");
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("list.edit")}</DialogTitle>
        </DialogHeader>
        <form
          id="edit-list"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("list.listName")}>{(id) => <Input id={id} required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label={t("list.plannedStore")}>
            {(id) => (
              <NativeSelect id={id} value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                <option value="">{t("list.anyStore")}</option>
                {stores
                  .filter((s) => !s.archived || s.id === storeId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.city ? ` · ${s.city}` : ""}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="edit-list" loading={save.isPending}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
