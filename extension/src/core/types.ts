// Shared Bug Stream types: recording events, page details, a recording (video / screenshot / replay).

/** A recording event — the format the backend accepts (POST /api/reports, the "events" part). */
export interface CapturedEvent {
  kind: "console" | "network" | "action" | "navigation" | "custom";
  /** Unix time in ms. t (from the video start, without pauses) is computed when saving. */
  ts: number;
  t?: number;
  level?: string;
  summary: string;
  method?: string;
  status?: number;
  duration?: number;
  payload?: Record<string, unknown>;
}

/** Page and environment details — the Info tab on the site. */
export interface PageInfo {
  pageUrl: string;
  pageTitle: string;
  timezone: string;
  locale: string;
  location: string | null;
  os: string;
  osVersion: string | null;
  browser: string;
  browserVersion: string | null;
  windowSize: string;
  screenSize: string;
  devicePixelRatio: number;
  networkType: string | null;
  networkDownlink: number | null;
  networkRtt: number | null;
}

/**
 * A recording waiting to be sent (IndexedDB). The video is stored separately — in pieces in the chunks store,
 * so even a 30-minute recording is never held in memory.
 */
export interface Recording {
  id: string;
  kind: "video" | "screenshot" | "replay";
  /** recording — in progress (or the browser crashed during it); done — ready to send. */
  status: "recording" | "done";
  createdAt: number;
  startTs: number;
  /** Video duration without pauses (for replay — length of the DOM recording). */
  durationMs: number;
  tabId: number | null;
  info: PageInfo | null;
  events: CapturedEvent[];
  /** Video MIME type; the data is in chunks. */
  mimeType: string | null;
  chunkCount: number;
  /** Video pauses: [start, end] in Unix ms. Needed to map events to video time. */
  pauses: [number, number][];
  screenshot: Blob | null;
  /** Instant replay: rrweb DOM recording, gzipped JSON. */
  replay: Blob | null;
}
