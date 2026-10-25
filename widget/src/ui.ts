/**
 * Widget UI: everything is drawn in the shadow DOM of a single <bug-stream> element,
 * so site styles do not affect the widget and widget styles do not affect the site.
 */

export const HOST_TAG = "bug-stream";

const CSS = `
:host { all: initial; }
.root { --bs-primary: #0d6e6e; --bs-primary-dark: color-mix(in srgb, var(--bs-primary) 82%, #000); --bs-primary-soft: color-mix(in srgb, var(--bs-primary) 12%, #fff); }
* { box-sizing: border-box; }
.root { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #18202c; }
button { font: inherit; color: inherit; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 34px; padding: 0 14px;
  border-radius: 7px; border: 1px solid #dce1e8; background: #fff; cursor: pointer; font-weight: 500; white-space: nowrap; }
.btn:hover:not(:disabled) { border-color: #8a94a3; }
.btn:disabled { opacity: .55; cursor: default; }
.btn.primary { background: var(--bs-primary); border-color: var(--bs-primary); color: #fff; }
.btn.primary:hover:not(:disabled) { background: var(--bs-primary-dark); }
.btn.ghost { border-color: transparent; background: transparent; color: #5b6676; }
.btn.ghost:hover { background: #e9edf2; color: #18202c; }
.btn.danger { color: #d1343e; }
:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: 2px; }

/* floating button */
.fab { position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; height: 40px; padding: 0 16px; border-radius: 999px;
  border: 0; background: #18202c; color: #fff; cursor: pointer; font-weight: 500; box-shadow: 0 8px 24px -8px rgba(0,0,0,.45);
  display: inline-flex; align-items: center; gap: 8px; }
.fab:hover { background: #2a3443; }
.fab i { width: 8px; height: 8px; border-radius: 50%; background: #ff5d68; }

/* menu */
.backdrop { position: fixed; inset: 0; z-index: 2147483600; background: rgba(24,32,44,.18); }
.menu { position: fixed; z-index: 2147483601; top: 64px; right: 24px; width: 312px; max-width: calc(100vw - 32px);
  background: #fff; border: 1px solid #dce1e8; border-radius: 10px; padding: 8px; box-shadow: 0 16px 40px -12px rgba(24,32,44,.35); }
.menu h2 { margin: 4px 8px 8px; font-size: 13px; font-weight: 600; color: #5b6676; }
.item { all: unset; box-sizing: border-box; display: flex; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 7px; cursor: pointer; }
.item:hover:not([aria-disabled="true"]) { background: #f3f5f8; }
.item:focus-visible { outline: 2px solid var(--bs-primary); outline-offset: -2px; }
.item[aria-disabled="true"] { opacity: .5; cursor: default; }
.ic { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 12px; color: #fff; }
.item b { display: block; font-weight: 500; }
.item small { display: block; margin-top: 1px; font-size: 12px; color: #8a94a3; }

/* recording bar */
.bar { position: fixed; z-index: 2147483500; left: 50%; bottom: 20px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px;
  padding: 6px 6px 6px 14px; border-radius: 999px; background: #18202c; color: #fff; font-weight: 500; font-size: 13px;
  box-shadow: 0 10px 30px -8px rgba(0,0,0,.45); user-select: none; max-width: calc(100vw - 32px); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: #ff5d68; animation: pulse 1.2s ease-in-out infinite; flex: none; }
.bar.paused .dot { background: #8a94a3; animation: none; }
@keyframes pulse { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
.time { font-variant-numeric: tabular-nums; white-space: nowrap; }
.time small { color: rgba(255,255,255,.5); font-size: 11px; }
.bar button { all: unset; cursor: pointer; height: 28px; padding: 0 12px; border-radius: 999px; white-space: nowrap; }
.bar .pause { background: rgba(255,255,255,.12); }
.bar .pause:hover { background: rgba(255,255,255,.2); }
.bar .stop { background: #fff; color: #18202c; display: inline-flex; align-items: center; gap: 6px; }
.bar .stop::before { content: ""; width: 9px; height: 9px; border-radius: 2px; background: #d1343e; }
.bar .cancel { color: rgba(255,255,255,.7); }
.bar .cancel:hover { color: #fff; background: rgba(255,255,255,.1); }

/* report form */
.modal-wrap { position: fixed; inset: 0; z-index: 2147483602; background: rgba(24,32,44,.45); display: grid; place-items: center; padding: 16px; overflow: auto; }
.modal { width: 640px; max-width: 100%; background: #fff; border-radius: 12px; box-shadow: 0 24px 60px -16px rgba(0,0,0,.45); overflow: hidden; }
.modal header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid #e9edf2; }
.modal header h1 { margin: 0; font-size: 16px; font-weight: 600; flex: 1; }
.modal header .proj { font-size: 12px; color: #8a94a3; }
.modal .x { all: unset; cursor: pointer; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: #5b6676; font-size: 18px; }
.modal .x:hover { background: #e9edf2; }
.media { background: #141a23; max-height: 300px; display: grid; place-items: center; }
.media video, .media img { display: block; max-width: 100%; max-height: 300px; }
.media .note { color: rgba(255,255,255,.7); padding: 28px 16px; text-align: center; font-size: 13px; }
.counters { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 18px 0; }
.counter { height: 24px; padding: 0 9px; border-radius: 999px; background: #f3f5f8; color: #5b6676; font-size: 12px; display: inline-flex; align-items: center; }
.counter.err { background: #fdecee; color: #d1343e; }
.body { padding: 14px 18px 4px; display: grid; gap: 12px; }
label.f { display: block; }
label.f > span { display: block; margin-bottom: 4px; font-size: 13px; font-weight: 500; color: #5b6676; }
input, select, textarea { width: 100%; border: 1px solid #dce1e8; border-radius: 7px; background: #fff; color: #18202c; font: inherit; padding: 0 10px; }
input, select { height: 36px; }
textarea { padding: 8px 10px; resize: vertical; min-height: 84px; }
input:focus, select:focus, textarea:focus { border-color: var(--bs-primary); outline: none; }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 520px) { .row2 { grid-template-columns: 1fr; } }
.err-box { border: 1px solid rgba(209,52,62,.3); background: #fdecee; color: #d1343e; border-radius: 7px; padding: 8px 10px; font-size: 13px; }
.progress { height: 6px; border-radius: 999px; background: #e9edf2; overflow: hidden; }
.progress div { height: 100%; width: 0; background: var(--bs-primary); transition: width .2s; }
.modal footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px 16px; }
.done { padding: 28px 18px; text-align: center; }
.done .check { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #e3f1f0; color: var(--bs-primary); font-size: 24px; margin-bottom: 10px; }
.done h2 { margin: 0 0 6px; font-size: 17px; }
.done p { margin: 0 0 16px; color: #5b6676; }
.done .actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

/* toast */
.toast { position: fixed; z-index: 2147483603; top: 20px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px);
  display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 14px; border-radius: 8px; background: #18202c; color: #fff;
  font-size: 13px; box-shadow: 0 10px 30px -8px rgba(0,0,0,.45); }
.toast .btn { height: 28px; padding: 0 10px; font-size: 12px; }
`;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;

