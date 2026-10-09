import { normalize } from "./text.ts";

/**
 * Lexique simple pour ranger un article saisi librement dans un rayon par défaut.
 * Les mots sont comparés à des libellés normalisés (sans accents) ; un produit déjà connu
 * du foyer garde toujours le rayon choisi par l'utilisateur, ce lexique ne sert qu'au premier ajout.
 */
const LEXICON: Record<string, string[]> = {
  produce: [
    "pomme", "poire", "banane", "orange", "citron", "clementine", "mandarine", "fraise", "framboise", "raisin", "kiwi", "ananas",
    "mangue", "peche", "abricot", "prune", "cerise", "melon", "pasteque", "avocat", "tomate", "salade", "laitue", "carotte",
    "courgette", "aubergine", "poivron", "concombre", "oignon", "echalote", "ail", "pomme de terre", "patate", "poireau",
    "brocoli", "chou", "epinard", "haricot vert", "champignon", "radis", "betterave", "navet", "celeri", "persil", "basilic",
    "coriandre", "menthe", "fruit", "legume", "fruits", "legumes", "endive", "potiron", "courge", "mache", "roquette",
  ],
  butcher: [
    "poulet", "dinde", "boeuf", "steak", "hache", "veau", "porc", "agneau", "saucisse", "merguez", "jambon", "lardon",
    "lardons", "bacon", "escalope", "roti", "cote", "filet mignon", "chipolata", "viande", "cordon bleu", "nuggets", "saucisson",
    "chorizo", "pate de campagne", "rillettes", "blanc de poulet",
  ],
  fish: ["saumon", "thon", "cabillaud", "colin", "crevette", "crevettes", "moule", "moules", "poisson", "sardine", "maquereau", "truite", "surimi", "lieu"],
  dairy: [
    "lait", "beurre", "creme", "yaourt", "yaourts", "yogourt", "fromage", "emmental", "gruyere", "comte", "camembert", "brie",
    "mozzarella", "parmesan", "raclette", "chevre", "feta", "ricotta", "mascarpone", "skyr", "fromage blanc", "petit suisse",
    "oeuf", "oeufs", "danette", "kiri", "babybel", "rape",
  ],
  bakery: ["pain", "baguette", "brioche", "croissant", "croissants", "pain de mie", "viennoiserie", "chocolatine", "pain au chocolat", "biscotte", "biscottes", "wrap", "tortilla"],
  grocery: [
    "pates", "pate", "spaghetti", "riz", "semoule", "farine", "sucre", "sel", "poivre", "huile", "vinaigre", "moutarde",
    "mayonnaise", "ketchup", "sauce", "conserve", "thon en boite", "lentille", "lentilles", "pois chiche", "haricot", "mais",
    "soupe", "bouillon", "epice", "epices", "levure", "cafe", "the", "tisane", "cereales", "muesli", "flocons", "chapelure",
    "puree", "olive", "olives", "cornichon", "cornichons", "miel", "confiture", "nutella", "pate a tartiner", "compote",
  ],
  sweet: ["chocolat", "biscuit", "biscuits", "gateau", "gateaux", "bonbon", "bonbons", "chips", "madeleine", "cookie", "cookies", "barre", "gouter", "brownie", "apero", "cacahuete", "crackers"],
  drinks: ["eau", "jus", "soda", "coca", "limonade", "sirop", "biere", "vin", "champagne", "cidre", "boisson", "perrier", "evian", "cristaline", "ice tea", "oasis", "lait d avoine", "lait de soja"],
  frozen: ["surgele", "surgeles", "glace", "glaces", "frites", "pizza surgelee", "poisson pane", "legumes surgeles", "sorbet", "esquimau", "batonnet"],
  hygiene: [
    "dentifrice", "brosse a dents", "shampoing", "shampooing", "gel douche", "savon", "deodorant", "coton", "rasoir", "mousse a raser",
    "papier toilette", "pq", "mouchoir", "mouchoirs", "serviette hygienique", "tampon", "creme solaire", "lingette", "lingettes",
  ],
  cleaning: [
    "lessive", "adoucissant", "liquide vaisselle", "pastille lave vaisselle", "eponge", "eponges", "javel", "nettoyant", "sac poubelle",
    "sacs poubelle", "essuie tout", "sopalin", "aluminium", "papier alu", "film alimentaire", "ampoule", "pile", "piles", "desinfectant",
  ],
  baby: ["couche", "couches", "lait infantile", "petit pot", "petits pots", "lingette bebe", "biberon", "bebe"],
  pets: ["croquette", "croquettes", "patee", "litiere", "chat", "chien", "friandise chien", "friandise chat"],
};

// Les expressions les plus longues d'abord (« pomme de terre » avant « pomme », « lait d'avoine » avant « lait »)
const ENTRIES = Object.entries(LEXICON)
  .flatMap(([key, words]) => words.map((word) => ({ key, word: normalize(word) })))
  .sort((a, b) => b.word.length - a.word.length);

/** Clé du rayon par défaut le plus probable, ou null */
export function guessCategoryKey(name: string): string | null {
  const text = ` ${normalize(name)} `;
  for (const { key, word } of ENTRIES) {
    // mot entier, avec un « s » de pluriel facultatif
    if (text.includes(` ${word} `) || text.includes(` ${word}s `)) return key;
  }
  return null;
}
