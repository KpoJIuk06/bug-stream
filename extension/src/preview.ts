/**
 * Preview page: the recording opens right after it is stopped.
 * The user watches the video and events, fills in title / description / project and saves the report to the server.
 */

import { ApiError, api, ensureFreshToken, environments, errorText, getSettings } from "./shared/api";
import { mountLogin } from "./shared/login-form";
import { deleteRecording, getRecording, getVideo } from "./shared/db";
import { initI18n, t, translateDom } from "./shared/i18n";
import type { CapturedEvent, Recording } from "./shared/types";
import Player from "rrweb-player";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (el: HTMLElement, visible: boolean) => el.classList.toggle("hidden", !visible);

const recordingId = new URLSearchParams(location.search).get("id") ?? "";
let recording: Recording;
let videoBlob: Blob | null = null;
let video: HTMLVideoElement | null = null;
let player: Player | null = null;
let playerTime = 0;

interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  jiraProjectKey: string | null;
  jiraProjectId: string | null;
}
interface ServiceDto {
  id: string;
  name: string;
  environment: string | null;
  archivedAt: string | null;
}
interface ExternalLink {
  externalKey: string;
  externalUrl: string;
}

/** Environment of each service of the current project — applied when a service is picked. */
let serviceEnv = new Map<string, string | null>();
/** The person picked the environment themselves — do not override it any more. */
let envTouched = false;
let projects: ProjectSummary[] = [];
/** The user's role may create Jira issues (unknown on old servers — the server decides). */
let canSendJira = true;
const JIRA_PREF = "jiraChoice"; // { [projectId]: boolean } — last choice per project

// ============================== start ==============================

async function main() {
  await initI18n();
  translateDom();
  const r = await getRecording(recordingId);
  if (!r) {
    show($("missing"), true);
    return;
  }
  if (r.status !== "done") {
    show($("missing"), true);
    $("missing-text").textContent = t("This recording is still running. Stop it and the report will open by itself.");
    return;
  }
  recording = r;
  videoBlob = r.kind === "video" ? await getVideo(r) : null;
  const s = await getSettings();
  if (!s.refreshToken) {
    showLogin(s.server);
    return;
  }
  const perms = s.user?.permissions;
  canSendJira = !perms || perms.includes("report.send_tracker");
  $("user-label").textContent = `${s.user?.fullName ?? ""} — ${s.server.replace(/^https?:\/\//, "")}`;
  show($("editor"), true);
  document.title = `${r.kind === "replay" ? "Instant replay" : t("New report")} — Bug Stream`;
  $("kind-label").textContent = r.kind === "replay" ? t("Instant replay — last 2 minutes") : r.kind === "screenshot" ? t("Screenshot") : t("New report");
  renderMedia();
  renderEvents();
  fillForm();
  void loadEnvironments();
  void loadProjects();
}

function showLogin(server: string) {
  show($("login"), true);
  mountLogin($("login-root"), server, async () => {
    show($("login"), false);
    await main();
  });
}

// ============================== video and events ==============================

/** Instant replay: the rrweb DOM recording is played right on the preview page. */
async function renderReplay(media: HTMLElement, gz: Blob) {
  media.classList.add("replay");
  try {
    const text = await new Response(gz.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    const events = JSON.parse(text);
    const width = Math.max(320, media.clientWidth);
    player = new Player({
      target: media,
      props: { events, width, height: Math.round(width * 0.56), autoPlay: false, showController: true, skipInactive: false, speedOption: [1, 2, 4] },
    });
    player.addEventListener("ui-update-current-time", (p) => {
      playerTime = (p as { payload: number }).payload;
      updateHead();
    });
  } catch (e) {
    media.innerHTML = `<div class="no-video">${t("Could not open the page recording")}</div>`;
    console.error(e);
  }
}

function renderMedia() {
  const media = $("media");
  if (recording.replay) {
    void renderReplay(media, recording.replay);
  } else if (videoBlob) {
    video = document.createElement("video");
    video.src = URL.createObjectURL(videoBlob);
    video.controls = true;
    video.playsInline = true;
    video.addEventListener("timeupdate", updateHead);
    media.appendChild(video);
  } else if (recording.screenshot) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(recording.screenshot);
    img.alt = t("Page screenshot");
    media.appendChild(img);
  } else {
    media.innerHTML = `<div class="no-video">${t("No video")}</div>`;
  }
}

