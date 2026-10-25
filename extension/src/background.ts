/**
 * Service worker of the Bug Stream extension: controls recording.
 *   start:  settings + project network filter → tabCapture → offscreen writes the video to disk → tab gets "recording"
 *   pause:  button on the bar / in the popup or auto-pause (offscreen) → timer and badge are updated
 *   stop:   offscreen closes the recording in IndexedDB → the preview page opens
 *   replay: last 2 minutes of the page DOM recording (instant replay) → preview
 * State lives in chrome.storage.session: Chrome may unload the service worker during recording.
 */

import { resolveProject } from "./shared/api";
import { initI18n, t } from "./shared/i18n";
import { cleanupOldRecordings, putRecording, recoverInterrupted } from "./shared/db";
import { filterNetwork, getPrefs } from "./shared/prefs";
import { IDLE_STATE, REPLAY_WINDOW_MS, type CapturedEvent, type Clock, type Message, type PageInfo, type RecordingState } from "./shared/types";

async function getState(): Promise<RecordingState> {
  const { state } = await chrome.storage.session.get({ state: IDLE_STATE });
  return { ...IDLE_STATE, ...(state as RecordingState) };
}

const setState = (state: RecordingState) => chrome.storage.session.set({ state });

void initI18n();

const errorOf = (e: unknown) => String((e as Error)?.message ?? e);

// ----------------------------- messages -----------------------------

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  switch (msg.type) {
    case "bt:start-request":
      startRecording(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    case "bt:stop-request":
      stopRecording(!!msg.cancel).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    case "bt:pause-request":
      setPaused(msg.pause).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    case "bt:screenshot-request":
      takeScreenshot(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    case "bt:replay-request":
      saveReplay(msg.tabId).then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    case "bt:state?":
      getState().then((s) => {
        const mine = s.status === "recording" && sender.tab?.id === s.tabId;
        sendResponse({ recording: mine, clock: mine ? clockOf(s) : null });
      });
      return true;
    case "bt:replay-inject":
      // instant replay: rrweb into the top document only, and only on request of the page itself
      if (sender.tab?.id != null && sender.frameId === 0) {
        void chrome.scripting
          .executeScript({ target: { tabId: sender.tab.id, frameIds: [0] }, files: ["content-replay.js"] })
          .catch(() => {});
      }
      return false;
    case "bt:api-allowed?":
      apiAllowed(sender.tab?.url).then((allowed) => sendResponse({ allowed }), () => sendResponse({ allowed: false }));
      return true;
    case "bt:page-command": {
      // Site button (window.adtask) — only from the top document of an allowed site
      const tab = sender.tab;
      if (tab?.id == null || sender.frameId !== 0) return false;
      const tabId = tab.id;
      apiAllowed(tab.url)
        .then((ok): Promise<unknown> => {
          if (!ok) throw new Error(t("This site is not linked to a Bug Stream project"));
          if (msg.cmd === "record") return startRecording(tabId, "desktop");
          if (msg.cmd === "screenshot") return takeScreenshot(tabId);
          return saveReplay(tabId);
        })
        .then(sendResponse, (e) => sendResponse({ error: errorOf(e) }));
      return true;
    }
    case "bt:offscreen-clock":
      void onClock(msg.clock);
      return false;
    case "bt:offscreen-auto-stop":
      void stopRecording(false);
      return false;
  }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (command === "toggle-recording") {
    const state = await getState();
    if (state.status === "recording") return void (await stopRecording(false));
    if (tab?.id) await startRecording(tab.id).catch((e) => console.warn("Bug Stream: could not start recording", e));
  } else if (command === "save-replay") {
    if (tab?.id) await saveReplay(tab.id).catch((e) => console.warn("Bug Stream: could not save the replay", e));
  }
});

// The recorded tab was closed — save what has been recorded
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getState();
  if (state.status === "recording" && state.tabId === tabId) await stopRecording(false);
});

chrome.runtime.onStartup.addListener(() => void housekeeping(true));
chrome.runtime.onInstalled.addListener(() => void housekeeping(false));

/** After the browser starts: recordings interrupted by a crash become regular ones — they can be opened from the popup. */
async function housekeeping(browserStarted: boolean) {
  if (browserStarted) await setState(IDLE_STATE);
  const state = await getState();
  const active = state.status !== "idle" && (await hasOffscreen()) ? state.recordingId : null;
  if (!active && state.status !== "idle") await setState(IDLE_STATE);
  const recovered = await recoverInterrupted((id) => id === active).catch(() => []);
  await cleanupOldRecordings().catch(() => {});
  if (recovered.length) {
    await chrome.action.setBadgeBackgroundColor({ color: "#0d6e6e" });
    await chrome.action.setBadgeText({ text: String(recovered.length) });
  }
}

// ----------------------------- recording -----------------------------

const clockOf = (s: RecordingState): Clock => ({ elapsedMs: s.elapsedMs, runningSince: s.runningSince, pauseReason: s.pauseReason, maxMs: s.maxMs });

