// Extension types. Shared ones (event, page details, recording) are in src/core.

import type { CapturedEvent, PageInfo } from "../core/types";
export type { CapturedEvent, PageInfo, Recording } from "../core/types";

export interface Settings {
  server: string;
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; fullName: string; email: string; role: string; locale?: string; permissions?: string[] } | null;
}

/** Recording settings (chrome.storage.local, key prefs). */
export interface Prefs {
  /** Maximum video length, minutes. */
  maxMinutes: 5 | 10 | 20 | 30;
  /** Pause recording when the person does nothing. */
  autoPause: boolean;
  idleSeconds: number;
  /** Instant replay: always keep a DOM recording of the last 2 minutes. */
  instantReplay: boolean;
  /** Sites (origins) where instant replay is off. */
  replayExcluded: string[];
}

export const DEFAULT_PREFS: Prefs = { maxMinutes: 10, autoPause: true, idleSeconds: 60, instantReplay: false, replayExcluded: [] };

export type PauseReason = "manual" | "idle" | "hidden";

/** Recording state (chrome.storage.session — survives a service worker restart). */
export interface RecordingState {
  status: "idle" | "starting" | "recording" | "stopping";
  tabId: number | null;
  recordingId: string | null;
  startTs: number | null;
  /** Video time accumulated before runningSince. Current = elapsedMs + (now − runningSince). */
  elapsedMs: number;
  /** Since when recording runs without a pause; null — paused. */
  runningSince: number | null;
  pauseReason: PauseReason | null;
  maxMs: number;
}

export const IDLE_STATE: RecordingState = {
  status: "idle",
  tabId: null,
  recordingId: null,
  startTs: null,
  elapsedMs: 0,
  runningSince: null,
  pauseReason: null,
  maxMs: 0,
};

/** Timer for the bar and the popup. */
export const currentElapsed = (s: Pick<RecordingState, "elapsedMs" | "runningSince">, now = Date.now()) =>
  s.elapsedMs + (s.runningSince ? now - s.runningSince : 0);

export interface Clock {
  elapsedMs: number;
  runningSince: number | null;
  pauseReason: PauseReason | null;
  maxMs: number;
}

// ----------------------------- messages -----------------------------

export type Message =
  | { type: "bt:start-request"; tabId: number }
  | { type: "bt:stop-request"; cancel?: boolean }
  | { type: "bt:pause-request"; pause: boolean }
  | { type: "bt:screenshot-request"; tabId: number }
  | { type: "bt:replay-request"; tabId: number }
  | { type: "bt:replay-inject" }
  | { type: "bt:api-allowed?" }
  | { type: "bt:page-command"; cmd: "record" | "screenshot" | "replay" }
  | { type: "bt:state?" }
  | { type: "bt:event"; event: CapturedEvent }
  | { type: "bt:info"; info: PageInfo }
  | { type: "bt:activity" }
  | { type: "bt:visibility"; hidden: boolean }
  | {
      type: "bt:offscreen-start";
      target: "offscreen";
      streamId: string;
      recordingId: string;
      tabId: number;
      maxMs: number;
      idleMs: number | null;
      networkIgnore: string[];
      /** tab — chrome.tabCapture (extension button); desktop — Chrome's picker (a button on the site). */
      source: "tab" | "desktop";
    }
  | { type: "bt:offscreen-stop"; target: "offscreen"; cancel: boolean }
  | { type: "bt:offscreen-pause"; target: "offscreen"; pause: boolean; reason: PauseReason }
  | { type: "bt:offscreen-clock"; clock: Clock }
  | { type: "bt:offscreen-auto-stop" }
  | { type: "bt:start"; clock: Clock }
  | { type: "bt:clock"; clock: Clock }
  | { type: "bt:stop" }
  | { type: "bt:ping" };

/** Instant replay buffer length. */
export const REPLAY_WINDOW_MS = 2 * 60 * 1000;