const toneColor = (e: CapturedEvent) => {
  if (e.kind === "console") return e.level === "error" ? "var(--error)" : e.level === "warn" ? "var(--warn)" : "var(--faint)";
  if (e.kind === "network") return isNetError(e) ? "var(--error)" : "var(--network)";
  if (e.kind === "action") return "var(--action)";
  if (e.kind === "navigation") return "var(--nav)";
  return "var(--faint)";
};
const isNetError = (e: CapturedEvent) => e.kind === "network" && (!e.status || e.status >= 400);
const timecode = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const KIND: Record<string, string> = { console: "Console", network: "Network", action: "Action", navigation: "Navigation", custom: "Log" };

function seek(ms: number) {
  if (player) {
    player.goto(ms);
    playerTime = ms;
    updateHead();
  } else if (video) {
    video.currentTime = ms / 1000;
    updateHead();
  }
}

function updateHead() {
  const total = Math.max(recording.durationMs, 1);
  const now = player ? playerTime : video ? video.currentTime * 1000 : 0;
  $("head").style.left = `${Math.min(100, (now / total) * 100)}%`;
}

function renderEvents() {
  const events = recording.events;
  const total = Math.max(recording.durationMs, events.at(-1)?.t ?? 0, 1);
  const track = $("track");
  for (const e of events) {
    const tick = document.createElement("span");
    tick.className = "tick";
    tick.style.left = `${((e.t ?? 0) / total) * 100}%`;
    tick.style.background = toneColor(e);
    track.appendChild(tick);
  }
  if (!video && !recording.replay) show($("head"), false);
  track.addEventListener("click", (ev) => {
    const r = track.getBoundingClientRect();
    seek(((ev.clientX - r.left) / r.width) * total);
  });

  const consoleErr = events.filter((e) => e.kind === "console" && e.level === "error").length;
  const netErr = events.filter(isNetError).length;
  const requests = events.filter((e) => e.kind === "network").length;
  const actions = events.filter((e) => e.kind === "action").length;
  const counters: [string, boolean][] = [
    [t("{n} console errors", { n: consoleErr }), consoleErr > 0],
    [t("{n} network errors", { n: netErr }), netErr > 0],
    [t("{n} requests", { n: requests }), false],
    [t("{n} actions", { n: actions }), false],
  ];
  $("counters").innerHTML = counters
    .map(([label, err]) => `<span class="counter${err ? " err" : ""}">${err ? '<i style="background:var(--error)"></i>' : ""}${label}</span>`)
    .join("");

  const list = $("events");
  if (events.length === 0) {
    list.innerHTML = `<li style="cursor:default;grid-template-columns:1fr"><span class="muted">${t("No events")}</span></li>`;
    return;
  }
  for (const e of events) {
    const li = document.createElement("li");
    const err = (e.kind === "console" && e.level === "error") || isNetError(e);
    if (err) li.classList.add("error");
    else if (e.kind === "console" && e.level === "warn") li.classList.add("warn");
    li.innerHTML = `<span class="t"></span><span class="k"></span><span class="s"></span>`;
    (li.children[0] as HTMLElement).textContent = timecode(e.t ?? 0);
    const pauseMark = e.kind === "custom" && (e.payload?.type === "pause" || e.payload?.type === "resume");
    (li.children[1] as HTMLElement).textContent = pauseMark ? t("Recording") : KIND[e.kind] ? t(KIND[e.kind]) : e.kind;
    if (e.payload?.frame) li.title = `${e.summary}\niframe: ${e.payload.frame}`;
    (li.children[1] as HTMLElement).style.color = toneColor(e);
    (li.children[2] as HTMLElement).textContent = e.summary;
    if (!li.title) li.title = e.summary;
    li.addEventListener("click", () => seek(e.t ?? 0));
    list.appendChild(li);
  }
}

