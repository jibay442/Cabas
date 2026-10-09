import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { NoteEntry } from "../../../shared/note.ts";
import type { ListDetailDto, ListItemDto } from "../../../shared/types.ts";
import { api, errorMessage } from "../../lib/api.ts";
import { useT } from "../../lib/i18n.tsx";

export type ItemPatch = Partial<Pick<ListItemDto, "name" | "quantity" | "unit" | "estUnitPriceCents" | "note" | "categoryId" | "storeId" | "forMemberIds" | "checked">>;

/** Actions sur les articles d'une liste, avec mise à jour optimiste (l'écran réagit sans attendre le réseau). */
export function useListActions(listId: string | undefined) {
  const t = useT();
  const queryClient = useQueryClient();
  const key = ["list", listId];

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: ["lists"] });
  };
  const onError = (e: Error) => toast.error(errorMessage(e, t("common.error")));

  /** Applique un changement local et renvoie de quoi l'annuler */
  async function optimistic(change: (items: ListItemDto[]) => ListItemDto[]) {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<ListDetailDto>(key);
    if (previous) queryClient.setQueryData<ListDetailDto>(key, { ...previous, items: change(previous.items) });
    return { previous };
  }

  const update = useMutation({
    mutationFn: ({ id, ...patch }: ItemPatch & { id: string }) => api.patch<ListItemDto>(`/lists/${listId}/items/${id}`, patch),
    onMutate: ({ id, ...patch }) =>
      optimistic((items) =>
        items.map((i) => (i.id === id ? { ...i, ...patch, checkedAt: patch.checked ? new Date().toISOString() : i.checkedAt } : i)),
      ),
    onError: (e, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      onError(e);
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/lists/${listId}/items/${id}`),
    onMutate: (id) => optimistic((items) => items.filter((i) => i.id !== id)),
    onError: (e, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      onError(e);
    },
    onSettled: refresh,
  });

  const addProducts = useMutation({
    mutationFn: (productIds: string[]) => api.post(`/lists/${listId}/items/bulk`, { productIds }),
    onSuccess: refresh,
    onError,
  });

  /** Articles issus d'une note libre */
  const addNote = useMutation({
    mutationFn: (entries: NoteEntry[]) => api.post(`/lists/${listId}/items/bulk`, { items: entries }),
    onSuccess: (_data, entries) => {
      refresh();
      toast.success(entries.length > 1 ? t("note.added", { count: entries.length }) : t("note.addedOne", { name: entries[0]?.name ?? "" }));
    },
    onError,
  });

  return { update, remove, addProducts, addNote };
}
