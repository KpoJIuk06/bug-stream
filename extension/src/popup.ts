import { api, getSettings, logout } from "./shared/api";
import { mountLogin } from "./shared/login-form";
import { getLocale, initI18n, intlLocale, saveLocale, t, translateDom } from "./shared/i18n";
import { listRecordings } from "./shared/db";
import { getPrefs, savePrefs } from "./shared/prefs";
import { IDLE_STATE, currentElapsed, type Message, type Prefs, type RecordingState } from "./shared/types";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (el: HTMLElement, visible: boolean) => el.classList.toggle("hidden", !visible);
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

let timer = 0;
let state: RecordingState = IDLE_STATE;

/**
 * The hints show the default Alt+Shift+… keys; replace them with what Chrome actually uses —
 * on macOS it reports "⌥⇧R", and the user may have changed the keys in chrome://extensions/shortcuts.
 */
async function showShortcuts() {
  const commands = await chrome.commands.getAll().catch(() => [] as chrome.commands.Command[]);
  document.querySelectorAll<HTMLElement>("[data-cmd]").forEach((el) => {
    const shortcut = commands.find((c) => c.name === el.dataset.cmd)?.shortcut;
    const kbds = el.querySelectorAll("kbd");
    if (!shortcut || !kbds.length) return;
    const first = kbds[0];
    const last = kbds[kbds.length - 1];
    while (first.nextSibling && first.nextSibling !== last) first.nextSibling.remove();
    if (last !== first) last.remove();
    first.textContent = shortcut;
  });
}

async function render() {
  translateDom();
  void showShortcuts();
  $<HTMLSelectElement>("pref-locale").value = getLocale();
  const s = await getSettings();
  const loggedIn = !!s.refreshToken && !!s.user;
  show($("view-login"), !loggedIn);
  show($("view-main"), loggedIn);
  show($("footer"), loggedIn);
  show($("open-site"), loggedIn);

  if (!loggedIn) {
    const root = $("login-root");
    if (!root.firstChild) mountLogin(root, s.server, render);
    return;
  }
  $("login-root").innerHTML = "";

  $("user-name").textContent = s.user!.fullName;
  $("server-label").textContent = s.server.replace(/^https?:\/\//, "");
  $<HTMLAnchorElement>("open-site").href = s.server;
  const avatar = $("avatar");
  avatar.textContent = s.user!.fullName.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  let h = 0;
  for (const ch of s.user!.fullName) h = (h * 31 + ch.charCodeAt(0)) % 360;
  avatar.style.background = `hsl(${h} 38% 42%)`;

  await Promise.all([renderState(), renderPrefs(), renderUnsaved()]);
  // the badge with the number of recovered recordings is no longer needed — the user sees them
  if (state.status === "idle") await chrome.action.setBadgeText({ text: "" });
}

async function renderState() {
  const { state: raw } = (await chrome.storage.session.get({ state: IDLE_STATE })) as { state: RecordingState };
  state = { ...IDLE_STATE, ...raw };
  const recording = state.status === "recording" || state.status === "starting";
  const paused = state.status === "recording" && !state.runningSince;
  show($("recording"), recording);
  $("recording").classList.toggle("paused", paused);
  $("rec-label").textContent = paused
    ? state.pauseReason === "idle"
      ? t("Paused — no activity")
      : state.pauseReason === "hidden"
        ? t("Paused — tab hidden")
        : t("Paused")
    : t("Recording");
  $("btn-pause").textContent = paused ? t("Resume") : t("Pause");
  show($("btn-record"), !recording);
  show($("btn-screenshot").parentElement!, !recording);
  show($("btn-stop"), recording);
  show($("rec-controls"), recording);
  show($("hint"), !recording);
  clearInterval(timer);
  if (recording) {
    const tick = () => ($("rec-time").textContent = `${fmt(currentElapsed(state))} / ${fmt(state.maxMs)}`);
    tick();
    timer = window.setInterval(tick, 500);
  }

  // Chrome system pages cannot be recorded — explain right away
  const tab = await activeTab();
  const canRecord = !!tab?.url && /^https?:/.test(tab.url);
  if (!recording) {
    $<HTMLButtonElement>("btn-record").disabled = !canRecord;
    $<HTMLButtonElement>("btn-screenshot").disabled = !canRecord;
    showError(canRecord ? null : t("This page cannot be recorded. Open the site where you found the bug."));
  }
  const prefs = await getPrefs();
  const origin = canRecord ? new URL(tab!.url!).origin : null;
  $<HTMLButtonElement>("btn-replay").disabled = !canRecord || !prefs.instantReplay || (!!origin && prefs.replayExcluded.includes(origin));
}

async function renderPrefs() {
  const p = await getPrefs();
  $<HTMLSelectElement>("pref-max").value = String(p.maxMinutes);
  $<HTMLInputElement>("pref-autopause").checked = p.autoPause;
  $<HTMLSelectElement>("pref-idle").value = String(p.idleSeconds);
  $<HTMLSelectElement>("pref-idle").disabled = !p.autoPause;
  $<HTMLInputElement>("pref-replay").checked = p.instantReplay;
  const tab = await activeTab();
  const origin = tab?.url && /^https?:/.test(tab.url) ? new URL(tab.url).origin : null;
  show($("site-row"), p.instantReplay && !!origin);
  if (origin) {
    $("site-origin").textContent = origin.replace(/^https?:\/\//, "");
    $<HTMLInputElement>("pref-site").checked = !p.replayExcluded.includes(origin);
  }
}

/** Recordings that were not sent: the preview was closed or the browser crashed while recording. */
async function renderUnsaved() {
  const list = (await listRecordings().catch(() => [])).filter((r) => r.status === "done").sort((a, b) => b.createdAt - a.createdAt);
  show($("unsaved"), list.length > 0);
  const ul = $("unsaved-list");
  ul.innerHTML = "";
  const KIND = { video: t("Video"), screenshot: t("Screenshot"), replay: "Replay" } as const;
  for (const r of list.slice(0, 5)) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    const when = new Date(r.createdAt).toLocaleString(intlLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    label.textContent = `${KIND[r.kind]}${r.kind === "screenshot" ? "" : " " + fmt(r.durationMs)} · ${when}`;
    label.title = r.info?.pageUrl ?? "";
    const open = document.createElement("button");
    open.className = "btn";
    open.textContent = t("Open");
    open.addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL(`preview.html?id=${r.id}`) }).then(() => window.close()));
    li.append(label, open);
    ul.appendChild(li);
  }
}

