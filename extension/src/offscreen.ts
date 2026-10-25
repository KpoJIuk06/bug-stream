/**
 * Offscreen document: MediaRecorder lives here (the service worker has none).
 *  - video chunks are written to IndexedDB (disk) every 2 seconds, the video does not pile up in memory;
 *  - page events come here directly and are also saved to disk every 5 seconds;
 *  - pause: manual, on user inactivity and when the tab is hidden; resumes by itself;
 *  - the duration auto-stop counts video time (pauses do not count).
 */

import { clearEventBatches, deleteRecording, finishRecording, getEventBatches, putChunk, putEventBatch, putRecording } from "./shared/db";
import { initI18n, t } from "./shared/i18n";
import { networkMatcher } from "./shared/prefs";
import type { CapturedEvent, Clock, Message, PageInfo, PauseReason, Recording } from "./shared/types";

const CHUNK_MS = 2000;
const VIDEO_BITRATE = 1_500_000; // ~11 MB per minute at 1080p

void initI18n();
const OPEN_END = Number.MAX_SAFE_INTEGER;

interface Session {
  recordingId: string;
  tabId: number;
  startTs: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  mimeType: string;
  maxMs: number;
  idleMs: number | null;
  ignored: (url: string) => boolean;
  seq: number;
  writes: Promise<void>;
  writeError: string | null;
  events: CapturedEvent[];
  eventSeq: number;
  info: PageInfo | null;
  pauses: [number, number][];
  elapsedMs: number;
  runningSince: number | null;
  pauseReason: PauseReason | null;
  lastActivity: number;
  hidden: boolean;
  ticker: number;
  ticks: number;
  stopping: boolean;
}

let session: Session | null = null;

function pickMimeType(): string {
  for (const t of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

const send = (msg: Message) => chrome.runtime.sendMessage(msg).catch(() => {});

chrome.runtime.onMessage.addListener((msg: Message, sender, sendResponse) => {
  const s = session;
  switch (msg.type) {
    case "bt:offscreen-start":
      start(msg).then(
        (clock) => sendResponse({ ok: true, startTs: session?.startTs, clock }),
        (e) => sendResponse({ ok: false, error: String(e?.message ?? e) }),
      );
      return true;
    case "bt:offscreen-stop":
      stop(msg.cancel).then(
        (recordingId) => sendResponse({ recordingId }),
        (e) => sendResponse({ recordingId: null, error: String(e?.message ?? e) }),
      );
      return true;
    case "bt:offscreen-pause":
      if (s) msg.pause ? pause(s, msg.reason) : resume(s, true);
      sendResponse({ ok: !!s });
      return false;
    case "bt:event":
      if (s && sender.tab?.id === s.tabId) {
        const e = msg.event;
        if (e.kind === "network" && s.ignored(String(e.payload?.url ?? ""))) return false;
        s.events.push(e);
      }
      return false;
    case "bt:info":
      if (s && sender.tab?.id === s.tabId && !s.info) {
        s.info = msg.info;
        void saveMeta(s);
      }
      return false;
    case "bt:activity":
      if (s && sender.tab?.id === s.tabId) {
        s.lastActivity = Date.now();
        // the person moves the mouse or types — so the tab is definitely on screen
        s.hidden = false;
        if (s.pauseReason === "idle" || s.pauseReason === "hidden") resume(s, false);
      }
      return false;
    case "bt:visibility":
      // Top document of the tab only: iframe visibility says nothing about the tab
      if (s && sender.tab?.id === s.tabId && sender.frameId === 0) {
        s.hidden = msg.hidden;
        // pausing on a hidden tab is part of auto-pause; with auto-pause off we always record
        if (msg.hidden && s.runningSince && s.idleMs) pause(s, "hidden");
        else if (!msg.hidden && s.pauseReason === "hidden") {
          s.lastActivity = Date.now();
          resume(s, false);
        }
      }
      return false;
  }
  return false;
});

async function start(msg: Extract<Message, { type: "bt:offscreen-start" }>): Promise<Clock> {
  if (session) throw new Error(t("Recording is already running"));
  const stream = msg.source === "desktop" ? await pickTab() : await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: msg.streamId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    } as unknown as MediaTrackConstraints,
  });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VIDEO_BITRATE });
  const now = Date.now();
  const s: Session = {
    recordingId: msg.recordingId,
    tabId: msg.tabId,
    startTs: now,
    recorder,
    stream,
    mimeType,
    maxMs: msg.maxMs,
    idleMs: msg.idleMs,
    ignored: networkMatcher(msg.networkIgnore),
    seq: 0,
    writes: Promise.resolve(),
    writeError: null,
    events: [],
    eventSeq: 0,
    info: null,
    pauses: [],
    elapsedMs: 0,
    runningSince: now,
    pauseReason: null,
    lastActivity: now,
    hidden: false,
    ticker: 0,
    ticks: 0,
    stopping: false,
  };

  // Every chunk goes to disk right away. Writes are strictly ordered (a promise chain).
  recorder.ondataavailable = (e) => {
    if (e.data.size === 0) return;
    const seq = s.seq++;
    const ts = Date.now();
    s.writes = s.writes
      .then(() => putChunk(s.recordingId, seq, e.data, ts))
      .catch((err) => {
        s.writeError = String(err?.message ?? err);
        console.error("Bug Stream: could not write a video chunk to disk", err);
        if (!s.stopping) void send({ type: "bt:offscreen-auto-stop" });
      });
  };

  await saveMeta(s);
  recorder.start(CHUNK_MS);
  session = s;

  s.ticker = window.setInterval(() => tick(s), 1000);
  // The tab was closed or Chrome stopped the capture — save what we have
  stream.getVideoTracks()[0]?.addEventListener("ended", () => void send({ type: "bt:offscreen-auto-stop" }));
  return clock(s);
}

