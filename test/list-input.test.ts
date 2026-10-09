import { describe, expect, it } from "vitest";
import { guessCategoryKey } from "../src/shared/categorize.ts";
import { lineTotalCents, normalize, parseQuickAdd } from "../src/shared/text.ts";

describe("normalize", () => {
  it("retire accents, majuscules et ponctuation", () => {
    expect(normalize("  Lait DEMI-écrémé 1L ")).toBe("lait demi ecreme 1l");
    expect(normalize("Œufs frais")).toBe("oeufs frais");
  });
});

describe("parseQuickAdd", () => {
  it.each([
    ["lait", { name: "Lait", quantity: 1, unit: null }],
    ["2 lait", { name: "Lait", quantity: 2, unit: null }],
    ["1,5 kg pommes", { name: "Pommes", quantity: 1.5, unit: "kg" }],
    ["500g de farine", { name: "Farine", quantity: 500, unit: "g" }],
    ["3 paquets de pâtes", { name: "Pâtes", quantity: 3, unit: "paquet" }],
    ["yaourts x4", { name: "Yaourts", quantity: 4, unit: "pcs" }],
    ["6 œufs", { name: "Œufs", quantity: 6, unit: null }],
    ["2 l lait", { name: "Lait", quantity: 2, unit: "L" }],
    ["7up", { name: "7up", quantity: 1, unit: null }],
  ])("« %s »", (input, expected) => {
    expect(parseQuickAdd(input)).toEqual(expected);
  });
});

describe("guessCategoryKey", () => {
  it.each([
    ["Lait demi-écrémé", "dairy"],
    ["Pommes de terre", "produce"],
    ["Pomme", "produce"],
    ["Steak haché", "butcher"],
    ["Pâtes complètes", "grocery"],
    ["Papier toilette", "hygiene"],
    ["Liquide vaisselle", "cleaning"],
    ["Glace vanille", "frozen"],
    ["Lait d'avoine", "drinks"],
    ["Croquettes chat", "pets"],
    ["Truc inconnu", null],
  ])("« %s » → %s", (name, key) => {
    expect(guessCategoryKey(name)).toBe(key);
  });
});

describe("lineTotalCents", () => {
  it("multiplie quantité × prix unitaire", () => {
    expect(lineTotalCents({ quantity: 3, unit: "pcs", estUnitPriceCents: 105 })).toBe(315);
    expect(lineTotalCents({ quantity: 1.5, unit: "kg", estUnitPriceCents: 299 })).toBe(449);
  });
  it("prend le prix de la ligne pour g / cl / ml", () => {
    expect(lineTotalCents({ quantity: 500, unit: "g", estUnitPriceCents: 120 })).toBe(120);
  });
  it("vaut 0 sans prix", () => {
    expect(lineTotalCents({ quantity: 2, unit: "pcs", estUnitPriceCents: null })).toBe(0);
  });
});