// ============================== form ==============================

function fillForm() {
  const info = recording.info;
  $("page-url").textContent = info?.pageUrl ?? "";
  // Title hint: the first console or network error
  const firstError = recording.events.find((e) => (e.kind === "console" && e.level === "error") || isNetError(e));
  const title = $<HTMLInputElement>("title");
  title.placeholder = firstError ? firstError.summary.slice(0, 120) : t("What went wrong");
  // with an error the hint itself becomes the title when the field is left empty
  title.required = !firstError;
  title.focus();
}

/** Environments come from the admin panel; old servers without the endpoint get the classic four. */
async function loadEnvironments() {
  const select = $<HTMLSelectElement>("environment");
  let list = (await environments()).filter((e) => e.active !== false);
  if (!list.length) list = ["DEV", "TEST", "STAGE", "PROD"].map((code) => ({ code, name: code, color: "", active: true }));
  const current = select.value;
  for (const e of list) {
    if ([...select.options].some((o) => o.value === e.code)) continue;
    select.add(new Option(e.name && e.name !== e.code ? `${e.code} — ${e.name}` : e.code, e.code));
  }
  select.value = current;
  applyServiceEnv();
}

function projectLabel(p: ProjectSummary) {
  return `${p.key} — ${p.name}${p.jiraProjectKey && p.jiraProjectKey !== p.key ? ` · Jira ${p.jiraProjectKey}` : ""}`;
}

/**
 * Project picker: one field — type to filter by name, key or Jira key / ID, pick from the list.
 * The hidden <select id="project"> keeps the value, so the rest of the form reads it as before.
 */
function projectCombo() {
  const input = $<HTMLInputElement>("project-input");
  const list = $<HTMLUListElement>("project-list");
  const select = $<HTMLSelectElement>("project");
  let active = 0;
  let shown: (ProjectSummary | null)[] = [];

  const labelOf = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? projectLabel(p) : "";
  };
  const setValue = (id: string) => {
    if (![...select.options].some((o) => o.value === id)) select.add(new Option(id, id));
    const changed = select.value !== id;
    select.value = id;
    input.value = labelOf(id);
    close();
    if (changed) select.dispatchEvent(new Event("change"));
  };
  const close = () => {
    show(list, false);
    input.setAttribute("aria-expanded", "false");
  };
  const render = () => {
    const q = input.value === labelOf(select.value) ? "" : input.value.trim().toLowerCase();
    const match = (p: ProjectSummary) =>
      !q || [p.key, p.name, p.jiraProjectKey ?? "", p.jiraProjectId ?? ""].some((v) => v.toLowerCase().includes(q));
    shown = [...(q ? [] : [null]), ...projects.filter(match).slice(0, 100)];
    list.innerHTML = "";
    if (shown.length === 0) {
      const li = document.createElement("li");
      li.className = "combo-empty";
      li.textContent = t("Nothing found");
      list.appendChild(li);
    }
    shown.forEach((p, i) => {
      const li = document.createElement("li");
      li.role = "option";
      li.id = `project-opt-${i}`;
      li.className = i === active ? "active" : "";
      li.setAttribute("aria-selected", String((p?.id ?? "") === select.value));
      if (p) {
        const key = document.createElement("b");
        key.textContent = p.key;
        const name = document.createElement("span");
        name.textContent = p.name;
        li.append(key, name);
        if (p.jiraProjectKey && p.jiraProjectKey !== p.key) {
          const j = document.createElement("small");
          j.textContent = `Jira ${p.jiraProjectKey}`;
          li.appendChild(j);
        }
      } else {
        li.textContent = t("No project");
        li.classList.add("muted");
      }
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        setValue(p?.id ?? "");
      });
      list.appendChild(li);
    });
    input.setAttribute("aria-activedescendant", `project-opt-${active}`);
    show(list, true);
    input.setAttribute("aria-expanded", "true");
  };

  input.addEventListener("focus", () => {
    input.select();
    active = 0;
    render();
  });
  input.addEventListener("input", () => {
    active = 0;
    render();
  });
  input.addEventListener("blur", () => {
    close();
    input.value = labelOf(select.value);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      active = Math.max(0, Math.min(shown.length - 1, active + (e.key === "ArrowDown" ? 1 : -1)));
      render();
      list.querySelector(".active")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active] !== undefined) setValue(shown[active]?.id ?? "");
    } else if (e.key === "Escape") {
      input.value = labelOf(select.value);
      close();
    }
  });
  return { setValue, refreshLabel: () => (input.value = labelOf(select.value)) };
}

