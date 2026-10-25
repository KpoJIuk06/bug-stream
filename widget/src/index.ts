/**
 * Bug Stream widget — bug reports right from the site, without the extension.
 *
 *   <script src="https://<server>/widget/bug-stream.js"></script>
 *   bugstream.init({ server: "https://<server>", key: "adk_…", user: { id, email, name } });
 *   bugstream.report();               // menu: video / screenshot / last 2 minutes
 *
 * From the moment the script loads, console, network, user actions and (optionally) a recording
 * of the last 2 minutes of the page are captured. Nothing is sent until the person presses "Send".
 * Upload format — server/docs/api/ingest.openapi.yaml.
 *
 * The same object is available as window.adtask (compatibility with early installations).
 */

import {
  ReplayBuffer,
  cleanupOldRecordings,
  clearEventBatches,
  collectInfo,
  deleteRecording,
  filterNetwork,
  finishRecording,
  getEventBatches,
  getRecording,
  getVideo,
  gzipJson,
  installActionCapture,
  installPageHooks,
  preview,
  putChunk,
  putEventBatch,
  putRecording,
  recoverInterrupted,
  truncate,
  type CapturedEvent,
  type PageInfo,
  type Recording,
} from "./core/index";
import { counter, getLang, setLang, t, type Key } from "./i18n";
import { HOST_TAG, el, esc, fmt, layer, setBrandColor, setHidden, toast } from "./ui";

const VERSION = "0.2.0";
const BUFFER_MS = 5 * 60_000;
const BUFFER_MAX = 1500;
const REPLAY_MS = 2 * 60_000;
const CHUNK_MS = 2000;
const OPEN_END = Number.MAX_SAFE_INTEGER;

export interface InitOptions {
  /** Report server address, e.g. https://bugs.example.com */
  server: string;
  /** Project widget key. */
  key: string;
  /** Base path of the ingest API (default `${server}/api/ingest`). */
  endpoint?: string;
  /** Who is reporting: if the email matches a server user, they become the report author. */
  user?: { id?: string | number; email?: string; name?: string };
  /** Application data — goes into the report (Info tab). */
  context?: Record<string, unknown>;
  /** Interface language: en, ru, az (default — browser language, otherwise English). */
  lang?: "ru" | "en" | "az";
  /** Name and color in the widget interface. */
  brand?: { name?: string; color?: string };
  /** Which menu items to show (all by default). */
  features?: { video?: boolean; screenshot?: boolean; replay?: boolean };
  /** Deprecated: same as features.replay. */
  replay?: boolean;
  /** Floating "Report a bug" button (off by default — the site provides its own button). */
  button?: boolean;
  /** Maximum video length, minutes (default 10). */
  maxMinutes?: number;
  /**
   * Request and response headers whose values are replaced with "[hidden]" before the report is sent,
   * e.g. ["authorization", "cookie", "set-cookie", "x-api-key"]. Empty by default — everything as is.
   */
  redactHeaders?: string[];
}

interface ServerConfig {
  projectKey: string;
  projectName: string;
  services: { id: string; name: string }[];
  networkIgnore: string[];
}

/** What is opened in the report form. */
interface Draft {
  kind: "video" | "screenshot" | "replay";
  recordingId?: string;
  video?: Blob | null;
  screenshot?: Blob | null;
  replay?: Blob | null;
  events: CapturedEvent[];
  info: PageInfo | null;
  startTs: number;
  durationMs: number;
}

interface Session {
  id: string;
  startTs: number;
  stream: MediaStream;
  recorder: MediaRecorder;
  mimeType: string;
  seq: number;
  writes: Promise<void>;
  events: CapturedEvent[];
  eventSeq: number;
  pauses: [number, number][];
  elapsedMs: number;
  runningSince: number | null;
  maxMs: number;
  info: PageInfo | null;
  timer: number;
  stopping: boolean;
}

// ============================== state ==============================

let opts: InitOptions | null = null;
let server = "";
let endpoint = "";
let context: Record<string, unknown> = {};
let config: ServerConfig | null = null;
const buffer: CapturedEvent[] = [];
let session: Session | null = null;
const replay = new ReplayBuffer({ windowMs: REPLAY_MS, blockSelector: HOST_TAG });

