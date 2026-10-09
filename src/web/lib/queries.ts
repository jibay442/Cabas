import { useQuery } from "@tanstack/react-query";
import type { Chain } from "../../shared/defaults.ts";
import type { AppConfig, CategoryDto, MeDto, MemberDto, StoreDto } from "../../shared/types.ts";
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
