import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "../../shared/defaults.ts";
import en from "../i18n/en.json";
import fr from "../i18n/fr.json";

const dictionaries: Record<Locale, unknown> = { fr, en };

function lookup(dict: unknown, key: string): string | undefined {
  let node = dict;
  for (const part of key.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFunction {
  return (key, vars) => {
    const text = lookup(dictionaries[locale], key) ?? lookup(dictionaries.fr, key) ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => String(vars[name] ?? m)) : text;
  };
}

const I18nContext = createContext<{ locale: Locale; t: TFunction }>({ locale: "fr", t: makeT("fr") });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  document.documentElement.lang = locale;
  return <I18nContext.Provider value={{ locale, t: makeT(locale) }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
