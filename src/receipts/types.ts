/** Ligne lue sur un ticket (montants en centimes) */
export interface ParsedLine {
  label: string;
  quantity: number;
  unitPriceCents: number | null;
  totalCents: number;
  ean: string | null;
  /** Remise, bon de réduction… (montant négatif) */
  isDiscount: boolean;
}

export interface ParsedReceipt {
  /** Enseigne reconnue (slug), si le texte permet de l'identifier */
  chain: string | null;
  purchasedAt: Date | null;
  totalCents: number | null;
  lines: ParsedLine[];
}

/**
 * Interface commune des parseurs d'enseigne (src/receipts/parsers/<enseigne>.ts).
 * Pour ajouter une enseigne : créer un fichier qui exporte un ReceiptParser, puis l'ajouter
 * à la liste de parsers/index.ts (et à CHAINS dans src/shared/defaults.ts).
 */
export interface ReceiptParser {
  /** Identifiant de l'enseigne : doit correspondre au slug dans CHAINS */
  slug: string;
  /** Le texte du ticket provient-il de cette enseigne ? */
  detect(text: string): boolean;
  parse(text: string): ParsedReceipt;
}