function showError(text: string | null, id = "main-error") {
  const box = $(id);
  box.textContent = text ?? "";
  show(box, !!text);
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function call(msg: Message) {
  const res = await chrome.runtime.sendMessage(msg);
  if (res?.error) throw new Error(res.error);
  return res;
}

// ----------------------------- handlers -----------------------------

$("btn-record").addEventListener("click", async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  const btn = $<HTMLButtonElement>("btn-record");
  btn.disabled = true;
  btn.textContent = t("Starting…");
  try {
    await call({ type: "bt:start-request", tabId: tab.id });
    window.close(); // the recording bar appears on the page
  } catch (err) {
    showError(String((err as Error).message));
    btn.disabled = false;
    btn.textContent = t("Record tab");
  }
});

$("btn-screenshot").addEventListener("click", async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  try {
    await call({ type: "bt:screenshot-request", tabId: tab.id });
    window.close();
  } catch (err) {
    showError(String((err as Error).message));
  }
});

$("btn-replay").addEventListener("click", async () => {
  const tab = await activeTab();
  if (tab?.id == null) return;
  try {
    await call({ type: "bt:replay-request", tabId: tab.id });
    window.close();
  } catch (err) {
    showError(String((err as Error).message));
  }
});

$("btn-stop").addEventListener("click", async () => {
  try {
    await call({ type: "bt:stop-request" });
    window.close();
  } catch (err) {
    showError(String((err as Error).message));
  }
});

$("btn-pause").addEventListener("click", async () => {
  await call({ type: "bt:pause-request", pause: !!state.runningSince }).catch((err) => showError(String(err.message)));
});

$("btn-cancel").addEventListener("click", async () => {
  await call({ type: "bt:stop-request", cancel: true }).catch((err) => showError(String(err.message)));
  await renderState();
});

$("btn-logout").addEventListener("click", async () => {
  await logout();
  await render();
});

// ----------------------------- settings -----------------------------

const onPref = (id: string, patch: (el: HTMLInputElement & HTMLSelectElement) => Partial<Prefs> | Promise<Partial<Prefs>>) =>
  $(id).addEventListener("change", async (e) => {
    await savePrefs(await patch(e.target as HTMLInputElement & HTMLSelectElement));
    await Promise.all([renderPrefs(), renderState()]);
  });

onPref("pref-max", (el) => ({ maxMinutes: Number(el.value) as Prefs["maxMinutes"] }));
onPref("pref-autopause", (el) => ({ autoPause: el.checked }));
onPref("pref-idle", (el) => ({ idleSeconds: Number(el.value) }));
onPref("pref-replay", (el) => ({ instantReplay: el.checked }));
onPref("pref-site", async (el) => {
  const tab = await activeTab();
  const origin = new URL(tab!.url!).origin;
  const excluded = (await getPrefs()).replayExcluded.filter((o) => o !== origin);
  return { replayExcluded: el.checked ? excluded : [...excluded, origin] };
});

$("pref-locale").addEventListener("change", async (e) => {
  const locale = (e.target as HTMLSelectElement).value;
  await saveLocale(locale);
  // the site profile keeps the same language (ignored by old servers)
  await api("/api/auth/me/locale", { method: "PUT", body: JSON.stringify({ locale }) }).catch(() => {});
  await render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.state) void renderState();
});

void initI18n().then(render);
