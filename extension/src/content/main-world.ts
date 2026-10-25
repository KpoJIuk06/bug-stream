/**
 * Script in the page's own context (world: MAIN, document_start).
 * Installs the hooks (shared/page-hooks.ts) and passes events to the extension's isolated script
 * via window.postMessage. Stores nothing and sends nothing itself.
 */

import { installPageHooks, preview, truncate } from "../shared/page-hooks";
import type { CapturedEvent } from "../shared/types";

const TAG = "__adtask";

(() => {
  const w = window as any;

  installPageHooks((event: CapturedEvent) => {
    try {
      window.postMessage({ [TAG]: 1, event }, "*");
    } catch {
      // the object cannot be cloned — send without payload
      window.postMessage({ [TAG]: 1, event: { ...event, payload: undefined } }, "*");
    }
  });

  // ============================== window.adtask — API for a button on the site ==============================
  //
  // Appears only in the top document and only on sites linked to Bug Stream projects
  // (the isolated script decides). The site learns it is ready from the "adtask:ready" event.
  //   adtask.report()               — menu: video / screenshot / last 2 minutes
  //   adtask.record() / screenshot() / replay()
  //   adtask.setContext({userId,…}) — app data, shown on the report's Info tab
  //   adtask.log(message, data?)    — a custom log line (Info tab → "Custom logs")
  //   adtask.isRecording()          — whether recording; changes — the "adtask:state" event
  if (window === window.top) {
    let recording = false;
    let context: Record<string, unknown> = {};
    const call = (cmd: string, data?: unknown) => window.postMessage({ [TAG]: 1, cmd, data }, location.origin);
    const plain = (v: unknown) => {
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
          setContext: (ctx: Record<string, unknown>) => {
            context = { ...context, ...(plain(ctx) as Record<string, unknown>) };
            call("context", context);
          },
          clearContext: () => {
            context = {};
            call("context", context);
          },
          log: (message: unknown, data?: unknown) => call("log", { message: truncate(preview(message)), data: plain(data) }),
          isRecording: () => recording,
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
