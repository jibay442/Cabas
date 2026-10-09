// Conversion des enregistrements Prisma en réponses API (aucun secret ne sort d'ici).

import type { AlertSettings } from "../../shared/defaults.ts";
import { DEFAULT_ALERT_SETTINGS } from "../../shared/defaults.ts";
import type { CategoryDto, HouseholdDto, MemberDto, StoreDto } from "../../shared/types.ts";
import type { Category, Household, Member, Store, User } from "../generated/prisma/client.ts";

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** viewer : membre qui consulte, pour masquer les données corporelles des autres */
export function memberDto(m: Member & { user?: Pick<User, "email"> | null }, viewer?: Member): MemberDto {
  const seesBody = !viewer || viewer.id === m.id || viewer.role === "PARENT";
  return {
    id: m.id,
    role: m.role,
    displayName: m.displayName,
    emoji: m.emoji,
    color: m.color,
    hasPin: !!m.pinHash,
    hasAccount: !!m.userId,
    email: m.user?.email ?? null,
    allergens: m.allergens,
    journalPrivate: m.journalPrivate,
    kcalGoal: m.kcalGoal,
    body: seesBody
      ? {
          birthDate: isoDate(m.birthDate),
          sex: m.sex,
          heightCm: m.heightCm,
          weightKg: m.weightKg,
          activityFactor: m.activityFactor,
        }
      : null,
  };
}

export function householdDto(h: Household): HouseholdDto {
  return {
    id: h.id,
    name: h.name,
    currency: h.currency,
    accentColor: h.accentColor,
    monthlyBudget: h.monthlyBudget,
    alertSettings: { ...DEFAULT_ALERT_SETTINGS, ...(h.alertSettings as Partial<AlertSettings>) },
    webhookTokenHint: h.webhookTokenHint,
  };
}

export const categoryDto = (c: Category): CategoryDto => ({ id: c.id, key: c.key, name: c.name, emoji: c.emoji, sortOrder: c.sortOrder });

export const storeDto = (s: Store): StoreDto => ({ id: s.id, chain: s.chain, name: s.name, city: s.city, archived: s.archived });
