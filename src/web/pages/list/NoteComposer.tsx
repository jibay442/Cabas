import { ArrowUp, History, Mic, Plus, Square } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { guessCategoryKey } from "../../../shared/categorize.ts";
import { parseNote, spokenToNote, type NoteEntry } from "../../../shared/note.ts";
import { parseQuickAdd } from "../../../shared/text.ts";
import { Button } from "../../components/ui/button.tsx";
import { Textarea } from "../../components/ui/input.tsx";
import { useI18n } from "../../lib/i18n.tsx";
import { useCategories, useProductSuggest } from "../../lib/queries.ts";
import { useSpeechRecognition } from "../../lib/speech.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { cn } from "../../lib/utils.ts";
import { formatQuantity, useMoney } from "./format.ts";

/** Nom du dernier article en cours de saisie (après la dernière virgule / ligne, sans la quantité) */
function lastSegment(text: string): string {
  const raw = text.split(/[\n,;]/).pop()?.trim() ?? "";
  return raw ? parseQuickAdd(raw).name : "";
}

/**
 * Saisie des courses façon note : on écrit (ou on dicte) librement, une ligne ou une virgule par article.
 * L'aperçu montre en direct ce qui sera ajouté et dans quel rayon.
 *  - « dock » : ancrée en bas de l'écran sur mobile, à portée de pouce ;
 *  - « inline » : carte en haut de la liste sur grand écran.
 */