const feature = (f: "video" | "screenshot" | "replay") =>
  f === "replay" ? opts?.features?.replay ?? opts?.replay ?? true : opts?.features?.[f] ?? true;

const isOurUi = (node: Element | null) => !!node?.closest?.(HOST_TAG);

function handle(e: CapturedEvent) {
  buffer.push(e);
  const cutoff = Date.now() - BUFFER_MS;
  while (buffer.length > BUFFER_MAX || (buffer.length && buffer[0].ts < cutoff)) buffer.shift();
  session?.events.push(e);
}

function contextEvent(): CapturedEvent | null {
  const user = opts?.user ?? {};
  const all: Record<string, unknown> = {
    ...(user.id != null ? { userId: user.id } : {}),
    ...(user.email ? { email: user.email } : {}),
    ...(user.name ? { name: user.name } : {}),
    ...context,
  };
  if (!Object.keys(all).length) return null;
  const text = Object.entries(all)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");
  return { kind: "custom", ts: Date.now(), level: "info", summary: `App context: ${text}`.slice(0, 300), payload: { type: "app-context", context: all } };
}

function plain(v: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(v ?? {}));
  } catch {
    return {};
  }
}

function emit(name: "ready" | "state", detail: Record<string, unknown>) {
  for (const prefix of ["bugstream", "adtask"]) window.dispatchEvent(new CustomEvent(`${prefix}:${name}`, { detail }));
}

// ============================== start ==============================

function init(o: InitOptions) {
  if (!o?.server || !o?.key) throw new Error("bugstream.init: server and key are required");
  const first = !opts;
  opts = { button: false, maxMinutes: 10, ...o };
  server = o.server.trim().replace(/\/+$/, "");
  endpoint = (o.endpoint ?? `${server}/api/ingest`).replace(/\/+$/, "");
  config = null;
  if (o.context) context = { ...context, ...plain(o.context) };
  setLang(o.lang);
  setBrandColor(o.brand?.color);

  if (first) {
    // the report upload itself is not written into the report network log
    installPageHooks(handle, (url) => url.startsWith(server) || url.startsWith(endpoint), "__bugstreamHooked");
    installActionCapture(handle, isOurUi);
    void recoverAfterReload();
  }
  if (feature("replay")) replay.start();
  else replay.stop();
  renderFab();
}

/** The page was reloaded during a video — what was recorded can be sent. */
async function recoverAfterReload() {
  try {
    await cleanupOldRecordings();
    const ids = await recoverInterrupted(() => false);
    if (ids.length) toast(t("toast.recover"), { label: t("toast.open"), onClick: () => void openRecording(ids[0]) }, 15000);
  } catch {
    /* IndexedDB unavailable (private mode) — no recovery */
  }
}

function ensureInit() {
  if (!opts) throw new Error("bugstream: call bugstream.init({ server, key }) first");
}

// ============================== menu ==============================

function renderFab() {
  const old = layer().querySelector(".fab");
  if (!opts?.button) return old?.remove();
  old?.remove();
  const b = el<HTMLButtonElement>(`<button class="fab" type="button"><i></i>${esc(t("report"))}</button>`);
  b.onclick = () => report();
  layer().appendChild(b);
}

function menuItem(cmd: string, color: string, icon: string, title: Key, hint: string, disabled = false) {
  return `<button class="item" role="menuitem" data-cmd="${cmd}" aria-disabled="${disabled}"><span class="ic" style="background:${color}">${icon}</span><span><b>${esc(t(title))}</b><small>${esc(hint)}</small></span></button>`;
}

function report() {
  ensureInit();
  if (session) return void stopRecording(false);
  if (layer().querySelector(".menu")) return closeMenu();
  const items: string[] = [];
  if (feature("video")) items.push(menuItem("record", "#d1343e", "●", "menu.video", t("menu.videoHint")));
  if (feature("screenshot")) items.push(menuItem("screenshot", "#2b6cb0", "▣", "menu.screenshot", t("menu.screenshotHint")));
  if (feature("replay")) {
    const ready = !!replay.events();
    items.push(menuItem("replay", "#6b46c1", "↺", "menu.replay", t(ready ? "menu.replayHint" : "menu.replayNotReady"), !ready));
  }
  const title = opts!.brand?.name ? `${opts!.brand.name}` : t("report");
  const backdrop = el(`<div class="backdrop"></div>`);
  const menu = el(`<div class="menu" role="menu" aria-label="${esc(t("report"))}"><h2>${esc(title)}</h2>${items.join("")}</div>`);
  backdrop.onclick = closeMenu;
  menu.querySelectorAll<HTMLButtonElement>(".item").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-disabled") === "true") return;
      closeMenu();
      const cmd = b.dataset.cmd;
      if (cmd === "record") void startRecording();
      else if (cmd === "screenshot") void takeScreenshot();
      else void saveReplay();
    }),
  );
  menu.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());
  layer().append(backdrop, menu);
  menu.querySelector<HTMLButtonElement>(".item:not([aria-disabled=true])")?.focus();
}

