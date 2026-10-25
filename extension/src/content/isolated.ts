/**
 * Isolated script of the Bug Stream extension. Runs in the page and in all its iframes.
 *  - receives events from main-world.ts (console, network, navigation);
 *  - records user actions itself: clicks, input, form submits, Enter/Escape;
 *  - keeps a buffer of recent events (for screenshots and instant replay), forwards events while recording;
 *  - reports user activity and tab hiding — for auto-pause;
 *  - top document only: page info (Info), recording bar, instant replay (rrweb).
 */

import { initI18n, t } from "../shared/i18n";
import { getPrefs } from "../shared/prefs";
import { collectInfo, installActionCapture } from "../shared/page-actions";
import { currentElapsed, type CapturedEvent, type Clock, type Message, type Prefs } from "../shared/types";

const TAG = "__adtask";
const BUFFER_MS = 5 * 60 * 1000;
const BUFFER_MAX = 1500;
const ACTIVITY_THROTTLE_MS = 3000;

const w = window as any;
const isTop = window === window.top;

if (!w[TAG + "Isolated"]) {
  w[TAG + "Isolated"] = true;
  if (isTop) void initI18n();
  init();
}

function init() {
  let recording = false;
  const buffer: CapturedEvent[] = [];
  const frame = isTop ? undefined : location.href;

  const send = (msg: Message) => chrome.runtime.sendMessage(msg).catch(() => {});

  // Duplicate guard: the same event (type + text + element) is not written again within a short window.
  // Navigations to the same address are merged within 5 seconds (a site may reload itself after navigating).
  const recent = new Map<string, number>();
  function isDuplicate(event: CapturedEvent): boolean {
    if (event.kind !== "action" && event.kind !== "navigation") return false;
    const key =
      event.kind === "navigation"
        ? `nav|${String(event.payload?.to ?? "").replace(/#.*$/, "")}`
        : `act|${event.level}|${event.summary}|${event.payload?.selector ?? ""}`;
    const window = event.kind === "navigation" ? 5000 : 700;
    const prev = recent.get(key);
    recent.set(key, event.ts);
    if (recent.size > 200) recent.delete(recent.keys().next().value!);
    return prev != null && event.ts - prev < window;
  }

  function handle(event: CapturedEvent) {
    if (isDuplicate(event)) return;
    // Events from iframes are tagged with the frame address — the site shows where they came from
    if (frame) event = { ...event, payload: { ...event.payload, frame } };
    buffer.push(event);
    const cutoff = Date.now() - BUFFER_MS;
    while (buffer.length > BUFFER_MAX || (buffer.length && buffer[0].ts < cutoff)) buffer.shift();
    if (recording) send({ type: "bt:event", event });
  }

  // Application data from the site (window.adtask.setContext) — goes into the report as a separate event
  let appContext: Record<string, unknown> = {};
  const contextEvent = (): CapturedEvent => ({
    kind: "custom",
    ts: Date.now(),
    level: "info",
    summary: "App context: " + Object.entries(appContext).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ").slice(0, 300),
    payload: { type: "app-context", context: appContext },
  });
  const hasContext = () => Object.keys(appContext).length > 0;

  // Access for the service worker (chrome.scripting.executeScript in the same isolated world)
  w.__adtaskBuffer = () => (hasContext() ? [...buffer, contextEvent()] : buffer.slice());
  if (isTop) w.__adtaskInfo = () => collectInfo();

  // ----------------------------- events from the MAIN world -----------------------------

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[TAG] !== 1) return;
    if (e.data.event) handle(e.data.event as CapturedEvent);
    else if (e.data.cmd && isTop && apiAllowed) onPageCommand(String(e.data.cmd), e.data.data);
  });

  // ----------------------------- window.adtask: commands from the page -----------------------------

  let apiAllowed = false;
  const postToPage = (data: Record<string, unknown>) => window.postMessage({ [TAG]: 1, ...data }, location.origin);

  function onPageCommand(cmd: string, data: unknown) {
    switch (cmd) {
      case "report":
        showActionMenu(recording);
        break;
      case "record":
      case "screenshot":
      case "replay":
        pageCommand(cmd);
        break;
      case "context":
        appContext = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
        if (recording && hasContext()) handle(contextEvent());
        break;
      case "log": {
        const d = (data ?? {}) as { message?: string; data?: unknown };
        handle({ kind: "custom", ts: Date.now(), level: "info", summary: String(d.message ?? ""), payload: { type: "log", data: d.data ?? undefined } });
        break;
      }
    }
  }

  // The API is enabled only on sites linked to Bug Stream projects (service URL patterns)
  if (isTop) {
    chrome.runtime
      .sendMessage({ type: "bt:api-allowed?" } satisfies Message)
      .then((r: { allowed: boolean } | undefined) => {
        if (!r?.allowed) return;
        apiAllowed = true;
        postToPage({ enable: { version: chrome.runtime.getManifest().version } });
        if (recording) postToPage({ state: { recording: true } });
      })
      .catch(() => {});
  }

  // ----------------------------- activity (for auto-pause) -----------------------------

  let lastActivitySent = 0;
  const activity = () => {
    if (!recording) return;
    const now = Date.now();
    if (now - lastActivitySent < ACTIVITY_THROTTLE_MS) return;
    lastActivitySent = now;
    send({ type: "bt:activity" });
  };
  for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart", "input"]) {
    window.addEventListener(type, activity, { capture: true, passive: true });
  }
  if (isTop) {
    // When navigating to another page the old one also becomes "hidden" — this is not leaving the tab.
    // So hiding is reported after 1.5 s: if the page is unloading, the timer simply never fires.
    let hideTimer = 0;
    let unloading = false;
    window.addEventListener("pagehide", () => (unloading = true));
    window.addEventListener("pageshow", () => (unloading = false));
    document.addEventListener("visibilitychange", () => {
      if (!recording) return;
      clearTimeout(hideTimer);
      if (document.visibilityState === "hidden") {
        if (unloading) return;
        hideTimer = window.setTimeout(() => {
          if (recording && document.visibilityState === "hidden") send({ type: "bt:visibility", hidden: true });
        }, 1500);
      } else {
        send({ type: "bt:visibility", hidden: false });
      }
    });
  }

  // ----------------------------- user actions -----------------------------

  installActionCapture(handle, (el) => !!el?.closest?.("adtask-recorder"));

  // ----------------------------- messages from the extension -----------------------------

  const startRecording = (clock: Clock, kind: "start" | "load") => {
    recording = true;
    lastActivitySent = 0;
    if (!isTop) return;
    collectInfo().then((info) => send({ type: "bt:info", info }));
    if (hasContext()) handle(contextEvent());
    if (apiAllowed) postToPage({ state: { recording: true } });
    handle({
      kind: "navigation",
      ts: Date.now(),
      summary: kind === "start" ? `Recording started on ${location.pathname}${location.search}` : `Page loaded ${location.pathname}${location.search}`,
      payload: { to: location.href, type: kind },
    });
    // The new page reports whether it is visible — this lifts the "tab hidden" pause after navigation
    send({ type: "bt:visibility", hidden: document.visibilityState === "hidden" });
    const show = () => showRecorder(clock);
    if (document.body) show();
    else document.addEventListener("DOMContentLoaded", show, { once: true });
  };

  chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      case "bt:ping":
        sendResponse({ ok: true });
        return false;
      case "bt:start":
        startRecording(msg.clock, "start");
        sendResponse({ ok: true });
        return false;
      case "bt:clock":
        if (isTop) updateRecorder(msg.clock);
        return false;
      case "bt:stop":
        recording = false;
        if (isTop) hideRecorder();
        if (isTop && apiAllowed) postToPage({ state: { recording: false } });
        sendResponse({ ok: true });
        return false;
    }
    return false;
  });

  // After a page reload (or a new iframe) during recording — continue
  chrome.runtime
    .sendMessage({ type: "bt:state?" } satisfies Message)
    .then((state: { recording: boolean; clock: Clock | null } | undefined) => {
      if (state?.recording && state.clock) startRecording(state.clock, "load");
    })
    .catch(() => {});

  if (isTop) void setupInstantReplay();
}