async function loadProjects() {
  const select = $<HTMLSelectElement>("project");
  const combo = projectCombo();
  try {
    projects = await api<ProjectSummary[]>("/api/projects");
    const url = recording.info?.pageUrl;
    if (url) {
      const r = await api<{ matched: boolean; projectId: string; serviceId: string; projectKey: string; serviceName: string }>(
        `/api/projects/resolve?url=${encodeURIComponent(url)}`,
      );
      if (r.matched) {
        if (![...select.options].some((o) => o.value === r.projectId)) select.add(new Option(r.projectId, r.projectId));
        select.value = r.projectId;
        combo.refreshLabel();
        await loadServices(r.projectId, r.serviceId);
        $("match").textContent = t("Detected from the page address: {project} / {service}", { project: r.projectKey, service: r.serviceName });
        show($("match"), true);
      }
    }
  } catch (err) {
    showError(errorText(err));
  }
  void updateJira();
  select.addEventListener("change", () => {
    show($("match"), false);
    void loadServices(select.value, null);
    void updateJira();
  });
  $<HTMLSelectElement>("service").addEventListener("change", () => applyServiceEnv());
  $<HTMLSelectElement>("environment").addEventListener("change", () => {
    envTouched = true;
    show($("env-hint"), false);
  });
  $<HTMLInputElement>("send-jira").addEventListener("change", () => void rememberJira());
}

/** Environment of the selected service, until the person picks one themselves. */
function applyServiceEnv() {
  if (envTouched) return;
  const env = serviceEnv.get($<HTMLSelectElement>("service").value) ?? null;
  if (!env) return;
  const select = $<HTMLSelectElement>("environment");
  if (![...select.options].some((o) => o.value === env)) select.add(new Option(env, env));
  select.value = env;
  show($("env-hint"), true);
}

/** "Create a Jira issue" — only for projects linked to Jira by an administrator. */
async function updateJira() {
  const projectId = $<HTMLSelectElement>("project").value;
  const p = projects.find((x) => x.id === projectId);
  show($("jira-notice"), false);
  if (!p?.jiraProjectKey || !canSendJira) {
    show($("jira-field"), false);
    return;
  }
  $("jira-label").textContent = t("Create an issue in Jira ({key})", { key: p.jiraProjectKey });
  const prefs = ((await chrome.storage.local.get(JIRA_PREF))[JIRA_PREF] ?? {}) as Record<string, boolean>;
  $<HTMLInputElement>("send-jira").checked = prefs[projectId] ?? false;
  show($("jira-field"), true);
  // A missing or expired personal token is shown right away, before saving
  try {
    const my = await api<{ configured: boolean; connected: boolean; invalid: boolean }>("/api/me/jira");
    if (!my.configured) show($("jira-field"), false);
    else if (!my.connected || my.invalid) await jiraTokenNotice(my.invalid ? "JIRA_TOKEN_INVALID" : "JIRA_TOKEN_MISSING");
  } catch {
    /* old server — the send itself will tell */
  }
}

