// Valeurs par défaut partagées entre le serveur et l'interface.

export type Locale = "fr" | "en";

export interface DefaultCategory {
  key: string;
  emoji: string;
  name: Record<Locale, string>;
  /** Tags Open Food Facts permettant de classer un produit scanné */
  offTags: string[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: "produce", emoji: "🥦", name: { fr: "Fruits & légumes", en: "Fruit & veg" }, offTags: ["en:fruits", "en:vegetables", "en:fresh-foods"] },
  { key: "butcher", emoji: "🥩", name: { fr: "Boucherie", en: "Meat" }, offTags: ["en:meats", "en:poultries", "en:hams"] },
  { key: "fish", emoji: "🐟", name: { fr: "Poissonnerie", en: "Fish" }, offTags: ["en:fishes", "en:seafood"] },
  { key: "dairy", emoji: "🧀", name: { fr: "Crèmerie", en: "Dairy" }, offTags: ["en:dairies", "en:cheeses", "en:eggs"] },
  { key: "bakery", emoji: "🍞", name: { fr: "Boulangerie", en: "Bakery" }, offTags: ["en:breads", "en:viennoiseries"] },
  { key: "grocery", emoji: "🥫", name: { fr: "Épicerie", en: "Pantry" }, offTags: ["en:canned-foods", "en:pastas", "en:cereals-and-their-products", "en:condiments"] },
  { key: "sweet", emoji: "🍫", name: { fr: "Sucré", en: "Sweets" }, offTags: ["en:sugary-snacks", "en:chocolates", "en:biscuits-and-cakes", "en:breakfast-cereals"] },
  { key: "drinks", emoji: "🥤", name: { fr: "Boissons", en: "Drinks" }, offTags: ["en:beverages", "en:waters", "en:juices"] },
  { key: "frozen", emoji: "🧊", name: { fr: "Surgelés", en: "Frozen" }, offTags: ["en:frozen-foods"] },
  { key: "hygiene", emoji: "🧴", name: { fr: "Hygiène", en: "Personal care" }, offTags: [] },
  { key: "cleaning", emoji: "🧹", name: { fr: "Entretien", en: "Household" }, offTags: [] },
  { key: "baby", emoji: "🍼", name: { fr: "Bébé", en: "Baby" }, offTags: ["en:baby-foods"] },
  { key: "pets", emoji: "🐾", name: { fr: "Animaux", en: "Pets" }, offTags: [] },
  { key: "other", emoji: "📦", name: { fr: "Divers", en: "Other" }, offTags: [] },
];

export interface Chain {
  slug: string;
  name: string;
  color: string;
}

/** Enseignes préconfigurées. Le slug correspond au parseur src/receipts/parsers/<slug>.ts */
export const CHAINS: Chain[] = [
  { slug: "auchan", name: "Auchan", color: "#e2001a" },
  { slug: "leclerc", name: "E.Leclerc", color: "#0066b3" },
  { slug: "intermarche", name: "Intermarché", color: "#e30613" },
  { slug: "superu", name: "Super U", color: "#0050a0" },
  { slug: "other", name: "Autre", color: "#64748b" },
];

export const MEMBER_COLORS = [
  "#16a34a", "#0ea5e9", "#6366f1", "#a855f7", "#ec4899", "#ef4444", "#f97316", "#eab308", "#14b8a6", "#64748b",
];

/** Couleurs principales proposées (assez foncées pour un texte blanc lisible, contraste AA) */
export const DEFAULT_ACCENT = "#133c8b";
export const ACCENT_COLORS = [DEFAULT_ACCENT, "#15803d", "#0f766e", "#6d28d9", "#be185d", "#c2410c", "#334155"];

/** Allergènes majeurs (règlement UE 1169/2011), tags Open Food Facts */
export const ALLERGENS: { tag: string; emoji: string; name: Record<Locale, string> }[] = [
  { tag: "en:gluten", emoji: "🌾", name: { fr: "Gluten", en: "Gluten" } },
  { tag: "en:milk", emoji: "🥛", name: { fr: "Lait", en: "Milk" } },
  { tag: "en:eggs", emoji: "🥚", name: { fr: "Œufs", en: "Eggs" } },
  { tag: "en:peanuts", emoji: "🥜", name: { fr: "Arachides", en: "Peanuts" } },
  { tag: "en:nuts", emoji: "🌰", name: { fr: "Fruits à coque", en: "Tree nuts" } },
  { tag: "en:soybeans", emoji: "🫘", name: { fr: "Soja", en: "Soy" } },
  { tag: "en:fish", emoji: "🐟", name: { fr: "Poisson", en: "Fish" } },
  { tag: "en:crustaceans", emoji: "🦐", name: { fr: "Crustacés", en: "Crustaceans" } },
  { tag: "en:molluscs", emoji: "🦪", name: { fr: "Mollusques", en: "Molluscs" } },
  { tag: "en:celery", emoji: "🥬", name: { fr: "Céleri", en: "Celery" } },
  { tag: "en:mustard", emoji: "🟡", name: { fr: "Moutarde", en: "Mustard" } },
  { tag: "en:sesame-seeds", emoji: "⚪", name: { fr: "Sésame", en: "Sesame" } },
  { tag: "en:sulphur-dioxide-and-sulphites", emoji: "🍷", name: { fr: "Sulfites", en: "Sulphites" } },
  { tag: "en:lupin", emoji: "🌼", name: { fr: "Lupin", en: "Lupin" } },
];

export interface AlertSettings {
  enabled: boolean;
  /** Alerte à partir de ce Nutri-Score (inclus) */
  nutriscoreMin: "c" | "d" | "e";
  nova4: boolean;
  additives: boolean;
  allergens: boolean;
  alternatives: boolean;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: true,
  nutriscoreMin: "d",
  nova4: true,
  additives: true,
  allergens: true,
  alternatives: true,
};
