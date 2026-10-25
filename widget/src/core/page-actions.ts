/**
 * User actions (clicks, input, selection, form submits, Enter/Escape) and page details (Info).
 * Shared by the extension (content-isolated.js) and the site widget.
 */

import type { CapturedEvent, PageInfo } from "./types";

export function installActionCapture(handle: (e: CapturedEvent) => void, isOurUi: (el: Element | null) => boolean): void {


  let lastLabelClick: { control: Element | null; ts: number } = { control: null, ts: 0 };
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element | null;
      if (!target || isOurUi(target)) return;
      // The second and further clicks of a series are a double click — recorded by the dblclick handler
      if (e.detail > 1) return;
      // A click on <label> is repeated by the browser on its field — the second is not recorded
      if (lastLabelClick.control === target && Date.now() - lastLabelClick.ts < 300) return;
      const labelEl = target.closest("label");
      if (labelEl) lastLabelClick = { control: (labelEl as HTMLLabelElement).control, ts: Date.now() };
      const el = (target.closest("a,button,[role=button],input,select,textarea,label,summary,[onclick],[role=tab],[role=menuitem],[role=option]") ?? target) as HTMLElement;
      const label = labelOf(el);
      handle({
        kind: "action",
        ts: Date.now(),
        level: "click",
        summary: label ? `Click "${label}"` : `Click on ${el.tagName.toLowerCase()}`,
        payload: {
          selector: selectorOf(el),
          tag: el.tagName.toLowerCase(),
          text: label || undefined,
          href: (el as HTMLAnchorElement).href || undefined,
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
        },
      });
    },
    true,
  );

  document.addEventListener(
    "dblclick",
    (e) => {
      const target = e.target as Element | null;
      if (!target || isOurUi(target)) return;
      const el = (target.closest("a,button,[role=button],input,select,textarea,label,td,li") ?? target) as HTMLElement;
      const label = labelOf(el);
      handle({
        kind: "action",
        ts: Date.now(),
        level: "dblclick",
        summary: label ? `Double click "${label}"` : `Double click on ${el.tagName.toLowerCase()}`,
        payload: { selector: selectorOf(el), tag: el.tagName.toLowerCase(), text: label || undefined },
      });
    },
    true,
  );

  // Input: one event per field after a pause, not per letter
  const pending = new Map<Element, number>();
  const lastValue = new WeakMap<Element, string>();
  const reportInput = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    pending.delete(el);
    const raw = el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") ? String(el.checked) : el.value;
    if (lastValue.get(el) === raw) return;
    lastValue.set(el, raw);
    const label = fieldLabel(el);
    let value: string;
    if (el instanceof HTMLSelectElement) value = el.selectedOptions[0]?.text ?? el.value;
    else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) value = el.checked ? "checked" : "unchecked";
    else if (el instanceof HTMLInputElement && el.type === "password") value = "•".repeat(Math.min(el.value.length, 12));
    else value = el.value.length > 500 ? el.value.slice(0, 500) + "…" : el.value;
    handle({
      kind: "action",
      ts: Date.now(),
      level: el instanceof HTMLSelectElement || (el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio" ? "change" : "input",
      summary: `${el instanceof HTMLSelectElement ? "Select" : "Input"} "${label}": ${value || "(empty)"}`,
      payload: { selector: selectorOf(el), tag: el.tagName.toLowerCase(), type: (el as HTMLInputElement).type, value },
    });
  };
  document.addEventListener(
    "input",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (!el || isOurUi(el) || !("value" in el)) return;
      clearTimeout(pending.get(el));
      pending.set(el, window.setTimeout(() => reportInput(el), 800));
    },
    true,
  );
  document.addEventListener(
    "change",
    (e) => {
      const el = e.target as HTMLInputElement;
      if (!el || isOurUi(el) || !("value" in el)) return;
      clearTimeout(pending.get(el));
      reportInput(el);
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => {
      const form = e.target as HTMLFormElement;
      handle({
        kind: "action",
        ts: Date.now(),
        level: "submit",
        summary: `Form submit${form.getAttribute("name") ? ` "${form.getAttribute("name")}"` : ""}`,
        payload: { selector: selectorOf(form), action: form.action || undefined },
      });
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== "Escape") return;
      if (isOurUi(e.target as Element)) return;
      handle({
        kind: "action",
        ts: Date.now(),
        level: "key",
        summary: `Key ${e.key}`,
        payload: { key: e.key, selector: selectorOf(e.target as Element) },
      });
    },
    true,
  );
}

