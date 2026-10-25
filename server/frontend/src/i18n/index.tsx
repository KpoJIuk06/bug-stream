import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ru } from "./ru";
import { az } from "./az";
import { enPlurals } from "./en";

/**
 * Interface translations. English is the source language: keys are the English texts, so a missing
 * translation simply shows English. ru.ts / az.ts map an English text to its translation.
 *
 *   t("Delete")                       → "Удалить"
 *   t("Hello, {name}", { name })      → placeholders in braces
 *   t("{n} errors", { n: 3 })         → plural forms: a dictionary value may be an array
 *                                        (en: [one, other], ru: [one, few, many], az: [one, other])
 */

export type Locale = "en" | "ru" | "az";
export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "ru", label: "Русский" },
  { code: "az", label: "Azərbaycanca" },
];

export type Dict = Record<string, string | string[]>;
const DICTS: Record<Locale, Dict> = { en: enPlurals, ru, az };
const STORAGE_KEY = "bugstream.locale";

let current: Locale = initialLocale();

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "ru" || saved === "az") return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return nav === "ru" || nav === "az" ? nav : "en";
}

export function getLocale(): Locale {
  return current;
}

/** Intl locale tag for dates and numbers. */
export function intlLocale(): string {
  return current === "az" ? "az-Latn-AZ" : current === "ru" ? "ru-RU" : "en-GB";
}

const pluralRules: Partial<Record<Locale, Intl.PluralRules>> = {};

function pickPlural(forms: string[], n: number): string {
  const rules = (pluralRules[current] ??= new Intl.PluralRules(intlLocale()));
  const cat = rules.select(n);
  if (current === "ru") {
    return forms[cat === "one" ? 0 : cat === "few" ? 1 : 2] ?? forms[forms.length - 1];
  }
  return forms[cat === "one" ? 0 : 1] ?? forms[forms.length - 1];
}

export function t(key: string, vars?: Record<string, string | number | null | undefined>): string {
  const value = DICTS[current][key] ?? DICTS.en[key] ?? key;
  let s = Array.isArray(value) ? pickPlural(value, Number(vars?.n ?? 0)) : value;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v == null ? "" : String(v));
  }
  return s;
}

/**
 * A map of code → English label that translates on read:
 *   const STATUS = labels({ NEW: "New" });  STATUS.NEW → "Новый" in Russian.
 */
export function labels<T extends Record<string, string>>(map: T): T {
  return new Proxy(map, {
    get(target, prop) {
      const v = (target as Record<string | symbol, unknown>)[prop];
      return typeof v === "string" ? t(v) : v;
    },
  });
}

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nState>({ locale: current, setLocale: () => {} });

/** Holds the current language. Wrap the routes in <LocaleKeyed> so pages re-render on a change. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setState] = useState<Locale>(current);
  const setLocale = useCallback((l: Locale) => {
    current = l;
    document.documentElement.lang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    setState(l);
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Remounts its children when the language changes, so every t() call runs again. */
export function LocaleKeyed({ children }: { children: ReactNode }) {
  const { locale } = useContext(I18nContext);
  return <LocaleScope key={locale}>{children}</LocaleScope>;
}

function LocaleScope({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useI18n() {
  return useContext(I18nContext);
}
