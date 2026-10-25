import { az, enPlurals, ru } from "./i18n-dict";

/**
 * Extension texts: English keys, Russian and Azerbaijani translations (same scheme as the site).
 * The language follows the user's profile on the site (saved on sign-in / token refresh),
 * otherwise the browser language. Call initI18n() before rendering.
 */

export type Locale = "en" | "ru" | "az";
type Dict = Record<string, string | string[]>;
const DICTS: Record<Locale, Dict> = { en: enPlurals, ru, az };

let current: Locale = browserLocale();

function browserLocale(): Locale {
  const l = (navigator.language || "en").slice(0, 2).toLowerCase();
  return l === "ru" || l === "az" ? l : "en";
}

// Another extension page changed the language — follow it (service worker, content scripts, open pages)
try {
  chrome.storage?.onChanged.addListener((changes, area) => {
    const l = changes.locale?.newValue;
    if (area === "local" && (l === "en" || l === "ru" || l === "az")) current = l;
  });
} catch {
  /* no extension context */
}

export async function initI18n(): Promise<Locale> {
  try {
    const { locale } = await chrome.storage.local.get("locale");
    if (locale === "en" || locale === "ru" || locale === "az") current = locale;
  } catch {
    /* page without extension storage */
  }
  return current;
}

export function getLocale(): Locale {
  return current;
}

export async function saveLocale(l: string | null | undefined): Promise<void> {
  if (l !== "en" && l !== "ru" && l !== "az") return;
  current = l;
  await chrome.storage.local.set({ locale: l });
}

export function intlLocale(): string {
  return current === "ru" ? "ru-RU" : current === "az" ? "az-Latn-AZ" : "en-GB";
}

export function t(key: string, vars?: Record<string, string | number | null | undefined>): string {
  const v = DICTS[current][key] ?? DICTS.en[key] ?? key;
  let s: string;
  if (Array.isArray(v)) {
    const n = Number(vars?.n ?? 0);
    const cat = new Intl.PluralRules(intlLocale()).select(n);
    s = current === "ru" ? v[cat === "one" ? 0 : cat === "few" ? 1 : 2] ?? v[v.length - 1] : v[cat === "one" ? 0 : 1] ?? v[v.length - 1];
  } else {
    s = v;
  }
  if (vars) for (const [k, val] of Object.entries(vars)) s = s.split(`{${k}}`).join(val == null ? "" : String(val));
  return s;
}

/**
 * Translates static HTML: elements with data-i18n (text), data-i18n-html (markup is trusted, from the extension),
 * data-i18n-title and data-i18n-placeholder. The English original stays the key.
 */
export function translateDom(root: ParentNode = document): void {
  document.documentElement.lang = current;
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.dataset.i18n ||= el.textContent?.trim() ?? "";
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    el.dataset.i18nHtml ||= el.innerHTML.trim();
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.dataset.i18nTitle ||= el.title;
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => {
    el.dataset.i18nPlaceholder ||= el.placeholder;
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}
