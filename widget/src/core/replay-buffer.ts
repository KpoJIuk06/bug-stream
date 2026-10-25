/**
 * "Last 2 minutes": continuous page recording (rrweb) in a ring buffer.
 * A new full snapshot every minute; old segments are dropped, at most ~3 minutes stay in memory.
 * Sends nothing anywhere — only returns the events on request.
 */

import { record } from "@rrweb/record";

export type ReplayEvent = { timestamp: number; type: number };

export interface ReplayBufferOptions {
  /** How long to keep, ms (2 minutes by default). */
  windowMs?: number;
  /** Elements not to record (the widget's/extension's own interface). */
  blockSelector?: string;
}

export class ReplayBuffer {
  private segments: ReplayEvent[][] = [];
  private stopFn: (() => void) | undefined;
  private readonly windowMs: number;
  private readonly blockSelector: string | undefined;

  constructor(opts: ReplayBufferOptions = {}) {
    this.windowMs = opts.windowMs ?? 2 * 60_000;
    this.blockSelector = opts.blockSelector;
  }

  get running(): boolean {
    return !!this.stopFn;
  }

  start(): void {
    if (this.stopFn) return;
    this.segments = [];
    try {
      this.stopFn =
        record({
          emit: (event, isCheckout) => {
            const e = event as unknown as ReplayEvent;
            if (isCheckout || this.segments.length === 0) this.segments.push([]);
            this.segments[this.segments.length - 1].push(e);
            // a segment can be dropped if the next one started before the window start
            const cutoff = Date.now() - this.windowMs;
            while (this.segments.length > 2 && this.segments[1][0].timestamp <= cutoff) this.segments.shift();
          },
          checkoutEveryNms: 60_000,
          blockSelector: this.blockSelector,
          maskInputOptions: { password: true },
          sampling: { mousemove: 50, scroll: 150, input: "last" },
          recordCanvas: false,
          collectFonts: false,
        }) ?? undefined;
    } catch (e) {
      console.warn("bugstream: page recording did not start", e);
    }
  }

  stop(): void {
    this.stopFn?.();
    this.stopFn = undefined;
    this.segments = [];
  }

  /** Events for the window: from the last full snapshot taken no later than the window start. null — nothing yet. */
  events(): ReplayEvent[] | null {
    if (!this.stopFn || !this.segments.length) return null;
    const cutoff = Date.now() - this.windowMs;
    let from = 0;
    for (let i = this.segments.length - 1; i >= 0; i--) {
      if (this.segments[i][0].timestamp <= cutoff) {
        from = i;
        break;
      }
    }
    const all = this.segments.slice(from).flat();
    return all.length > 1 ? all : null;
  }
}

/** Gzipped JSON of the events — how the replay goes to the server (the "replay" part). */
export async function gzipJson(value: unknown): Promise<Blob> {
  const json = new Blob([JSON.stringify(value)], { type: "application/json" });
  const gz = await new Response(json.stream().pipeThrough(new CompressionStream("gzip"))).blob();
  return new Blob([gz], { type: "application/gzip" });
}