async function jiraTokenNotice(code: string) {
  const s = await getSettings();
  const out = $("jira-notice");
  out.textContent = code === "JIRA_TOKEN_INVALID" ? t("Your Jira token has expired or was revoked.") : t("Add your Jira API token to create issues.");
  out.append(" ");
  const a = document.createElement("a");
  a.href = `${s.server}/profile#jira`;
  a.target = "_blank";
  a.textContent = t("Open profile");
  out.appendChild(a);
  show(out, true);
}

async function rememberJira() {
  const projectId = $<HTMLSelectElement>("project").value;
  if (!projectId) return;
  const prefs = ((await chrome.storage.local.get(JIRA_PREF))[JIRA_PREF] ?? {}) as Record<string, boolean>;
  prefs[projectId] = $<HTMLInputElement>("send-jira").checked;
  await chrome.storage.local.set({ [JIRA_PREF]: prefs });
}

async function loadServices(projectId: string, selected: string | null) {
  const select = $<HTMLSelectElement>("service");
  select.innerHTML = "";
  if (!projectId) {
    show($("service-field"), false);
    return;
  }
  const d = await api<{ services: ServiceDto[] }>(`/api/projects/${projectId}`);
  const services = d.services.filter((s) => !s.archivedAt);
  serviceEnv = new Map(services.map((s) => [s.id, s.environment]));
  show($("service-field"), services.length > 0);
  select.add(new Option(t("Not selected"), ""));
  for (const s of services) select.add(new Option(s.environment ? `${s.name} · ${s.environment}` : s.name, s.id));
  select.value = selected ?? "";
  applyServiceEnv();
}

function showError(text: string | null) {
  $("error").textContent = text ?? "";
  show($("error"), !!text);
}

// ============================== thumbnail ==============================

async function makeThumbnail(): Promise<Blob | null> {
  const width = 480;
  try {
    let source: CanvasImageSource;
    let w: number;
    let h: number;
    if (recording.screenshot) {
      const bmp = await createImageBitmap(recording.screenshot);
      source = bmp;
      w = bmp.width;
      h = bmp.height;
    } else if (videoBlob) {
      const v = document.createElement("video");
      v.muted = true;
      v.src = URL.createObjectURL(videoBlob);
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error("video"));
      });
      // a frame near the first error if there is one, otherwise after one second
      const firstError = recording.events.find((e) => (e.kind === "console" && e.level === "error") || isNetError(e));
      const target = Math.min(((firstError?.t ?? 1000) + 300) / 1000, Math.max(0, recording.durationMs / 1000 - 0.2));
      await new Promise<void>((resolve) => {
        v.onseeked = () => resolve();
        v.currentTime = target;
        setTimeout(resolve, 1500);
      });
      source = v;
      w = v.videoWidth;
      h = v.videoHeight;
    } else return null;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((h / w) * width);
    canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

// ============================== saving ==============================

