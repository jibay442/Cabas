// Formes des réponses de l'API, partagées avec l'interface.

import type { AlertSettings, Locale } from "./defaults.ts";

export type Role = "PARENT" | "MEMBER" | "CHILD";
export type Theme = "SYSTEM" | "LIGHT" | "DARK";
export type Sex = "FEMALE" | "MALE";

export interface AppConfig {
  appName: string;
  currency: string;
  defaultLocale: Locale;
  allowSignup: boolean;
  version: string;
}

export interface MemberDto {
  id: string;
  role: Role;
  displayName: string;
  emoji: string;
  color: string;
  hasPin: boolean;
  hasAccount: boolean;
  email: string | null;
  allergens: string[];
  journalPrivate: boolean;
  kcalGoal: number | null;
  /** Données corporelles : visibles par le membre lui-même et les parents uniquement */
  body: {
    birthDate: string | null;
    sex: Sex | null;
    heightCm: number | null;
    weightKg: number | null;
    activityFactor: number | null;
  } | null;
}

export interface HouseholdDto {
  id: string;
  name: string;
  currency: string;
  accentColor: string;
  monthlyBudget: number | null;
  alertSettings: AlertSettings;
  webhookTokenHint: string | null;
}

export interface MeDto {
  user: { id: string; email: string; theme: Theme; locale: Locale };
  /** Profil actif (peut être un enfant après un changement de profil) */
  member: MemberDto;
  /** Profil rattaché au compte connecté */
  ownMemberId: string;
  household: HouseholdDto;
}

export interface CategoryDto {
  id: string;
  name: string;
  emoji: string;
  sortOrder: number;
}

export interface StoreDto {
  id: string;
  chain: string;
  name: string;
  city: string | null;
  archived: boolean;
}

export interface InvitationDto {
  id: string;
  role: Role;
  email: string | null;
  expiresAt: string;
  usedAt: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface ProductDto {
  id: string;
  name: string;
  categoryId: string | null;
  defaultUnit: string;
  lastUnitPriceCents: number | null;
  isFavorite: boolean;
  isRecurring: boolean;
  useCount: number;
}

export interface ListItemDto {
  id: string;
  listId: string;
  productId: string;
  name: string;
  quantity: number;
  unit: string;
  estUnitPriceCents: number | null;
  note: string | null;
  categoryId: string | null;
  storeId: string | null;
  addedById: string | null;
  /** Vide = pour tout le foyer */
  forMemberIds: string[];
  checked: boolean;
  checkedById: string | null;
  checkedAt: string | null;
  createdAt: string;
  product: { isFavorite: boolean; isRecurring: boolean };
}

export interface ListSummaryDto {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  storeId: string | null;
  createdAt: string;
  archivedAt: string | null;
  itemCount: number;
  checkedCount: number;
  estimatedCents: number;
}

export interface ListDetailDto extends ListSummaryDto {
  items: ListItemDto[];
}

/** Évènement temps réel diffusé aux membres du foyer (SSE /api/events) */
export interface HouseholdEvent {
  topic: "list" | "lists" | "products";
  id?: string;
  /** Membre à l'origine du changement */
  by: string;
}
