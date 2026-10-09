import type { Locale } from "./defaults.ts";

/** Titre d'une nouvelle liste : « Courses du jeudi 9 octobre » / « Shopping – Thursday, October 9 » */
export function defaultListTitle(date: Date, locale: Locale, timeZone?: string): string {
  const day = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
  return locale === "fr" ? `Courses du ${day}` : `Shopping – ${day}`;
}