function closeMenu() {
  layer().querySelector(".menu")?.remove();
  layer().querySelector(".backdrop")?.remove();
}

// ============================== video ==============================

/** Browser "Share this tab" dialog. Call only from a user click. */
function captureTab(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser", width: { max: 1920 }, height: { max: 1080 }, frameRate: { max: 30 } },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  } as DisplayMediaStreamOptions);
}

function pickMime(): string {
  for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function meta(s: Session): Recording {
  return {
    id: s.id,
    kind: "video",
    status: "recording",
    createdAt: s.startTs,
    startTs: s.startTs,
    durationMs: 0,
    tabId: null,
    info: s.info,
    events: [],
    mimeType: s.mimeType,
    chunkCount: 0,
    pauses: s.pauses.map((p) => [p[0], p[1]] as [number, number]),
    screenshot: null,
    replay: null,
  };
}

async function startRecording() {
  ensureInit();
  if (session) return;
  let stream: MediaStream;
  try {
    stream = await captureTab();
  } catch (e) {
    if ((e as DOMException)?.name !== "NotAllowedError") toast(t("toast.recordFailed") + (e as Error).message);
    return;
  }
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mimeType || undefined, videoBitsPerSecond: 1_500_000 });
  const now = Date.now();
  const s: Session = {
    id: crypto.randomUUID(),
    startTs: now,
    stream,
    recorder,
    mimeType: recorder.mimeType || mimeType || "video/webm",
    seq: 0,
    writes: Promise.resolve(),
    events: [],
    eventSeq: 0,
    pauses: [],
    elapsedMs: 0,
    runningSince: now,
    maxMs: (opts!.maxMinutes ?? 10) * 60_000,
    info: null,
    timer: 0,
    stopping: false,
  };
  session = s;
  recorder.ondataavailable = (e) => {
    if (!e.data.size) return;
    const seq = s.seq++;
    const ts = Date.now();
    s.writes = s.writes.then(() => putChunk(s.id, seq, e.data, ts)).catch((err) => console.error("bugstream: video chunk was not saved", err));
  };
  stream.getVideoTracks()[0]?.addEventListener("ended", () => void stopRecording(false)); // "Stop sharing" in the browser

  collectInfo().then((info) => {
    s.info = info;
    void putRecording(meta(s)).catch(() => {});
  });
  const ctx = contextEvent();
  if (ctx) s.events.push(ctx);
  s.events.push({ kind: "navigation", ts: now, summary: `Recording started on ${location.pathname}${location.search}`, payload: { to: location.href, type: "start" } });
  await putRecording(meta(s)).catch(() => {});
  recorder.start(CHUNK_MS);

  let ticks = 0;
  s.timer = window.setInterval(() => {
    renderBar();
    if (s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0) >= s.maxMs) void stopRecording(false);
    if (++ticks % 5 === 0) flushEvents(s);
  }, 1000);
  renderBar();
  emit("state", { recording: true });
}

function flushEvents(s: Session) {
  if (!s.events.length) return;
  const batch = s.events;
  s.events = [];
  const seq = s.eventSeq++;
  s.writes = s.writes.then(() => putEventBatch(s.id, seq, batch)).catch(() => {});
}

function togglePause() {
  const s = session;
  if (!s) return;
  const now = Date.now();
  if (s.runningSince) {
    s.elapsedMs += now - s.runningSince;
    s.runningSince = null;
    s.pauses.push([now, OPEN_END]);
    if (s.recorder.state === "recording") {
      s.recorder.requestData();
      s.recorder.pause();
    }
    handle({ kind: "custom", ts: now, level: "info", summary: "Paused", payload: { type: "pause", reason: "manual" } });
  } else {
    const open = s.pauses.at(-1);
    if (open && open[1] === OPEN_END) open[1] = now;
    s.runningSince = now;
    if (s.recorder.state === "paused") s.recorder.resume();
    handle({ kind: "custom", ts: now, level: "info", summary: "Recording resumed", payload: { type: "resume" } });
  }
  void putRecording(meta(s)).catch(() => {});
  renderBar();
}

