"use strict";
(() => {
  // src/core/page-hooks.ts
  var MAX_BODY = 256 * 1024;
  var MAX_STRING = 4e3;
  var XHR_KEY = "__adtaskXhr" + Math.random().toString(36).slice(2, 7);
  var truncate = (s, max = MAX_STRING) => s.length > max ? s.slice(0, max) + "…" : s;
  function preview(v, depth = 0, seen = /* @__PURE__ */ new WeakSet()) {
    if (v === null) return "null";
    if (v === void 0) return "undefined";
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
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (depth >= 3) return Array.isArray(v) ? `Array(${v.length})` : "{…}";
      if (Array.isArray(v)) {
        const items = v.slice(0, 30).map((x) => preview(x, depth + 1, seen));
        return `[${items.join(", ")}${v.length > 30 ? ", …" : ""}]`;
      }
      try {
        const entries = Object.entries(v).slice(0, 30);
        return `{${entries.map(([k, x]) => `${k}: ${preview(x, depth + 1, seen)}`).join(", ")}${entries.length === 30 ? ", …" : ""}}`;
      } catch {
        return Object.prototype.toString.call(v);
      }
    }
    return String(v);
  }
  var absolute = (url) => {
    try {
      return new URL(url, location.href).href;
    } catch {
      return url;
    }
  };
  var shortPath = (url) => {
    try {
      const u = new URL(url);
      return u.origin === location.origin ? u.pathname + u.search : u.host + u.pathname + u.search;
    } catch {
      return url;
    }
  };
  function headersToObject(h) {
    const out = {};
    if (!h) return out;
    try {
      if (h instanceof Headers) h.forEach((v, k) => out[k] = v);
      else if (Array.isArray(h)) for (const [k, v] of h) out[String(k).toLowerCase()] = String(v);
      else for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
    } catch {
    }
    return out;
  }
  function bodyToString(body) {
    if (body == null) return void 0;
    if (typeof body === "string") return truncate(body, MAX_BODY);
    if (body instanceof URLSearchParams) return truncate(body.toString(), MAX_BODY);
    if (body instanceof FormData) {
      const parts = [];
      body.forEach((v, k) => parts.push(`${k}=${typeof v === "string" ? v : `[file ${v.name}, ${v.size} B]`}`));
      return truncate(parts.join("\n"), MAX_BODY);
    }
    if (body instanceof Blob) return `[Blob ${body.type || "no type"}, ${body.size} B]`;
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return `[binary data, ${body.byteLength} B]`;
    return truncate(preview(body), MAX_BODY);
  }
  var isTextual = (contentType) => !contentType || /json|text|xml|javascript|x-www-form-urlencoded|graphql|html/i.test(contentType);
  function installPageHooks(sink, ignoreUrl, flag = "__adtaskHooked") {
    const w = window;
    if (w[flag]) return;
    w[flag] = true;
    const post = (event) => {
      if (event.kind === "network" && ignoreUrl?.(String(event.payload?.url ?? ""))) return;
      sink(event);
    };
    const levels = { log: "log", info: "info", warn: "warn", error: "error", debug: "debug" };
    for (const method of Object.keys(levels)) {
      const original = console[method];
      if (typeof original !== "function") continue;
      console[method] = function(...args) {
        try {
          const err = args.find((a) => a instanceof Error);
          let stack = err?.stack;
          if (!stack && method === "error") stack = new Error().stack?.split("\n").slice(2).join("\n");
          post({
            kind: "console",
            ts: Date.now(),
            level: levels[method],
            summary: truncate(args.map((a) => preview(a)).join(" ")),
            payload: {
              ...args.length > 1 || typeof args[0] === "object" ? { args: args.slice(0, 10).map((a) => truncate(preview(a), 2e3)) } : {},
              ...stack ? { stack: truncate(stack) } : {}
            }
          });
        } catch {
        }
        return original.apply(this, args);
      };
    }
    window.addEventListener(
      "error",
      (e) => {
        const target = e.target;
        if (target && target !== window && "tagName" in target) {
          const src = target.src || target.href || "";
          if (!src) return;
          post({
            kind: "network",
            ts: Date.now(),
            method: "GET",
            status: 0,
            summary: `GET ${shortPath(src)} — ${target.tagName.toLowerCase()} failed to load`,
            payload: { url: src, error: `Could not load <${target.tagName.toLowerCase()}>`, type: "resource" }
          });
          return;
        }
        const ev = e;
        post({
          kind: "console",
          ts: Date.now(),
          level: "error",
          summary: truncate(`Uncaught ${ev.error instanceof Error ? `${ev.error.name}: ${ev.error.message}` : ev.message}`),
          payload: {
            stack: ev.error?.stack ? truncate(ev.error.stack) : void 0,
            source: ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : void 0
          }
        });
      },
      true
    );
    window.addEventListener("unhandledrejection", (e) => {
      const r = e.reason;
      post({
        kind: "console",
        ts: Date.now(),
        level: "error",
        summary: truncate(`Uncaught (in promise) ${r instanceof Error ? `${r.name}: ${r.message}` : preview(r)}`),
        payload: { stack: r instanceof Error && r.stack ? truncate(r.stack) : void 0 }
      });
    });
    async function readBody(res) {
      const type = res.headers.get("content-type");
      if (type?.includes("text/event-stream")) return { text: "[event stream — the body is not recorded]" };
      const length = Number(res.headers.get("content-length") ?? NaN);
      if (!isTextual(type)) return { text: `[${type}${Number.isFinite(length) ? `, ${length} B` : ""}]`, size: Number.isFinite(length) ? length : void 0 };
      const text = await res.text();
      return { text: truncate(text, MAX_BODY), size: text.length, truncated: text.length > MAX_BODY };
    }
    const originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = async function(input, init) {
        const ts = Date.now();
        const started = performance.now();
        const req = input instanceof Request ? input : null;
        const method = String(init?.method ?? req?.method ?? "GET").toUpperCase();
        const url = absolute(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
        const requestHeaders = headersToObject(init?.headers ?? req?.headers);
        const requestBody = bodyToString(init?.body);
        try {
          const res = await originalFetch.call(this, input, init);
          const duration = Math.round(performance.now() - started);
          const responseHeaders = headersToObject(res.headers);
          readBody(res.clone()).catch(() => ({ text: "[the body could not be read]" })).then(
            (body) => post({
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
                truncated: body.truncated || void 0,
                type: "fetch"
              }
            })
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
            payload: { url, requestHeaders, requestBody, error: String(err), type: "fetch" }
          });
          throw err;
        }
      };
    }
    const XHR = XMLHttpRequest.prototype;
    const xOpen = XHR.open;
    const xSend = XHR.send;
    const xSetHeader = XHR.setRequestHeader;
    XHR.open = function(method, url, ...rest) {
      this[XHR_KEY] = { method: String(method).toUpperCase(), url: absolute(String(url)), headers: {} };
      return xOpen.call(this, method, url, ...rest);
    };
    XHR.setRequestHeader = function(name, value) {
      if (this[XHR_KEY]) this[XHR_KEY].headers[name.toLowerCase()] = value;
      return xSetHeader.call(this, name, value);
    };
    XHR.send = function(body) {
      const info = this[XHR_KEY];
      if (info) {
        const ts = Date.now();
        const started = performance.now();
        const requestBody = bodyToString(body);
        this.addEventListener("loadend", () => {
          try {
            const responseHeaders = {};
            this.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((line) => {
              const i = line.indexOf(":");
              if (i > 0) responseHeaders[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
            });
            let responseBody;
            const rt = this.responseType;
            if (rt === "" || rt === "text") responseBody = isTextual(responseHeaders["content-type"] ?? null) ? truncate(this.responseText ?? "", MAX_BODY) : `[${responseHeaders["content-type"]}]`;
            else if (rt === "json") responseBody = truncate(JSON.stringify(this.response), MAX_BODY);
            else responseBody = `[response of type ${rt}]`;
            const status = this.status;
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
                size: typeof responseBody === "string" ? responseBody.length : void 0,
                error: status ? void 0 : "The request failed (network, CORS or cancelled)",
                type: "xhr"
              }
            });
          } catch {
          }
        });
      }
      return xSend.call(this, body);
    };
    let lastUrl = location.href;
    const navigated = (type) => {
      const to = location.href;
      if (to === lastUrl) return;
      const from = lastUrl;
      lastUrl = to;
      post({ kind: "navigation", ts: Date.now(), summary: `Navigated to ${shortPath(to)}`, payload: { from, to, type } });
    };
    for (const m of ["pushState", "replaceState"]) {
      const original = history[m];
      history[m] = function(...args) {
        const r = original.apply(this, args);
        navigated(m === "pushState" ? "push" : "replace");
        return r;
      };
    }
    window.addEventListener("popstate", () => navigated("back/forward"));
    window.navigation?.addEventListener?.("navigatesuccess", () => navigated("navigation"));
    window.addEventListener("hashchange", () => navigated("hash"));
  }

  // src/content/main-world.ts
  var TAG = "__adtask";
  (() => {
    const w = window;
    installPageHooks((event) => {
      try {
        window.postMessage({ [TAG]: 1, event }, "*");
      } catch {
        window.postMessage({ [TAG]: 1, event: { ...event, payload: void 0 } }, "*");
      }
    });
    if (window === window.top) {
      let recording = false;
      let context = {};
      const call = (cmd, data) => window.postMessage({ [TAG]: 1, cmd, data }, location.origin);
      const plain = (v) => {
        try {
          return JSON.parse(JSON.stringify(v ?? null));
        } catch {
          return truncate(preview(v));
        }
      };
      window.addEventListener("message", (e) => {
        if (e.source !== window || !e.data || e.data[TAG] !== 1) return;
        if (e.data.enable && !w.adtask) {
          const api = Object.freeze({
            version: String(e.data.enable.version),
            report: () => call("report"),
            record: () => call("record"),
            screenshot: () => call("screenshot"),
            replay: () => call("replay"),
            setContext: (ctx) => {
              context = { ...context, ...plain(ctx) };
              call("context", context);
            },
            clearContext: () => {
              context = {};
              call("context", context);
            },
            log: (message, data) => call("log", { message: truncate(preview(message)), data: plain(data) }),
            isRecording: () => recording
          });
          Object.defineProperty(window, "adtask", { value: api, configurable: true, writable: true, enumerable: false });
          window.dispatchEvent(new CustomEvent("adtask:ready", { detail: { version: api.version } }));
        }
        if (e.data.state) {
          recording = !!e.data.state.recording;
          window.dispatchEvent(new CustomEvent("adtask:state", { detail: { recording } }));
        }
      });
    }
  })();
})();
