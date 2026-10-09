export const ACTIVITY_FACTORS = [
  { value: 1.2, key: "sedentary" },
  { value: 1.375, key: "light" },
  { value: 1.55, key: "moderate" },
  { value: 1.725, key: "active" },
  { value: 1.9, key: "veryActive" },
] as const;

export interface BodyInfo {
  birthDate?: string | null;
  sex?: "FEMALE" | "MALE" | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activityFactor?: number | null;
}

export function ageFrom(birthDate: string, today = new Date()): number {
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

/**
 * Besoin calorique journalier suggéré : métabolisme de base Mifflin-St Jeor × niveau d'activité,
 * arrondi à la dizaine. Indicatif (formule conçue pour les adultes). null si une donnée manque.
 */
export function suggestKcalGoal(info: BodyInfo, today = new Date()): number | null {
  const { birthDate, sex, heightCm, weightKg } = info;
  if (!birthDate || !sex || !heightCm || !weightKg) return null;
  const age = ageFrom(birthDate, today);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "MALE" ? 5 : -161);
  return Math.round((bmr * (info.activityFactor ?? 1.375)) / 10) * 10;
}
