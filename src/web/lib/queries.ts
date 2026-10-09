import { useQuery } from "@tanstack/react-query";
import type { Chain } from "../../shared/defaults.ts";
import type {
  AppConfig,
  CategoryDto,
  ListDetailDto,
  ListSummaryDto,
  MeDto,
  MemberDto,
  ProductDto,
  ReceiptDetailDto,
  ReceiptStatus,
  ReceiptSummaryDto,
  StoreDto,
} from "../../shared/types.ts";
import { api, ApiError } from "./api.ts";

export const useConfig = () => useQuery({ queryKey: ["config"], queryFn: () => api.get<AppConfig>("/config"), staleTime: Infinity });

/** null = non connecté */
export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<MeDto>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });

/** Contexte de l'utilisateur connecté (à utiliser sous la mise en page authentifiée) */
export function useSession() {
  const { data } = useMe();
  if (!data) throw new Error("useSession hors session");
  const role = data.member.role;
  return { ...data, isParent: role === "PARENT", isChild: role === "CHILD", isAdult: role !== "CHILD" };
}

export const useMembers = () => useQuery({ queryKey: ["members"], queryFn: () => api.get<MemberDto[]>("/members") });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => api.get<CategoryDto[]>("/categories") });
export const useStores = () => useQuery({ queryKey: ["stores"], queryFn: () => api.get<StoreDto[]>("/stores") });
export const useChains = () => useQuery({ queryKey: ["chains"], queryFn: () => api.get<Chain[]>("/chains"), staleTime: Infinity });

export const useLists = (status: "active" | "archived" = "active") =>
  useQuery({ queryKey: ["lists", status], queryFn: () => api.get<ListSummaryDto[]>(`/lists?status=${status}`) });

export const useList = (id: string | undefined) =>
  useQuery({ queryKey: ["list", id], queryFn: () => api.get<ListDetailDto>(`/lists/${id}`), enabled: !!id });

export const useProducts = (filter: "favorite" | "recurring") =>
  useQuery({ queryKey: ["products", filter], queryFn: () => api.get<ProductDto[]>(`/products?${filter}=true`) });

export const useProductSuggest = (q: string) =>
  useQuery({
    queryKey: ["products", "suggest", q],
    queryFn: () => api.get<ProductDto[]>(`/products/suggest?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });

export const useReceipts = (status?: ReceiptStatus) =>
  useQuery({ queryKey: ["receipts", status ?? "all"], queryFn: () => api.get<ReceiptSummaryDto[]>(`/receipts${status ? `?status=${status}` : ""}`) });

export const useReceipt = (id: string | undefined) =>
  useQuery({ queryKey: ["receipt", id], queryFn: () => api.get<ReceiptDetailDto>(`/receipts/${id}`), enabled: !!id });