// ============================== describing elements ==============================

function clean(s: string | null | undefined, max = 60): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function labelOf(el: HTMLElement): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el instanceof HTMLInputElement && ["button", "submit", "reset"].includes(el.type)) return clean(el.value);
    return fieldLabel(el);
  }
  return clean(el.getAttribute("aria-label")) || clean(el.innerText) || clean(el.getAttribute("title")) || clean((el as HTMLImageElement).alt) || "";
}

function fieldLabel(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  const byFor = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
  const wrapping = el.closest("label");
  const labelledBy = el.getAttribute("aria-labelledby");
  const byAria = labelledBy ? document.getElementById(labelledBy.split(" ")[0]) : null;
  return (
    clean(el.getAttribute("aria-label")) ||
    clean(byFor?.textContent) ||
    clean(byAria?.textContent) ||
    clean(wrapping?.textContent) ||
    clean((el as HTMLInputElement).placeholder) ||
    clean(el.name) ||
    el.tagName.toLowerCase()
  );
}

/** The class looks generated (CSS modules, styled-components): digits, hash, underscores, capitals. */
const isGeneratedClass = (c: string) =>
  /\d|_|[A-Z]/.test(c) || c.length > 32 || /^(active|hover|focus|selected|open|show|is-|has-)/.test(c) || /^(css|sc|jsx|svelte|prc)-/.test(c);

/** A stable attribute that finds the element unambiguously. */
function stableAttr(node: Element): string | null {
  for (const attr of ["data-testid", "data-test", "data-qa", "data-cy", "name", "aria-label"]) {
    const v = node.getAttribute(attr);
    if (v && v.length <= 60) return `${node.tagName.toLowerCase()}[${attr}="${v.replace(/"/g, '\\"')}"]`;
  }
  return null;
}

/** A short CSS selector a developer can use to find the element. */
export function selectorOf(el: Element | null): string {
  if (!el || !(el instanceof Element)) return "";
  const parts: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; node && depth < 4 && node !== document.body; depth++) {
    if (node.id && !/\d{3,}|[:.]/.test(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const stable = stableAttr(node);
    if (stable) {
      parts.unshift(stable);
      break;
    }
    let part = node.tagName.toLowerCase();
    const classes = [...node.classList].filter((c) => !isGeneratedClass(c)).slice(0, 2);
    if (classes.length) part += "." + classes.map((c) => CSS.escape(c)).join(".");
    const parent: Element | null = node.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(" > ");
}

// ============================== page details ==============================

export async function collectInfo(): Promise<PageInfo> {
  const nav = navigator as any;
  let os = nav.userAgentData?.platform || navigator.platform || "";
  let osVersion: string | null = null;
  let browser = "Chrome";
  let browserVersion: string | null = null;
  try {
    const hi = await nav.userAgentData?.getHighEntropyValues(["platformVersion", "fullVersionList"]);
    if (hi) {
      if (os === "Windows" && hi.platformVersion) osVersion = Number(hi.platformVersion.split(".")[0]) >= 13 ? "11" : "10";
      else if (hi.platformVersion) osVersion = hi.platformVersion;
      const brand = (hi.fullVersionList as { brand: string; version: string }[] | undefined)?.find((b) =>
        /Google Chrome|Microsoft Edge|Opera|Yandex|Chromium/.test(b.brand),
      );
      if (brand) {
        browser = brand.brand.replace("Google ", "");
        browserVersion = brand.version;
      }
    }
  } catch {
    /* no userAgentData */
  }
  if (!browserVersion) browserVersion = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? null;
  if (os === "macOS" || os === "MacIntel") os = "macOS";

  const conn = nav.connection;
  const region = navigator.language.split("-")[1];
  let location: string | null = null;
  try {
    location = region ? new Intl.DisplayNames(["en"], { type: "region" }).of(region.toUpperCase()) ?? null : null;
  } catch {
    /* ignore */
  }

  return {
    pageUrl: window.location.href,
    pageTitle: document.title,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
    location,
    os,
    osVersion,
    browser,
    browserVersion,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    screenSize: `${screen.width}x${screen.height}`,
    devicePixelRatio: Math.round(window.devicePixelRatio * 100) / 100,
    networkType: conn?.effectiveType ?? null,
    networkDownlink: conn?.downlink ?? null,
    networkRtt: conn?.rtt ?? null,
  };
}
