import { describe, expect, it } from "vitest";
import { ageFrom, suggestKcalGoal } from "../src/shared/nutrition.ts";

describe("suggestKcalGoal (Mifflin-St Jeor)", () => {
  const today = new Date("2026-10-09");

  it("calcule l'âge à la date du jour", () => {
    expect(ageFrom("1986-10-10", today)).toBe(39);
    expect(ageFrom("1986-10-09", today)).toBe(40);
  });

  it("homme de 40 ans, 180 cm, 78 kg, activité modérée", () => {
    // BMR = 10×78 + 6,25×180 − 5×40 + 5 = 1710 → ×1,55 = 2650,5 → 2650
    expect(suggestKcalGoal({ birthDate: "1986-10-09", sex: "MALE", heightCm: 180, weightKg: 78, activityFactor: 1.55 }, today)).toBe(2650);
  });

  it("femme de 39 ans, 166 cm, 61 kg, activité légère par défaut", () => {
    // BMR = 610 + 1037,5 − 195 − 161 = 1291,5 → ×1,375 = 1775,8 → 1780
    expect(suggestKcalGoal({ birthDate: "1987-04-12", sex: "FEMALE", heightCm: 166, weightKg: 61 }, today)).toBe(1780);
  });

  it("renvoie null si une donnée manque", () => {
    expect(suggestKcalGoal({ sex: "MALE", heightCm: 180, weightKg: 78 }, today)).toBeNull();
  });
});