/** Once a second: auto-pause on inactivity, duration limit, saving events to disk. */
function tick(s: Session) {
  if (session !== s || s.stopping) return;
  const now = Date.now();
  if (s.runningSince && s.idleMs && now - s.lastActivity >= s.idleMs) pause(s, "idle");
  if (s.elapsedMs + (s.runningSince ? now - s.runningSince : 0) >= s.maxMs) {
    void send({ type: "bt:offscreen-auto-stop" });
    return;
  }
  if (++s.ticks % 5 === 0) flushEvents(s);
}

function flushEvents(s: Session) {
  if (!s.events.length) return;
  const batch = s.events;
  s.events = [];
  const seq = s.eventSeq++;
  s.writes = s.writes.then(() => putEventBatch(s.recordingId, seq, batch)).catch(() => {});
}

function pause(s: Session, reason: PauseReason) {
  if (!s.runningSince) {
    // already paused: a manual pause wins over an automatic one
    if (reason === "manual") s.pauseReason = "manual";
    else return;
  } else {
    const now = Date.now();
    s.elapsedMs += now - s.runningSince;
    s.runningSince = null;
    s.pauseReason = reason;
    s.pauses.push([now, OPEN_END]);
    if (s.recorder.state === "recording") {
      s.recorder.requestData();
      s.recorder.pause();
    }
    s.events.push({
      kind: "custom",
      ts: now,
      level: "info",
      summary: reason === "idle" ? "Paused: no activity" : reason === "hidden" ? "Paused: tab hidden" : "Paused",
      payload: { type: "pause", reason },
    });
  }
  void saveMeta(s);
  void send({ type: "bt:offscreen-clock", clock: clock(s) });
}

function resume(s: Session, manual: boolean) {
  if (s.runningSince) return;
  if (s.pauseReason === "manual" && !manual) return; // only the person lifts a manual pause
  if (s.hidden && !manual) return;
  const now = Date.now();
  const open = s.pauses.at(-1);
  if (open && open[1] === OPEN_END) open[1] = now;
  s.runningSince = now;
  s.pauseReason = null;
  s.lastActivity = now;
  if (s.recorder.state === "paused") s.recorder.resume();
  s.events.push({ kind: "custom", ts: now, level: "info", summary: "Recording resumed", payload: { type: "resume" } });
  void saveMeta(s);
  void send({ type: "bt:offscreen-clock", clock: clock(s) });
}

const clock = (s: Session): Clock => ({ elapsedMs: s.elapsedMs, runningSince: s.runningSince, pauseReason: s.pauseReason, maxMs: s.maxMs });

/** Recording info on disk — used to recover the recording after a crash. */
function saveMeta(s: Session): Promise<void> {
  return putRecording(meta(s)).catch((e) => console.error("adtask:", e));
}

function meta(s: Session): Recording {
  return {
    id: s.recordingId,
    kind: "video",
    status: "recording",
    createdAt: s.startTs,
    startTs: s.startTs,
    durationMs: 0,
    tabId: s.tabId,
    info: s.info,
    events: [],
    mimeType: s.mimeType,
    chunkCount: 0,
    pauses: s.pauses.map((p) => [p[0], p[1]] as [number, number]),
    screenshot: null,
    replay: null,
  };
}

async function stop(cancel: boolean): Promise<string | null> {
  const s = session;
  if (!s) return null;
  s.stopping = true;
  session = null;
  clearInterval(s.ticker);

  const stopped = new Promise<void>((resolve) => (s.recorder.onstop = () => resolve()));
  if (s.recorder.state !== "inactive") s.recorder.stop();
  await stopped;
  const stopTs = s.runningSince ? Date.now() : (s.pauses.at(-1)?.[0] ?? Date.now());
  s.stream.getTracks().forEach((t) => t.stop());
  flushEvents(s);
  await s.writes;

  if (cancel || s.seq === 0) {
    await deleteRecording(s.recordingId);
    if (!cancel) throw new Error(s.writeError ? t("Could not write the video to disk: {error}", { error: s.writeError }) : t("The video was not recorded"));
    return null;
  }

  const events = await getEventBatches(s.recordingId);
  const r = finishRecording({ ...meta(s), chunkCount: s.seq }, events, stopTs);
  await putRecording(r);
  await clearEventBatches(s.recordingId);
  return s.recordingId;
}

/**
 * Recording from the site button: Chrome shows the "Share a tab" picker (tabs only),
 * the user picks the current one. Without this picker Chrome does not allow recording a tab unless
 * the extension was invoked by its icon or a keyboard shortcut.
 */
async function pickTab(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "browser", width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } },
      audio: false,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude",
    } as DisplayMediaStreamOptions);
  } catch (e) {
    if ((e as DOMException)?.name === "NotAllowedError") throw new Error(t("Recording cancelled — no tab was selected"));
    throw e;
  }
}