async function stopRecording(cancel: boolean) {
  const s = session;
  if (!s || s.stopping) return;
  s.stopping = true;
  session = null;
  clearInterval(s.timer);
  layer().querySelector(".bar")?.remove();
  emit("state", { recording: false });

  const stopped = new Promise<void>((r) => (s.recorder.onstop = () => r()));
  if (s.recorder.state !== "inactive") s.recorder.stop();
  await stopped;
  const stopTs = s.runningSince ? Date.now() : (s.pauses.at(-1)?.[0] ?? Date.now());
  s.stream.getTracks().forEach((tr) => tr.stop());
  flushEvents(s);
  await s.writes;

  if (cancel || s.seq === 0) {
    await deleteRecording(s.id).catch(() => {});
    if (!cancel) toast(t("toast.noVideo"));
    return;
  }
  const events = await getEventBatches(s.id);
  await putRecording(finishRecording({ ...meta(s), chunkCount: s.seq }, events, stopTs));
  await clearEventBatches(s.id);
  await openRecording(s.id);
}

function renderBar() {
  const s = session;
  if (!s) return;
  let bar = layer().querySelector<HTMLElement>(".bar");
  if (!bar) {
    bar = el(`<div class="bar" role="toolbar" aria-label="${esc(t("bar.label"))}">
      <span class="dot" aria-hidden="true"></span><span class="time"></span>
      <button class="pause" type="button"></button><button class="stop" type="button">${esc(t("bar.stop"))}</button><button class="cancel" type="button">${esc(t("bar.cancel"))}</button></div>`);
    bar.querySelector<HTMLButtonElement>(".pause")!.onclick = togglePause;
    bar.querySelector<HTMLButtonElement>(".stop")!.onclick = () => void stopRecording(false);
    bar.querySelector<HTMLButtonElement>(".cancel")!.onclick = () => confirm(t("bar.cancelConfirm")) && void stopRecording(true);
    layer().appendChild(bar);
  }
  const elapsed = s.elapsedMs + (s.runningSince ? Date.now() - s.runningSince : 0);
  bar.classList.toggle("paused", !s.runningSince);
  bar.querySelector(".time")!.innerHTML = `${fmt(elapsed)} <small>/ ${fmt(s.maxMs)}</small>`;
  bar.querySelector(".pause")!.textContent = t(s.runningSince ? "bar.pause" : "bar.resume");
}

async function openRecording(id: string) {
  const r = await getRecording(id);
  if (!r) return toast(t("toast.notFound"));
  openForm({
    kind: "video",
    recordingId: id,
    video: await getVideo(r),
    events: r.events,
    info: r.info ?? (await collectInfo()),
    startTs: r.startTs,
    durationMs: r.durationMs,
  });
}

// ============================== screenshot and last 2 minutes ==============================

function lastEvents(fromTs: number): CapturedEvent[] {
  const ctx = contextEvent();
  return [...buffer.filter((e) => e.ts >= fromTs), ...(ctx ? [ctx] : [])]
    .map((e) => ({ ...e, t: Math.max(0, e.ts - fromTs) }))
    .sort((a, b) => a.t - b.t);
}

async function takeScreenshot() {
  ensureInit();
  let stream: MediaStream;
  try {
    stream = await captureTab();
  } catch (e) {
    if ((e as DOMException)?.name !== "NotAllowedError") toast(t("toast.shotFailed") + (e as Error).message);
    return;
  }
  setHidden(true);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 350)); // the frame no longer contains the tab picker
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const shot = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    const now = Date.now();
    const from = buffer.length ? buffer[0].ts : now;
    openForm({ kind: "screenshot", screenshot: shot, events: lastEvents(from), info: await collectInfo(), startTs: from, durationMs: now - from });
  } finally {
    stream.getTracks().forEach((tr) => tr.stop());
    setHidden(false);
  }
}

