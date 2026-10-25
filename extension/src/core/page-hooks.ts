/**
 * Hooks on the page: console.*, unhandled errors, resource load errors, fetch, XMLHttpRequest
 * and navigation inside SPAs. Shared by the extension (content-main.js) and the site widget (bug-stream.js).
 * Runs in the page's own context; passes events to post().
 */

import type { CapturedEvent } from "./types";

type AnyFn = (...args: any[]) => any;

const MAX_BODY = 256 * 1024; // characters of a request/response body
const MAX_STRING = 4000;
const XHR_KEY = "__adtaskXhr" + Math.random().toString(36).slice(2, 7);

// ============================== serialization ==============================

export const truncate = (s: string, max = MAX_STRING) => (s.length > max ? s.slice(0, max) + "…" : s);

export function preview(v: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return depth === 0 ? v : JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  if (typeof v === "symbol") return v.toString();
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}()`;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (typeof Element !== "undefined" && v instanceof Element) {
    const id = v.id ? `#${v.id}` : "";
    return `<${v.tagName.toLowerCase()}${id}>`;
  }
  if (typeof v === "object") {
    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);
    if (depth >= 3) return Array.isArray(v) ? `Array(${v.length})` : "{…}";
    if (Array.isArray(v)) {
      const items = v.slice(0, 30).map((x) => preview(x, depth + 1, seen));
      return `[${items.join(", ")}${v.length > 30 ? ", …" : ""}]`;
    }
    try {
      const entries = Object.entries(v as Record<string, unknown>).slice(0, 30);
      return `{${entries.map(([k, x]) => `${k}: ${preview(x, depth + 1, seen)}`).join(", ")}${entries.length === 30 ? ", …" : ""}}`;
    } catch {
      return Object.prototype.toString.call(v);
    }
  }
  return String(v);
}

const absolute = (url: string) => {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
};

const shortPath = (url: string) => {
  try {
    const u = new URL(url);
    return u.origin === location.origin ? u.pathname + u.search : u.host + u.pathname + u.search;
  } catch {
    return url;
  }
};

function headersToObject(h: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  try {
    if (h instanceof Headers) h.forEach((v, k) => (out[k] = v));
    else if (Array.isArray(h)) for (const [k, v] of h) out[String(k).toLowerCase()] = String(v);
    else for (const [k, v] of Object.entries(h as Record<string, string>)) out[k.toLowerCase()] = String(v);
  } catch {
    /* ignore */
  }
  return out;
}

function bodyToString(body: unknown): string | undefined {
  if (body == null) return undefined;
  if (typeof body === "string") return truncate(body, MAX_BODY);
  if (body instanceof URLSearchParams) return truncate(body.toString(), MAX_BODY);
  if (body instanceof FormData) {
    const parts: string[] = [];
    body.forEach((v, k) => parts.push(`${k}=${typeof v === "string" ? v : `[file ${(v as File).name}, ${(v as File).size} B]`}`));
    return truncate(parts.join("\n"), MAX_BODY);
  }
  if (body instanceof Blob) return `[Blob ${body.type || "no type"}, ${body.size} B]`;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return `[binary data, ${(body as ArrayBuffer).byteLength} B]`;
  return truncate(preview(body), MAX_BODY);
}

const isTextual = (contentType: string | null) =>
  !contentType || /json|text|xml|javascript|x-www-form-urlencoded|graphql|html/i.test(contentType);

/**
 * Installs the hooks once per window. ignoreUrl — requests not to record
 * (e.g. the widget sending the report itself).
 */
