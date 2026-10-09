import { describe, expect, it } from "vitest";
import { parseNote, spokenToNote } from "../src/shared/note.ts";

const short = (text: string) => parseNote(text).map((e) => [e.name, e.quantity, e.unit, e.note]);

describe("parseNote", () => {
  it("découpe par ligne, virgule, point-virgule et « et »", () => {
    expect(short("lait, 2 baguettes\n1 kg de pommes; beurre et confiture")).toEqual([
      ["Lait", 1, null, null],
      ["Baguettes", 2, null, null],
      ["Pommes", 1, "kg", null],
      ["Beurre", 1, null, null],
      ["Confiture", 1, null, null],
    ]);
  });

  it("garde la virgule décimale", () => {
    expect(short("1,5 kg tomates, lait")).toEqual([
      ["Tomates", 1.5, "kg", null],
      ["Lait", 1, null, null],
    ]);
  });

  it("met le texte entre parenthèses en note", () => {
    expect(short("pain (complet), yaourts (sans lactose) x4")).toEqual([
      ["Pain", 1, null, "complet"],
      ["Yaourts", 4, "pcs", "sans lactose"],
    ]);
  });

  it("comprend les nombres en lettres et les articles", () => {
    expect(short("deux baguettes\ndu lait\ndes œufs\nune douzaine d'œufs\nun kilo de pommes\ntrois paquets de pâtes\nde la farine")).toEqual([
      ["Baguettes", 2, null, null],
      ["Lait", 1, null, null],
      ["Œufs", 1, null, null],
      ["Œufs", 12, null, null],
      ["Pommes", 1, "kg", null],
      ["Pâtes", 3, "paquet", null],
      ["Farine", 1, null, null],
    ]);
  });

  it("ignore puces, cases et lignes vides", () => {
    expect(short("- lait\n• pain\n[ ] beurre\n1. sucre\n\n  \n-")).toEqual([
      ["Lait", 1, null, null],
      ["Pain", 1, null, null],
      ["Beurre", 1, null, null],
      ["Sucre", 1, null, null],
    ]);
  });

  it("2 kg de la farine → retire l'article après la quantité", () => {
    expect(short("2 kg de farine")).toEqual([["Farine", 2, "kg", null]]);
  });
});

describe("spokenToNote", () => {
  it("coupe une dictée sans ponctuation", () => {
    expect(spokenToNote("deux baguettes du lait des pommes et du beurre")).toBe("deux baguettes\ndu lait\ndes pommes\ndu beurre");
  });
  it("garde « un kilo de pommes de terre » entier", () => {
    expect(spokenToNote("un kilo de pommes de terre 3 yaourts")).toBe("un kilo de pommes de terre\n3 yaourts");
  });
  it("donne des articles une fois analysée", () => {
    expect(short(spokenToNote("2 litres de lait une douzaine d'œufs et de la farine"))).toEqual([
      ["Lait", 2, "L", null],
      ["Œufs", 12, null, null],
      ["Farine", 1, null, null],
    ]);
  });
});