async function saveReplay() {
  ensureInit();
  const dom = replay.events();
  if (!dom) return toast(t("toast.replayNotReady"));
  const startTs = dom[0].timestamp;
  openForm({
    kind: "replay",
    replay: await gzipJson(dom),
    events: lastEvents(startTs - 1000),
    info: await collectInfo(),
    startTs,
    durationMs: Math.max(Date.now(), dom.at(-1)!.timestamp) - startTs,
  });
}

// ============================== report form ==============================

const isNetError = (e: CapturedEvent) => e.kind === "network" && (!e.status || e.status >= 400);
const isError = (e: CapturedEvent) => (e.kind === "console" && e.level === "error") || isNetError(e);

async function loadConfig(): Promise<ServerConfig> {
  if (config) return config;
  const res = await fetch(`${endpoint}/config`, { headers: { "X-Bug-Stream-Key": opts!.key } });
  if (!res.ok) throw new Error(await problem(res));
  config = (await res.json()) as ServerConfig;
  return config;
}

async function problem(res: Response): Promise<string> {
  try {
    const p = await res.json();
    if (p.code === "WIDGET_KEY_INVALID" || p.code === "WIDGET_KEY_REQUIRED") return t("err.keyInvalid");
    if (p.code === "WIDGET_ORIGIN") return t("err.origin");
    if (p.code === "WIDGET_RATE_LIMIT") return t("err.rateLimit");
    return p.detail ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function openForm(d: Draft) {
  layer().querySelector(".modal-wrap")?.remove();
  const consoleErr = d.events.filter((e) => e.kind === "console" && e.level === "error").length;
  const netErr = d.events.filter(isNetError).length;
  const firstError = d.events.find(isError);
  const media = d.video
    ? `<video controls playsinline></video>`
    : d.screenshot
      ? `<img alt="${esc(t("form.screenshotAlt"))}">`
      : `<div class="note">${esc(t("form.replayNote", { d: fmt(d.durationMs) }))}</div>`;
  const sev = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => `<option value="${v}">${esc(t(`sev.${v}` as Key))}</option>`).join("");

  const wrap = el(`
    <div class="modal-wrap">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(t("form.heading"))}">
        <header><h1>${esc(opts!.brand?.name ?? t("form.heading"))}</h1><span class="proj"></span><button class="x" type="button" aria-label="${esc(t("form.close"))}">×</button></header>
        <div class="media">${media}</div>
        <div class="counters">
          <span class="counter${consoleErr ? " err" : ""}">${esc(counter("console", consoleErr))}</span>
          <span class="counter${netErr ? " err" : ""}">${esc(counter("network", netErr))}</span>
          <span class="counter">${esc(counter("requests", d.events.filter((e) => e.kind === "network").length))}</span>
          <span class="counter">${esc(counter("actions", d.events.filter((e) => e.kind === "action").length))}</span>
        </div>
        <form class="body">
          <label class="f"><span>${esc(t("form.title"))}</span><input name="title" maxlength="500" placeholder="${esc(firstError ? firstError.summary.slice(0, 120) : t("form.titlePh"))}"></label>
          <label class="f"><span>${esc(t("form.description"))}</span><textarea name="description" placeholder="${esc(t("form.descriptionPh"))}"></textarea></label>
          <div class="row2">
            <label class="f"><span>${esc(t("form.service"))}</span><select name="service"><option value="">${esc(t("form.serviceAuto"))}</option></select></label>
            <label class="f"><span>${esc(t("form.severity"))}</span><select name="severity"><option value="">${esc(t("sev.none"))}</option>${sev}</select></label>
          </div>
          <div class="err-box" hidden></div>
          <div class="progress" hidden><div></div></div>
        </form>
        <footer><button class="btn danger" type="button" data-act="discard">${esc(t("form.discard"))}</button><button class="btn primary" type="button" data-act="send">${esc(t("form.send"))}</button></footer>
      </div>
    </div>`);
  layer().appendChild(wrap);

  const urls: string[] = [];
  const video = wrap.querySelector("video");
  if (video && d.video) video.src = urls[urls.push(URL.createObjectURL(d.video)) - 1];
  const img = wrap.querySelector("img");
  if (img && d.screenshot) img.src = urls[urls.push(URL.createObjectURL(d.screenshot)) - 1];

  const form = wrap.querySelector("form")!;
  const errBox = wrap.querySelector<HTMLElement>(".err-box")!;
  const showError = (text: string | null) => {
    errBox.textContent = text ?? "";
    errBox.hidden = !text;
  };
  const close = async (discard: boolean) => {
    urls.forEach(URL.revokeObjectURL);
    wrap.remove();
    if (discard && d.recordingId) await deleteRecording(d.recordingId).catch(() => {});
  };
  wrap.querySelector<HTMLButtonElement>(".x")!.onclick = () => void close(false);
  wrap.querySelector<HTMLButtonElement>("[data-act=discard]")!.onclick = () => confirm(t("form.discardConfirm")) && void close(true);
  wrap.addEventListener("keydown", (e) => e.key === "Escape" && void close(false));
  form.querySelector<HTMLInputElement>("input[name=title]")!.focus();

  loadConfig().then(
    (c) => {
      wrap.querySelector(".proj")!.textContent = `${c.projectKey} — ${c.projectName}`;
      const sel = form.querySelector<HTMLSelectElement>("select[name=service]")!;
      for (const s of c.services) sel.add(new Option(s.name, s.id));
    },
    (e) => showError((e as Error).message === "Failed to fetch" ? t("err.server", { s: server }) : (e as Error).message),
  );

  const send = wrap.querySelector<HTMLButtonElement>("[data-act=send]")!;
  const submit = async () => {
    showError(null);
    send.disabled = true;
    send.textContent = t("form.sending");
    const progress = wrap.querySelector<HTMLElement>(".progress")!;
    progress.hidden = false;
    try {
      const c = await loadConfig();
      const f = new FormData(form);
      const title = String(f.get("title") || "").trim() || form.querySelector<HTMLInputElement>("input[name=title]")!.placeholder;
      const result = await upload(
        d,
        c,
        {
          title,
          description: String(f.get("description") || "").trim() || null,
          serviceId: String(f.get("service") || "") || null,
          severity: String(f.get("severity") || "") || null,
        },
        (p) => ((progress.firstElementChild as HTMLElement).style.width = `${Math.round(p * 100)}%`),
      );
      if (d.recordingId) await deleteRecording(d.recordingId).catch(() => {});
      showDone(wrap, result.url, () => void close(false));
    } catch (e) {
      const m = (e as Error).message;
      showError(m === "network" || m === "Failed to fetch" ? t("err.serverRetry", { s: server }) : m);
      send.disabled = false;
      send.textContent = t("form.send");
      progress.hidden = true;
    }
  };
  send.onclick = () => void submit();
  form.onsubmit = (e) => {
    e.preventDefault();
    void submit();
  };
}

function showDone(wrap: HTMLElement, url: string, close: () => void) {
  const modal = wrap.querySelector(".modal")!;
  modal.innerHTML = `<div class="done"><div class="check">✓</div><h2>${esc(t("done.title"))}</h2><p>${esc(t("done.text"))}</p>
    <div class="actions"><a class="btn primary" target="_blank" rel="noopener"></a><button class="btn" type="button" data-act="copy">${esc(t("done.copy"))}</button><button class="btn ghost" type="button" data-act="close">${esc(t("form.close"))}</button></div></div>`;
  const a = modal.querySelector("a")!;
  a.href = url;
  a.textContent = t("done.open");
  modal.querySelector<HTMLButtonElement>("[data-act=copy]")!.onclick = async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    await navigator.clipboard?.writeText(url).catch(() => {});
    b.textContent = t("done.copied");
  };
  modal.querySelector<HTMLButtonElement>("[data-act=close]")!.onclick = close;
}

