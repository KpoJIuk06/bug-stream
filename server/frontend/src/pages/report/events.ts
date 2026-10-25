import type { ReportEvent } from "../../api/types";

/** Visual category of an event — one color code for the timeline and the DevTools tabs. */
export type Tone = "error" | "warn" | "network" | "action" | "nav" | "muted";

export function toneOf(e: ReportEvent): Tone {
  switch (e.kind) {
    case "CONSOLE":
      return e.level === "error" ? "error" : e.level === "warn" || e.level === "warning" ? "warn" : "muted";
    case "NETWORK":
      return isNetworkError(e) ? "error" : "network";
    case "ACTION":
      return "action";
    case "NAVIGATION":
      return "nav";
    default:
      return "muted";
  }
}

export const isNetworkError = (e: ReportEvent) => e.kind === "NETWORK" && (e.status == null || e.status === 0 || e.status >= 400);

export const toneText: Record<Tone, string> = {
  error: "text-ev-error",
  warn: "text-ev-warn",
  network: "text-ev-network",
  action: "text-ev-action",
  nav: "text-ev-nav",
  muted: "text-faint",
};

export const toneBg: Record<Tone, string> = {
  error: "bg-ev-error",
  warn: "bg-ev-warn",
  network: "bg-ev-network",
  action: "bg-ev-action",
  nav: "bg-ev-nav",
  muted: "bg-faint",
};

export const toneSoft: Record<Tone, string> = {
  error: "bg-ev-error-soft",
  warn: "bg-ev-warn-soft",
  network: "bg-ev-network-soft",
  action: "bg-ev-action-soft",
  nav: "bg-ev-nav-soft",
  muted: "bg-line-soft",
};

/** Index of the last event that has already "happened" at time t. */
export function currentIndex(events: ReportEvent[], t: number): number {
  let lo = 0;
  let hi = events.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return JSON.stringify(v, null, 2);
}

/** Pretty-prints a request/response body if it is JSON. */
export function prettyBody(v: unknown): string | null {
  const s = asString(v);
  if (s == null) return null;
  const trimmed = s.trim();
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && trimmed.length < 2_000_000) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      /* not JSON */
    }
  }
  return s;
}