/**
 * window.adtask is enabled only on sites linked to a Bug Stream project (service URL patterns).
 * The answer is cached for 10 minutes per site origin.
 */
async function apiAllowed(url: string | undefined): Promise<boolean> {
  if (!url || !/^https?:/.test(url)) return false;
  const origin = new URL(url).origin;
  const key = "api:" + origin;
  const cached = (await chrome.storage.session.get(key))[key] as { allowed: boolean; at: number } | undefined;
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.allowed;
  const project = await resolveProject(url);
  const allowed = !!project?.matched;
  await chrome.storage.session.set({ [key]: { allowed, at: Date.now() } });
  return allowed;
}

async function startRecording(tabId: number, source: "tab" | "desktop" = "tab") {
  const state = await getState();
  if (state.status !== "idle") {
    // A "stuck" status is left (e.g. offscreen crashed) — reset it
    if (!(await hasOffscreen())) await setState(IDLE_STATE);
    else throw new Error(t("Recording is already running"));
  }

  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("This page cannot be recorded — open a site (http or https)."));

  // getMediaStreamId must be called right after the user gesture — before any network requests.
  // From the site button the extension is not "invoked" — then offscreen asks via the Chrome picker itself.
  const streamId = source === "tab" ? await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }) : "";
  await setState({ ...IDLE_STATE, status: "starting", tabId });

  try {
    const [prefs, project] = await Promise.all([getPrefs(), resolveProject(tab.url)]);
    await ensureContentScripts(tabId);
    await ensureOffscreen();
    const recordingId = crypto.randomUUID();
    const maxMs = prefs.maxMinutes * 60_000;
    const res: { ok?: boolean; startTs?: number; clock?: Clock; error?: string } = await chrome.runtime.sendMessage({
      type: "bt:offscreen-start",
      target: "offscreen",
      streamId,
      recordingId,
      tabId,
      maxMs,
      idleMs: prefs.autoPause ? prefs.idleSeconds * 1000 : null,
      networkIgnore: project?.networkIgnore ?? [],
      source,
    } satisfies Message);
    if (!res?.ok || !res.startTs || !res.clock) throw new Error(res?.error ?? t("Could not start recording"));

    const next: RecordingState = { ...IDLE_STATE, status: "recording", tabId, recordingId, startTs: res.startTs, ...res.clock };
    await setState(next);
    // no frameId — all frames of the tab get the message: events from iframes are recorded too
    await chrome.tabs.sendMessage(tabId, { type: "bt:start", clock: res.clock } satisfies Message).catch(() => {});
    await setBadge(next);
    return { ok: true, startTs: res.startTs };
  } catch (e) {
    await setState(IDLE_STATE);
    await closeOffscreen();
    throw e;
  }
}

async function setPaused(pause: boolean) {
  const state = await getState();
  if (state.status !== "recording") return { ok: false };
  await chrome.runtime.sendMessage({ type: "bt:offscreen-pause", target: "offscreen", pause, reason: "manual" } satisfies Message);
  return { ok: true };
}

/** Offscreen reported pause / resume — update the state, the bar on the page and the badge. */
async function onClock(clock: Clock) {
  const state = await getState();
  if (state.status !== "recording") return;
  const next = { ...state, ...clock };
  await setState(next);
  await setBadge(next);
  if (state.tabId != null) {
    await chrome.tabs.sendMessage(state.tabId, { type: "bt:clock", clock } satisfies Message, { frameId: 0 }).catch(() => {});
  }
}

async function setBadge(s: RecordingState) {
  const paused = s.status === "recording" && !s.runningSince;
  await chrome.action.setBadgeBackgroundColor({ color: paused ? "#8a94a3" : "#d1343e" });
  await chrome.action.setBadgeText({ text: s.status === "recording" ? (paused ? "II" : "REC") : "" });
}

async function stopRecording(cancel: boolean) {
  const state = await getState();
  if (state.status !== "recording" && state.status !== "starting") return { ok: false };
  await setState({ ...state, status: "stopping" });
  if (state.tabId != null) await chrome.tabs.sendMessage(state.tabId, { type: "bt:stop" } satisfies Message).catch(() => {});
  await chrome.action.setBadgeText({ text: "" });

  let recordingId: string | null = null;
  let error: string | undefined;
  try {
    const res: { recordingId: string | null; error?: string } = await chrome.runtime.sendMessage({
      type: "bt:offscreen-stop",
      target: "offscreen",
      cancel,
    } satisfies Message);
    recordingId = res?.recordingId ?? null;
    error = res?.error;
    if (error) console.warn("adtask:", error);
  } finally {
    await closeOffscreen();
    await setState(IDLE_STATE);
  }

  if (!cancel && recordingId) await openPreview(recordingId, state.tabId);
  if (error) throw new Error(error);
  return { ok: true, recordingId };
}

// ----------------------------- screenshot and instant replay -----------------------------