// ============================== sending ==============================

async function upload(
  d: Draft,
  c: ServerConfig,
  fields: { title: string; description: string | null; serviceId: string | null; severity: string | null },
  onProgress: (p: number) => void,
): Promise<{ id: string; url: string }> {
  const info = d.info;
  const user = opts!.user ?? {};
  const meta = {
    ...fields,
    tags: [],
    source: "WIDGET",
    pageUrl: info?.pageUrl ?? location.href,
    pageTitle: info?.pageTitle ?? document.title,
    recordedAt: new Date(d.startTs).toISOString(),
    durationMs: d.kind === "screenshot" ? 0 : d.durationMs,
    timezone: info?.timezone,
    locale: info?.locale,
    location: info?.location,
    os: info?.os,
    osVersion: info?.osVersion,
    browser: info?.browser,
    browserVersion: info?.browserVersion,
    windowSize: info?.windowSize,
    screenSize: info?.screenSize,
    devicePixelRatio: info?.devicePixelRatio,
    networkType: info?.networkType,
    networkDownlink: info?.networkDownlink,
    networkRtt: info?.networkRtt,
    extensionVersion: `bug-stream-widget ${VERSION} (${getLang()})`,
    reporterEmail: user.email ?? null,
    reporterName: user.name ?? null,
  };
  const events = redact(filterNetwork(d.events, c.networkIgnore ?? []), opts!.redactHeaders);
  const form = new FormData();
  form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("events", new Blob([JSON.stringify(events)], { type: "application/json" }));
  if (d.video) form.append("video", d.video, "video.webm");
  if (d.screenshot) form.append("screenshot", d.screenshot, "screenshot.png");
  if (d.replay) form.append("replay", d.replay, "replay.json.gz");
  const thumb = await thumbnail(d);
  if (thumb) form.append("thumbnail", thumb, "thumbnail.jpg");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${endpoint}/reports`);
    xhr.setRequestHeader("X-Bug-Stream-Key", opts!.key);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText));
      reject(new Error(await problem(new Response(xhr.responseText, { status: xhr.status }))));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(form);
  });
}

/** Thumbnail for the report list: a video frame at the first error or a downscaled screenshot. */
/** Hide values of the selected headers in network events. */
function redact(events: CapturedEvent[], names: string[] | undefined): CapturedEvent[] {
  const hide = new Set((names ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean));
  if (!hide.size) return events;
  const clean = (h: unknown) => {
    if (!h || typeof h !== "object") return h;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(h as Record<string, unknown>)) out[k] = hide.has(k.toLowerCase()) ? "[hidden]" : v;
    return out;
  };
  return events.map((e) => {
    if (e.kind !== "network" || !e.payload) return e;
    const p = e.payload as Record<string, unknown>;
    return { ...e, payload: { ...p, requestHeaders: clean(p.requestHeaders), responseHeaders: clean(p.responseHeaders) } };
  });
}

async function thumbnail(d: Draft): Promise<Blob | null> {
  try {
    let source: CanvasImageSource;
    let w: number;
    let h: number;
    if (d.screenshot) {
      const bmp = await createImageBitmap(d.screenshot);
      [source, w, h] = [bmp, bmp.width, bmp.height];
    } else if (d.video) {
      const v = document.createElement("video");
      v.muted = true;
      v.src = URL.createObjectURL(d.video);
      await new Promise<void>((ok, fail) => ((v.onloadeddata = () => ok()), (v.onerror = () => fail(new Error("video")))));
      const err = d.events.find(isError);
      v.currentTime = Math.min(((err?.t ?? 1000) + 300) / 1000, Math.max(0, d.durationMs / 1000 - 0.2));
      await new Promise<void>((ok) => ((v.onseeked = () => ok()), setTimeout(ok, 1500)));
      [source, w, h] = [v, v.videoWidth, v.videoHeight];
    } else return null;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = Math.round((h / w) * 480);
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

// ============================== window.bugstream ==============================

const api = Object.freeze({
  version: VERSION,
  widget: true,
  init,
  report,
  record: () => void startRecording(),
  screenshot: () => void takeScreenshot(),
  replay: () => void saveReplay(),
  setUser: (user: InitOptions["user"]) => {
    if (opts) opts.user = user ?? {};
  },
  setContext: (ctx: Record<string, unknown>) => {
    context = { ...context, ...plain(ctx) };
    if (session) {
      const e = contextEvent();
      if (e) handle(e);
    }
  },
  clearContext: () => {
    context = {};
  },
  log: (message: unknown, data?: unknown) =>
    handle({ kind: "custom", ts: Date.now(), level: "info", summary: truncate(preview(message)), payload: { type: "log", data: data === undefined ? undefined : plain({ data }).data } }),
  isRecording: () => !!session,
});

// The widget wins over the extension: if the extension already added its window.adtask — replace it
for (const name of ["bugstream", "adtask"]) {
  Object.defineProperty(window, name, { value: api, configurable: true, writable: true, enumerable: false });
}
emit("ready", { version: VERSION, widget: true });