// ============================== instant replay ==============================

/**
 * The DOM recorder (rrweb, ~170 KB) is not loaded on every page: the service worker injects it
 * into the top document only, and only when instant replay is enabled for this site.
 */
async function setupInstantReplay() {
  const enabled = (p: Prefs) => p.instantReplay && !p.replayExcluded.includes(location.origin);
  let requested = false;
  const maybeInject = (p: Prefs) => {
    if (requested || !enabled(p)) return;
    requested = true;
    chrome.runtime.sendMessage({ type: "bt:replay-inject" } satisfies Message).catch(() => (requested = false));
  };
  maybeInject(await getPrefs());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.prefs) void getPrefs().then(maybeInject);
  });
}

// ============================== recording bar ==============================

let recorderHost: HTMLElement | null = null;
let barClock: Clock | null = null;
let timer = 0;
let ui: { bar: HTMLElement; time: HTMLElement; state: HTMLElement; pause: HTMLButtonElement } | null = null;

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PAUSE_TEXT: Record<string, string> = {
  idle: "Paused — no activity. Resumes when you come back",
  hidden: "Paused — tab hidden",
  manual: "Paused",
};

function showRecorder(clock: Clock) {
  barClock = clock;
  if (recorderHost) return updateRecorder(clock);
  recorderHost = document.createElement("adtask-recorder");
  const root = recorderHost.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .bar { position: fixed; z-index: 2147483647; left: 50%; bottom: 20px; transform: translateX(-50%);
        display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 14px; border-radius: 999px;
        background: #18202c; color: #fff; font: 500 13px/1 system-ui, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px -8px rgba(0,0,0,.45); user-select: none; max-width: calc(100vw - 32px); }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: #ff5d68; animation: pulse 1.2s ease-in-out infinite; flex: none; }
      .paused .dot { background: #8a94a3; animation: none; }
      @keyframes pulse { 50% { opacity: .35; } }
      @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
      .time { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .time small { color: rgba(255,255,255,.5); font-size: 11px; }
      .state { color: #ffd479; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .state:empty { display: none; }
      button { all: unset; cursor: pointer; height: 28px; padding: 0 12px; border-radius: 999px; font-weight: 500; white-space: nowrap; }
      .pause { color: #fff; background: rgba(255,255,255,.12); }
      .pause:hover { background: rgba(255,255,255,.2); }
      .stop { background: #fff; color: #18202c; display: inline-flex; align-items: center; gap: 6px; }
      .stop::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: #d1343e; }
      .stop:hover { background: #e9edf2; }
      .cancel { color: rgba(255,255,255,.7); }
      .cancel:hover { color: #fff; background: rgba(255,255,255,.1); }
      button:focus-visible { outline: 2px solid #5fd0c6; outline-offset: 2px; }
    </style>
    <div class="bar" role="toolbar" aria-label="${t("Bug Stream recording")}">
      <span class="dot" aria-hidden="true"></span>
      <span class="time">0:00</span>
      <span class="state" aria-live="polite"></span>
      <button class="pause" title="${t("Pause (no video is written, the timer stops)")}">${t("Pause")}</button>
      <button class="stop" title="${t("Stop recording and open the report")}">${t("Stop")}</button>
      <button class="cancel" title="${t("Stop without saving")}">${t("Cancel")}</button>
    </div>`;
  ui = {
    bar: root.querySelector(".bar") as HTMLElement,
    time: root.querySelector(".time") as HTMLElement,
    state: root.querySelector(".state") as HTMLElement,
    pause: root.querySelector(".pause") as HTMLButtonElement,
  };
  ui.pause.addEventListener("click", () =>
    chrome.runtime.sendMessage({ type: "bt:pause-request", pause: !!barClock?.runningSince } satisfies Message),
  );
  root.querySelector(".stop")!.addEventListener("click", () => chrome.runtime.sendMessage({ type: "bt:stop-request" } satisfies Message));
  root.querySelector(".cancel")!.addEventListener("click", () => {
    if (confirm(t("Stop recording without saving?"))) chrome.runtime.sendMessage({ type: "bt:stop-request", cancel: true } satisfies Message);
  });
  (document.body ?? document.documentElement).appendChild(recorderHost);
  timer = window.setInterval(tick, 500);
  updateRecorder(clock);
}

function tick() {
  if (!ui || !barClock) return;
  ui.time.innerHTML = `${fmt(currentElapsed(barClock))} <small>/ ${fmt(barClock.maxMs)}</small>`;
}

function updateRecorder(clock: Clock) {
  barClock = clock;
  if (!ui) return;
  const paused = !clock.runningSince;
  ui.bar.classList.toggle("paused", paused);
  ui.state.textContent = paused ? t(PAUSE_TEXT[clock.pauseReason ?? "manual"]) : "";
  ui.pause.textContent = paused ? t("Resume") : t("Pause");
  tick();
}

function hideRecorder() {
  clearInterval(timer);
  recorderHost?.remove();
  recorderHost = null;
  ui = null;
  barClock = null;
}

// ============================== site button menu (window.adtask.report) ==============================

let menuHost: HTMLElement | null = null;

function closeActionMenu() {
  menuHost?.remove();
  menuHost = null;
}

async function showActionMenu(recording: boolean) {
  if (menuHost) return closeActionMenu();
  const prefs = await getPrefs();
  const replayOn = prefs.instantReplay && !prefs.replayExcluded.includes(location.origin);

  menuHost = document.createElement("adtask-recorder"); // same tag: menu actions do not get into the report
  const root = menuHost.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .backdrop { position: fixed; inset: 0; z-index: 2147483646; background: rgba(24,32,44,.18); }
      .menu { position: fixed; z-index: 2147483647; top: 64px; right: 24px; width: 300px; max-width: calc(100vw - 32px);
        background: #fff; color: #18202c; border: 1px solid #dce1e8; border-radius: 10px; padding: 8px;
        font: 14px/1.4 system-ui, "Segoe UI", sans-serif; box-shadow: 0 16px 40px -12px rgba(24,32,44,.35); }
      h2 { margin: 4px 8px 8px; font-size: 13px; font-weight: 600; color: #5b6676; }
      button { all: unset; box-sizing: border-box; display: flex; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 7px; cursor: pointer; }
      button:hover:not([disabled]) { background: #f3f5f8; }
      button:focus-visible { outline: 2px solid #0d6e6e; outline-offset: -2px; }
      button[disabled] { cursor: default; opacity: .55; }
      .ic { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; color: #fff; }
      b { display: block; font-weight: 500; }
      small { display: block; margin-top: 1px; font-size: 12px; color: #8a94a3; }
    </style>
    <div class="backdrop"></div>
    <div class="menu" role="menu" aria-label="Bug Stream">
      <h2>${t("Report a bug")}</h2>
      ${
        recording
          ? `<button data-cmd="stop" role="menuitem"><span class="ic" style="background:#d1343e">■</span><span><b>${t("Stop recording")}</b><small>${t("and open the report")}</small></span></button>`
          : `<button data-cmd="record" role="menuitem"><span class="ic" style="background:#d1343e">●</span><span><b>${t("Record video")}</b><small>${t("Chrome will ask which tab to record — choose this one and press “Share”")}</small></span></button>`
      }
      <button data-cmd="screenshot" role="menuitem"><span class="ic" style="background:#2b6cb0">▣</span><span><b>${t("Screenshot")}</b><small>${t("with console and network of the last minutes")}</small></span></button>
      <button data-cmd="replay" role="menuitem" ${replayOn ? "" : "disabled"}><span class="ic" style="background:#6b46c1">↺</span><span><b>${t("Last 2 minutes")}</b><small>${replayOn ? t("what happened on the page up to now") : t("turn on instant replay in the extension settings")}</small></span></button>
    </div>`;
  root.querySelector(".backdrop")!.addEventListener("click", closeActionMenu);
  root.querySelectorAll<HTMLButtonElement>("button[data-cmd]").forEach((b) =>
    b.addEventListener("click", () => {
      const cmd = b.dataset.cmd!;
      closeActionMenu();
      if (cmd === "stop") chrome.runtime.sendMessage({ type: "bt:stop-request" } satisfies Message).catch(() => {});
      else pageCommand(cmd as "record" | "screenshot" | "replay");
    }),
  );
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeActionMenu();
      document.removeEventListener("keydown", onKey, true);
    }
  };
  document.addEventListener("keydown", onKey, true);
  (document.body ?? document.documentElement).appendChild(menuHost);
  root.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
}

/** Site button command → extension; errors are shown on the page (the site button has no popup). */
function pageCommand(cmd: "record" | "screenshot" | "replay") {
  chrome.runtime
    .sendMessage({ type: "bt:page-command", cmd } satisfies Message)
    .then((r: { error?: string } | undefined) => r?.error && showToast(r.error))
    .catch(() => showToast(t("The Bug Stream extension is unavailable — reload the page")));
}

function showToast(text: string) {
  const host = document.createElement("adtask-recorder");
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>:host{all:initial}div{position:fixed;z-index:2147483647;top:20px;left:50%;transform:translateX(-50%);
    max-width:calc(100vw - 32px);padding:10px 14px;border-radius:8px;background:#18202c;color:#fff;
    font:13px/1.4 system-ui,"Segoe UI",sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.45)}</style><div role="status"></div>`;
  root.querySelector("div")!.textContent = "Bug Stream: " + text;
  (document.body ?? document.documentElement).appendChild(host);
  setTimeout(() => host.remove(), 5000);
}