/** Event buffer from all frames of the tab (page and its iframes). */
async function collectBuffers(tabId: number): Promise<CapturedEvent[]> {
  const results = await chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      func: () => ((globalThis as any).__adtaskBuffer?.() ?? []) as CapturedEvent[],
    })
    .catch(() => []);
  return results.flatMap((r) => (r.result as CapturedEvent[] | undefined) ?? []).sort((a, b) => a.ts - b.ts);
}

async function collectInfo(tabId: number): Promise<PageInfo | null> {
  const [r] = await chrome.scripting
    .executeScript({ target: { tabId, frameIds: [0] }, func: () => (globalThis as any).__adtaskInfo?.() ?? null })
    .catch(() => []);
  return (r?.result as PageInfo | null) ?? null;
}

async function takeScreenshot(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("This page cannot be captured — open a site (http or https)."));
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const screenshot = await (await fetch(dataUrl)).blob();
  await ensureContentScripts(tabId);

  // Events of the last minutes — console and network up to the screenshot
  const [buffer, info, project] = await Promise.all([collectBuffers(tabId), collectInfo(tabId), resolveProject(tab.url)]);
  const events = filterNetwork(buffer, project?.networkIgnore ?? []);
  const now = Date.now();
  const first = events.length ? events[0].ts : now;

  const id = crypto.randomUUID();
  await putRecording({
    id,
    kind: "screenshot",
    status: "done",
    createdAt: now,
    startTs: first,
    durationMs: now - first,
    tabId,
    info,
    events: events.map((e) => ({ ...e, t: e.ts - first })),
    mimeType: null,
    chunkCount: 0,
    pauses: [],
    screenshot,
    replay: null,
  });
  await openPreview(id, tabId);
  return { ok: true, recordingId: id };
}

/** Instant replay: the last 2 minutes of the page — rrweb DOM recording + console, network, actions. */
async function saveReplay(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || !/^https?:/.test(tab.url)) throw new Error(t("Instant replay does not work on this page."));
  const prefs = await getPrefs();
  if (!prefs.instantReplay) throw new Error(t("Instant replay is off — turn it on in the extension settings."));

  const [r] = await chrome.scripting
    .executeScript({ target: { tabId, frameIds: [0] }, func: () => (globalThis as any).__adtaskReplay?.() ?? null })
    .catch(() => []);
  const dom = r?.result as { events: { timestamp: number }[] } | null;
  if (!dom || dom.events.length < 2) {
    throw new Error(t("There is no recording for this page yet. Instant replay starts when the page loads — reload it and try again later."));
  }

  const [buffer, info, project] = await Promise.all([collectBuffers(tabId), collectInfo(tabId), resolveProject(tab.url)]);
  const startTs = dom.events[0].timestamp;
  const endTs = Math.max(Date.now(), dom.events.at(-1)!.timestamp);
  const events = filterNetwork(buffer, project?.networkIgnore ?? [])
    .filter((e) => e.ts >= startTs - 1000)
    .map((e) => ({ ...e, t: Math.max(0, e.ts - startTs) }));

  const json = new Blob([JSON.stringify(dom.events)], { type: "application/json" });
  const replay = await new Response(json.stream().pipeThrough(new CompressionStream("gzip"))).blob();

  const id = crypto.randomUUID();
  await putRecording({
    id,
    kind: "replay",
    status: "done",
    createdAt: Date.now(),
    startTs,
    durationMs: endTs - startTs,
    tabId,
    info,
    events,
    mimeType: null,
    chunkCount: 0,
    pauses: [],
    screenshot: null,
    replay: new Blob([replay], { type: "application/gzip" }),
  });
  await openPreview(id, tabId);
  return { ok: true, recordingId: id, windowMs: REPLAY_WINDOW_MS };
}

// ----------------------------- helpers -----------------------------

async function openPreview(recordingId: string, sourceTabId: number | null) {
  let index: number | undefined;
  if (sourceTabId != null) {
    const src = await chrome.tabs.get(sourceTabId).catch(() => null);
    if (src) index = src.index + 1;
  }
  await chrome.tabs.create({ url: chrome.runtime.getURL(`preview.html?id=${recordingId}`), index });
}

/** Tabs opened before the extension was installed have no content scripts — inject them manually (into all frames). */
async function ensureContentScripts(tabId: number) {
  const alive = await chrome.tabs.sendMessage(tabId, { type: "bt:ping" } satisfies Message, { frameId: 0 }).catch(() => null);
  if (alive) return;
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content-main.js"], world: "MAIN" }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content-isolated.js"] }).catch(() => {});
}

async function hasOffscreen(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: [chrome.offscreen.Reason.USER_MEDIA, chrome.offscreen.Reason.DISPLAY_MEDIA],
    justification: "Recording the tab video for a bug report",
  });
}

async function closeOffscreen() {
  if (await hasOffscreen()) await chrome.offscreen.closeDocument().catch(() => {});
}