/** Widget root; created on first use. */
export function shadow(): ShadowRoot {
  if (root && host?.isConnected) return root;
  host = document.createElement(HOST_TAG);
  root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${CSS}</style><div class="root"></div>`;
  (document.body ?? document.documentElement).appendChild(host);
  return root;
}

export function layer(): HTMLElement {
  return shadow().querySelector(".root") as HTMLElement;
}

/** Brand color (buttons, accents). */
export function setBrandColor(color: string | undefined) {
  const r = layer();
  if (color) r.style.setProperty("--bs-primary", color);
  else r.style.removeProperty("--bs-primary");
}

/** Temporarily hide the widget (it must not be on the screenshot). */
export function setHidden(hidden: boolean) {
  if (host) host.style.display = hidden ? "none" : "";
}

/** Element from an HTML string. */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toast(text: string, action?: { label: string; onClick: () => void }, ms = 6000) {
  const t = el(`<div class="toast" role="status"><span>${esc(text)}</span></div>`);
  if (action) {
    const b = el<HTMLButtonElement>(`<button class="btn primary">${esc(action.label)}</button>`);
    b.onclick = () => {
      t.remove();
      action.onClick();
    };
    t.appendChild(b);
  }
  layer().appendChild(t);
  if (ms) setTimeout(() => t.remove(), ms);
}

export const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
