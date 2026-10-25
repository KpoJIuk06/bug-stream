// Formatting of dates, durations and sizes in the interface language.
import { getLocale, intlLocale, t } from "../i18n";

type Formatters = {
  date: Intl.DateTimeFormat;
  dateTime: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  day: Intl.DateTimeFormat;
};
const cache: Record<string, Formatters> = {};

function f(): Formatters {
  const loc = getLocale();
  return (cache[loc] ??= {
    date: new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short", year: "numeric" }),
    dateTime: new Intl.DateTimeFormat(intlLocale(), {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }),
    time: new Intl.DateTimeFormat(intlLocale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    day: new Intl.DateTimeFormat(intlLocale(), { day: "numeric", month: "short" }),
  });
}

// Some Chrome builds ship without Azerbaijani date data — these names do not depend on it.
const AZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const AZ_MONTHS_LONG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t("just now");
  if (diff < 3600) return t("{n} min ago", { n: Math.round(diff / 60) });
  if (diff < 86400) return t("{n} h ago", { n: Math.round(diff / 3600) });
  if (diff < 86400 * 7) return t("{n} d ago", { n: Math.round(diff / 86400) });
  return formatDate(iso);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (getLocale() === "az") return `${d.getDate()} ${AZ_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return f().dateTime.format(d);
};
export const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (getLocale() === "az") return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return f().date.format(d);
};
export const formatDay = (iso: string) => {
  const d = new Date(iso);
  if (getLocale() === "az") return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}`;
  return f().day.format(d);
};
export const formatClock = (iso: string) => f().time.format(new Date(iso));
export const formatNumber = (n: number) => n.toLocaleString(intlLocale());

/** 9150 → "0:09", 754000 → "12:34" */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 14000 → "14 sec", 95000 → "1 min 35 sec" */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return t("{s} sec", { s: total });
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? t("{m} min {s} sec", { m, s }) : t("{m} min", { m });
}

export function formatBytes(n: number): string {
  if (n < 1024) return t("{n} B", { n });
  if (n < 1024 * 1024) return t("{n} KB", { n: (n / 1024).toFixed(1) });
  if (n < 1024 * 1024 * 1024) return t("{n} MB", { n: (n / 1024 / 1024).toFixed(1) });
  return t("{n} GB", { n: (n / 1024 / 1024 / 1024).toFixed(2) });
}

export function formatMs(n: number | null | undefined): string {
  if (n == null) return "—";
  return n < 1000 ? t("{n} ms", { n }) : t("{n} s", { n: (n / 1000).toFixed(2) });
}

/** Short URL path for lists: "/api/save?x=1" instead of the full address. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}