function upload(server: string, token: string | null, form: FormData, onProgress: (p: number) => void): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${server}/api/reports`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new TypeError("network"));
    xhr.send(form);
  });
}

$<HTMLFormElement>("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const save = $<HTMLButtonElement>("save");
  const title = $<HTMLInputElement>("title").value.trim() || $<HTMLInputElement>("title").placeholder;
  save.disabled = true;
  save.textContent = t("Saving…");
  showError(null);
  show($("progress"), true);

  try {
    const info = recording.info;
    const meta = {
      title,
      description: $<HTMLTextAreaElement>("description").value.trim() || null,
      projectId: $<HTMLSelectElement>("project").value || null,
      serviceId: $<HTMLSelectElement>("service").value || null,
      severity: $<HTMLSelectElement>("severity").value || null,
      environment: $<HTMLSelectElement>("environment").value || null,
      tags: $<HTMLInputElement>("tags")
        .value.split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
      source: recording.kind === "screenshot" ? "SCREENSHOT" : recording.kind === "replay" ? "REPLAY" : "EXTENSION",
      pageUrl: info?.pageUrl ?? "about:blank",
      pageTitle: info?.pageTitle ?? null,
      recordedAt: new Date(recording.startTs).toISOString(),
      durationMs: recording.kind === "screenshot" ? 0 : recording.durationMs,
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
      extensionVersion: chrome.runtime.getManifest().version,
    };

    const form = new FormData();
    form.append("meta", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    form.append("events", new Blob([JSON.stringify(recording.events)], { type: "application/json" }));
    if (videoBlob) form.append("video", videoBlob, "video.webm");
    if (recording.replay) form.append("replay", recording.replay, "replay.json.gz");
    if (recording.screenshot) form.append("screenshot", recording.screenshot, "screenshot.png");
    const thumb = await makeThumbnail();
    if (thumb) form.append("thumbnail", thumb, "thumbnail.jpg");

    const s = await getSettings();
    const token = await ensureFreshToken();
    const res = await upload(s.server, token, form, (p) => ($("progress-bar").style.width = `${Math.round(p * 100)}%`));
    if (res.status < 200 || res.status >= 300) {
      let detail = `HTTP ${res.status}`;
      try {
        detail = JSON.parse(res.body).detail ?? detail;
      } catch {
        /* not JSON */
      }
      throw new Error(res.status === 401 ? t("Your session has expired — sign in to the extension again") : t("The server rejected the report: {detail}", { detail }));
    }
    const report = JSON.parse(res.body) as { id: string; project: { id: string } | null };
    await deleteRecording(recording.id);

    // The Jira issue is a separate request: if Jira fails, the report is still saved
    const sendJira = $<HTMLInputElement>("send-jira").checked && !$("jira-field").classList.contains("hidden");
    if (sendJira && report.project) {
      save.textContent = t("Creating the Jira issue…");
      const out = $("tracker-result");
      try {
        const issue = await api<ExternalLink>(`/api/reports/${report.id}/jira`, { method: "POST", body: "{}" });
        out.textContent = t("Jira issue created:") + " ";
        const a = document.createElement("a");
        a.href = issue.externalUrl;
        a.target = "_blank";
        a.textContent = issue.externalKey;
        out.appendChild(a);
        out.classList.remove("warn");
      } catch (err) {
        const code = err instanceof ApiError ? err.code : undefined;
        if (code === "JIRA_TOKEN_MISSING" || code === "JIRA_TOKEN_INVALID") {
          out.textContent = (code === "JIRA_TOKEN_INVALID" ? t("Your Jira token has expired or was revoked.") : t("Add your Jira API token to create issues.")) + " ";
          const a = document.createElement("a");
          a.href = `${s.server}/profile#jira`;
          a.target = "_blank";
          a.textContent = t("Open profile");
          out.appendChild(a);
          out.append(" " + t("Then send the report to Jira from its page."));
        } else {
          out.textContent = t("The Jira issue was not created: {error}. You can send it from the report page.", { error: errorText(err) });
        }
        out.classList.add("warn");
      }
      show(out, true);
    }

    const link = `${s.server}/reports/${report.id}`;
    show($("form"), false);
    show($("done"), true);
    $<HTMLAnchorElement>("open-report").href = link;
    $("copy-link").addEventListener("click", async () => {
      await navigator.clipboard.writeText(link);
      $("copy-link").textContent = t("Link copied");
    });
    $("close-tab").addEventListener("click", () => window.close());
  } catch (err) {
    showError(err instanceof TypeError ? t("The server is unreachable. The recording stays in the extension — try again.") : (err as Error).message);
    save.disabled = false;
    save.textContent = t("Save report");
    show($("progress"), false);
  }
});

$("discard").addEventListener("click", async () => {
  if (!confirm(t("Delete the recording without saving?"))) return;
  await deleteRecording(recording.id);
  window.close();
});

void main();
