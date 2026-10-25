import type { CapturedEvent } from "./types";

/**
 * Project network filter. A pattern without * is a substring of the address ("collector.github.com"),
 * with * — a pattern for the whole address ("*\/telemetry*", "https://*.example.com/*").
 */
export function networkMatcher(patterns: string[]): (url: string) => boolean {
  const tests = patterns
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (!p.includes("*")) {
        const needle = p.toLowerCase();
        return (u: string) => u.toLowerCase().includes(needle);
      }
      const re = new RegExp("^" + p.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
      return (u: string) => re.test(u);
    });
  return (url) => tests.some((t) => t(url));
}

export function filterNetwork(events: CapturedEvent[], patterns: string[]): CapturedEvent[] {
  if (!patterns.length) return events;
  const ignored = networkMatcher(patterns);
  return events.filter((e) => e.kind !== "network" || !ignored(String(e.payload?.url ?? "")));
}