export function NoteComposer({ layout, busy, onSubmit }: { layout: "dock" | "inline"; busy: boolean; onSubmit: (entries: NoteEntry[]) => void }) {
  const { t, locale } = useI18n();
  const money = useMoney();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const touch = useMediaQuery("(pointer: coarse)");
  const { data: categories = [] } = useCategories();

  const entries = useMemo(() => parseNote(text), [text]);
  const segment = lastSegment(text);
  const { data: suggestions = [] } = useProductSuggest(segment.length >= 2 ? segment : "");

  const speech = useSpeechRecognition(
    locale,
    (spoken) => updateText((current) => [current.trimEnd(), spokenToNote(spoken)].filter(Boolean).join("\n")),
    (error) => toast.error(error === "not-allowed" ? t("note.micDenied") : t("note.micError")),
  );

  function updateText(next: string | ((current: string) => string)) {
    setText((current) => (typeof next === "function" ? next(current) : next));
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, layout === "dock" ? 160 : 260)}px`;
    });
  }

  function submit() {
    if (!entries.length || busy) return;
    onSubmit(entries);
    updateText("");
    textarea.current?.focus();
  }

  /** Remplace le morceau en cours par un produit connu */
  function pickSuggestion(name: string) {
    updateText((current) => {
      const cut = Math.max(current.lastIndexOf("\n"), current.lastIndexOf(","), current.lastIndexOf(";"));
      const head = cut >= 0 ? current.slice(0, cut + 1) : "";
      const typed = current.slice(cut + 1);
      // Garde la quantité éventuellement tapée : « 2 lai » → « 2 Lait demi-écrémé »
      const quantity = typed.trim().match(/^(\d+(?:[.,]\d+)?\s*(?:kg|g|l|cl|ml|x)?\s+)/i)?.[1] ?? "";
      return `${head}${head && !head.endsWith("\n") ? " " : ""}${quantity}${name}, `;
    });
    textarea.current?.focus();
  }

  // Entrée valide sur ordinateur (Maj+Entrée pour une nouvelle ligne) ; sur mobile, Entrée va à la ligne
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !touch && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const emojiOf = (entry: NoteEntry) => {
    const key = guessCategoryKey(entry.name);
    return categories.find((c) => c.key === key)?.emoji ?? "•";
  };

  const suggestionChips = suggestions.length > 0 && segment.length >= 2 && (
    <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
      {suggestions.slice(0, 5).map((p) => (
        <button
          key={p.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pickSuggestion(p.name)}
          className="bg-card hover:bg-accent flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
        >
          <History className="text-muted-foreground size-3" />
          {p.name}
          {p.lastUnitPriceCents != null && <span className="text-muted-foreground tabular-nums">{money(p.lastUnitPriceCents)}</span>}
        </button>
      ))}
    </div>
  );

  const preview = entries.length > 0 && (
    <ul aria-label={t("note.preview")} className={cn("flex gap-1.5 pb-2", layout === "dock" ? "overflow-x-auto [scrollbar-width:none]" : "flex-wrap")}>
      {entries.map((entry, i) => {
        const quantity = formatQuantity(entry.quantity, entry.unit ?? "pcs", locale);
        return (
          <li key={i} className="bg-secondary text-secondary-foreground flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs">
            <span aria-hidden>{emojiOf(entry)}</span>
            <span className="font-medium">{entry.name}</span>
            {quantity && <span className="text-muted-foreground tabular-nums">{quantity}</span>}
            {entry.note && <span className="text-muted-foreground italic">({entry.note})</span>}
          </li>
        );
      })}
    </ul>
  );

  const micButton = speech.supported && (
    <Button
      variant={speech.listening ? "destructive" : "outline"}
      size="icon"
      className={cn("shrink-0", layout === "dock" && "size-10 rounded-full")}
      aria-label={speech.listening ? t("note.stopDictation") : t("note.dictate")}
      title={speech.listening ? t("note.stopDictation") : t("note.dictate")}
      onClick={() => (speech.listening ? speech.stop() : speech.start())}
    >
      {speech.listening ? <Square className="fill-current" /> : <Mic />}
    </Button>
  );

  const listeningHint = speech.listening && (
    <p className="text-muted-foreground flex items-center gap-2 pb-2 text-xs" aria-live="polite">
      <span className="bg-destructive size-2 animate-pulse rounded-full" />
      {speech.interim ? `« ${speech.interim} »` : t("note.listening")}
    </p>
  );

  const field = (
    <Textarea
      ref={textarea}
      rows={1}
      value={text}
      onChange={(e) => updateText(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={t("note.placeholder")}
      aria-label={t("note.label")}
      autoCapitalize="sentences"
      enterKeyHint={touch ? "enter" : "send"}
      className={cn("resize-none", layout === "dock" ? "max-h-40 min-h-10 rounded-[1.25rem] py-2.5" : "max-h-64 min-h-20 border-0 px-0 shadow-none focus-visible:ring-0 dark:bg-transparent")}
    />
  );

  if (layout === "dock") {
    return (
      <div className="bg-card/95 border-t px-3 pt-2 pb-2 backdrop-blur">
        {listeningHint}
        {suggestionChips}
        {preview}
        <div className="flex items-end gap-2">
          <div className="flex-1">{field}</div>
          {micButton}
          <Button size="icon" className="relative size-10 shrink-0 rounded-full" disabled={!entries.length} loading={busy} aria-label={t("note.add", { count: entries.length })} onClick={submit}>
            {!busy && <ArrowUp />}
            {entries.length > 1 && (
              <span className="bg-foreground text-background absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold">
                {entries.length}
              </span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card focus-within:border-ring focus-within:ring-ring/50 rounded-xl border px-4 pt-3 pb-3 shadow-sm transition-[box-shadow] focus-within:ring-[3px]">
      {field}
      {listeningHint}
      {suggestionChips}
      {preview}
      <div className="flex items-center gap-2 border-t pt-3">
        {micButton}
        <p className="text-muted-foreground hidden flex-1 text-xs sm:block">{t("note.hint")}</p>
        <Button className="ml-auto" disabled={!entries.length} loading={busy} onClick={submit}>
          <Plus /> {entries.length > 1 ? t("note.addMany", { count: entries.length }) : t("note.addOne")}
        </Button>
      </div>
    </div>
  );
}