export function installPageHooks(
  sink: (event: CapturedEvent) => void,
  ignoreUrl?: (url: string) => boolean,
  flag = "__adtaskHooked", // the extension and the widget have their own flags: both can work on one page
): void {
  const w = window as any;
  if (w[flag]) return;
  w[flag] = true;

  const post = (event: CapturedEvent) => {
    if (event.kind === "network" && ignoreUrl?.(String(event.payload?.url ?? ""))) return;
    sink(event);
  };

  // ============================== console ==============================

  const levels: Record<string, string> = { log: "log", info: "info", warn: "warn", error: "error", debug: "debug" };
  for (const method of Object.keys(levels)) {
    const original = (console as any)[method] as AnyFn;
    if (typeof original !== "function") continue;
    (console as any)[method] = function (...args: unknown[]) {
      try {
        const err = args.find((a) => a instanceof Error) as Error | undefined;
        let stack = err?.stack;
        if (!stack && method === "error") stack = new Error().stack?.split("\n").slice(2).join("\n");
        post({
          kind: "console",
          ts: Date.now(),
          level: levels[method],
          summary: truncate(args.map((a) => preview(a)).join(" ")),
          payload: {
            ...(args.length > 1 || typeof args[0] === "object" ? { args: args.slice(0, 10).map((a) => truncate(preview(a), 2000)) } : {}),
            ...(stack ? { stack: truncate(stack) } : {}),
          },
        });
      } catch {
        /* hooks must never break the page */
      }
      return original.apply(this, args);
    };
  }

  window.addEventListener(
    "error",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target !== (window as unknown) && "tagName" in target) {
        // resource load error: <img>, <script>, <link>
        const src = (target as HTMLImageElement).src || (target as HTMLLinkElement).href || "";
        if (!src) return;
        post({
          kind: "network",
          ts: Date.now(),
          method: "GET",
          status: 0,
          summary: `GET ${shortPath(src)} — ${target.tagName.toLowerCase()} failed to load`,
          payload: { url: src, error: `Could not load <${target.tagName.toLowerCase()}>`, type: "resource" },
        });
        return;
      }
      const ev = e as ErrorEvent;
      post({
        kind: "console",
        ts: Date.now(),
        level: "error",
        summary: truncate(`Uncaught ${ev.error instanceof Error ? `${ev.error.name}: ${ev.error.message}` : ev.message}`),
        payload: {
          stack: ev.error?.stack ? truncate(ev.error.stack) : undefined,
          source: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined,
        },
      });
    },
    true,
  );

  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    post({
      kind: "console",
      ts: Date.now(),
      level: "error",
      summary: truncate(`Uncaught (in promise) ${r instanceof Error ? `${r.name}: ${r.message}` : preview(r)}`),
      payload: { stack: r instanceof Error && r.stack ? truncate(r.stack) : undefined },
    });
  });

  // ============================== fetch ==============================

  async function readBody(res: Response): Promise<{ text?: string; size?: number; truncated?: boolean }> {
    const type = res.headers.get("content-type");
    if (type?.includes("text/event-stream")) return { text: "[event stream — the body is not recorded]" };
    const length = Number(res.headers.get("content-length") ?? NaN);
    if (!isTextual(type)) return { text: `[${type}${Number.isFinite(length) ? `, ${length} B` : ""}]`, size: Number.isFinite(length) ? length : undefined };
    const text = await res.text();
    return { text: truncate(text, MAX_BODY), size: text.length, truncated: text.length > MAX_BODY };
  }

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      const ts = Date.now();
      const started = performance.now();
      const req = input instanceof Request ? input : null;
      const method = String(init?.method ?? req?.method ?? "GET").toUpperCase();
      const url = absolute(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
      const requestHeaders = headersToObject(init?.headers ?? req?.headers);
      const requestBody = bodyToString(init?.body);
      try {
        const res: Response = await originalFetch.call(this as any, input as any, init);
        const duration = Math.round(performance.now() - started);
        const responseHeaders = headersToObject(res.headers);
        readBody(res.clone())
          .catch(() => ({ text: "[the body could not be read]" }) as { text: string; size?: number; truncated?: boolean })
          .then((body) =>
            post({
              kind: "network",
              ts,
              method,
              status: res.status,
              duration,
              summary: `${method} ${shortPath(url)} ${res.status}`,
              payload: {
                url,
                statusText: res.statusText,
                requestHeaders,
                requestBody,
                responseHeaders,
                responseBody: body.text,
                size: body.size,
                truncated: body.truncated || undefined,
                type: "fetch",
              },
            }),
          );
        return res;
      } catch (err) {
        post({
          kind: "network",
          ts,
          method,
          status: 0,
          duration: Math.round(performance.now() - started),
          summary: `${method} ${shortPath(url)} — network error`,
          payload: { url, requestHeaders, requestBody, error: String(err), type: "fetch" },
        });
        throw err;
      }
    } as typeof fetch;
  }

  // ============================== XMLHttpRequest ==============================

  const XHR = XMLHttpRequest.prototype;
  const xOpen = XHR.open as AnyFn;
  const xSend = XHR.send as AnyFn;
  const xSetHeader = XHR.setRequestHeader as AnyFn;

  XHR.open = function (this: any, method: string, url: string | URL, ...rest: unknown[]) {
    this[XHR_KEY] = { method: String(method).toUpperCase(), url: absolute(String(url)), headers: {} as Record<string, string> };
    return xOpen.call(this, method, url, ...rest);
  } as typeof XHR.open;

  XHR.setRequestHeader = function (this: any, name: string, value: string) {
    if (this[XHR_KEY]) this[XHR_KEY].headers[name.toLowerCase()] = value;
    return xSetHeader.call(this, name, value);
  };

  XHR.send = function (this: any, body?: Document | XMLHttpRequestBodyInit | null) {
    const info = this[XHR_KEY];
    if (info) {
      const ts = Date.now();
      const started = performance.now();
      const requestBody = bodyToString(body);
      this.addEventListener("loadend", () => {
        try {
          const responseHeaders: Record<string, string> = {};
          (this.getAllResponseHeaders() as string)
            .trim()
            .split(/[\r\n]+/)
            .forEach((line: string) => {
              const i = line.indexOf(":");
              if (i > 0) responseHeaders[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
            });
          let responseBody: string | undefined;
          const rt = this.responseType as XMLHttpRequestResponseType;
          if (rt === "" || rt === "text") responseBody = isTextual(responseHeaders["content-type"] ?? null) ? truncate(this.responseText ?? "", MAX_BODY) : `[${responseHeaders["content-type"]}]`;
          else if (rt === "json") responseBody = truncate(JSON.stringify(this.response), MAX_BODY);
          else responseBody = `[response of type ${rt}]`;
          const status = this.status as number;
          post({
            kind: "network",
            ts,
            method: info.method,
            status,
            duration: Math.round(performance.now() - started),
            summary: status ? `${info.method} ${shortPath(info.url)} ${status}` : `${info.method} ${shortPath(info.url)} — network error`,
            payload: {
              url: info.url,
              statusText: this.statusText,
              requestHeaders: info.headers,
              requestBody,
              responseHeaders,
              responseBody,
              size: typeof responseBody === "string" ? responseBody.length : undefined,
              error: status ? undefined : "The request failed (network, CORS or cancelled)",
              type: "xhr",
            },
          });
        } catch {
          /* ignore */
        }
      });
    }
    return xSend.call(this, body);
  };

  // ============================== navigation inside SPAs ==============================

  let lastUrl = location.href;
  const navigated = (type: string) => {
    const to = location.href;
    if (to === lastUrl) return;
    const from = lastUrl;
    lastUrl = to;
    post({ kind: "navigation", ts: Date.now(), summary: `Navigated to ${shortPath(to)}`, payload: { from, to, type } });
  };
  for (const m of ["pushState", "replaceState"] as const) {
    const original = history[m] as AnyFn;
    history[m] = function (this: History, ...args: unknown[]) {
      const r = original.apply(this, args);
      navigated(m === "pushState" ? "push" : "replace");
      return r;
    } as any;
  }
  window.addEventListener("popstate", () => navigated("back/forward"));
  // Navigation API — used by modern SPAs (e.g. GitHub) instead of history.pushState
  (window as any).navigation?.addEventListener?.("navigatesuccess", () => navigated("navigation"));
  window.addEventListener("hashchange", () => navigated("hash"));
}
