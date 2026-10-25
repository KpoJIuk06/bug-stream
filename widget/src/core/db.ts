import type { CapturedEvent, Recording } from "./types";

/**
 * IndexedDB of recordings: shared by offscreen, preview, popup and the service worker in the extension; the site's database for the widget.
 *   recordings — recordings before sending: details, events, screenshot, replay
 *   chunks     — 2-second video pieces written to disk while recording
 *   events     — events during recording (in batches) to survive a browser crash
 */

let DB = "bugstream";
let dbPromise: Promise<IDBDatabase> | null = null;

/** IndexedDB name. The extension keeps its old name "adtask" so unsaved recordings are not lost. */
export function setDatabaseName(name: string) {
  DB = name;
  dbPromise = null;
}
const RECORDINGS = "recordings";
const CHUNKS = "chunks";
const EVENTS = "events";


function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore(RECORDINGS, { keyPath: "id" });
      db.createObjectStore(CHUNKS, { keyPath: ["rid", "seq"] });
      db.createObjectStore(EVENTS, { keyPath: ["rid", "seq"] });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => (dbPromise = null);
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run<T>(stores: string | string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const req = fn(t);
    t.oncomplete = () => resolve(req ? req.result : (undefined as T));
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error("IndexedDB: transaction aborted"));
  });
}

const range = (rid: string) => IDBKeyRange.bound([rid, 0], [rid, Number.MAX_SAFE_INTEGER]);

// ----------------------------- recordings -----------------------------

export const putRecording = (r: Recording) => run<void>(RECORDINGS, "readwrite", (t) => void t.objectStore(RECORDINGS).put(r));
export const getRecording = (id: string) => run<Recording | undefined>(RECORDINGS, "readonly", (t) => t.objectStore(RECORDINGS).get(id));
export const listRecordings = () => run<Recording[]>(RECORDINGS, "readonly", (t) => t.objectStore(RECORDINGS).getAll());

export const deleteRecording = (id: string) =>
  run<void>([RECORDINGS, CHUNKS, EVENTS], "readwrite", (t) => {
    t.objectStore(RECORDINGS).delete(id);
    t.objectStore(CHUNKS).delete(range(id));
    t.objectStore(EVENTS).delete(range(id));
  });

// ----------------------------- video -----------------------------

export const putChunk = (rid: string, seq: number, data: Blob, ts: number) =>
  run<void>(CHUNKS, "readwrite", (t) => void t.objectStore(CHUNKS).put({ rid, seq, data, ts }));

/**
 * The whole video. A Blob from IndexedDB points to files on disk — joining does not read the video into memory.
 */
export async function getVideo(r: Recording): Promise<Blob | null> {
  if (!r.chunkCount && r.kind !== "video") return null;
  const rows = await run<{ seq: number; data: Blob }[]>(CHUNKS, "readonly", (t) => t.objectStore(CHUNKS).getAll(range(r.id)));
  if (!rows.length) return null;
  rows.sort((a, b) => a.seq - b.seq);
  return new Blob(
    rows.map((x) => x.data),
    { type: (r.mimeType ?? "video/webm").split(";")[0] },
  );
}

/** Time of the last video piece — for recovery after a crash. */
export async function lastChunk(rid: string): Promise<{ seq: number; ts: number } | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(CHUNKS).objectStore(CHUNKS).openCursor(range(rid), "prev");
    req.onsuccess = () => resolve(req.result ? { seq: req.result.value.seq, ts: req.result.value.ts } : null);
    req.onerror = () => reject(req.error);
  });
}

// ----------------------------- events during recording -----------------------------

export const putEventBatch = (rid: string, seq: number, events: CapturedEvent[]) =>
  run<void>(EVENTS, "readwrite", (t) => void t.objectStore(EVENTS).put({ rid, seq, events }));

export async function getEventBatches(rid: string): Promise<CapturedEvent[]> {
  const rows = await run<{ seq: number; events: CapturedEvent[] }[]>(EVENTS, "readonly", (t) => t.objectStore(EVENTS).getAll(range(rid)));
  return rows.sort((a, b) => a.seq - b.seq).flatMap((r) => r.events);
}

export const clearEventBatches = (rid: string) => run<void>(EVENTS, "readwrite", (t) => void t.objectStore(EVENTS).delete(range(rid)));

// ----------------------------- maintenance -----------------------------

/** Deletes abandoned recordings older than 3 days (e.g. a preview closed without saving). */
export async function cleanupOldRecordings(): Promise<void> {
  const limit = Date.now() - 3 * 24 * 3600 * 1000;
  for (const r of await listRecordings()) {
    if (r.createdAt < limit) await deleteRecording(r.id);
  }
}

/**
 * Recovery after a browser or extension crash during recording: everything already
 * written to disk becomes a normal recording that can be opened and sent.
 */
export async function recoverInterrupted(isActive: (id: string) => boolean): Promise<string[]> {
  const recovered: string[] = [];
  for (const r of await listRecordings()) {
    if (r.status !== "recording" || isActive(r.id)) continue;
    const last = await lastChunk(r.id);
    if (!last) {
      await deleteRecording(r.id);
      continue;
    }
    const events = await getEventBatches(r.id);
    const finished = finishRecording({ ...r, chunkCount: last.seq + 1 }, events, last.ts);
    await putRecording(finished);
    await clearEventBatches(r.id);
    recovered.push(r.id);
  }
  return recovered;
}

/** Video time for the moment ts: time since start minus the pauses before it. Inside a pause — its start. */
export function videoTime(ts: number, startTs: number, pauses: [number, number][]): number {
  let paused = 0;
  for (const [a, b] of pauses) {
    if (ts <= a) break;
    paused += Math.min(ts, b) - a;
  }
  return Math.max(0, ts - startTs - paused);
}

/** Finishes a recording: duration without pauses, events with video time. */
export function finishRecording(r: Recording, events: CapturedEvent[], stopTs: number): Recording {
  const pauses = r.pauses.map(([a, b]) => [a, Math.min(b, stopTs)] as [number, number]);
  const durationMs = videoTime(stopTs, r.startTs, pauses);
  return {
    ...r,
    status: "done",
    pauses,
    durationMs,
    events: events
      .filter((e) => e.ts <= stopTs)
      .map((e) => ({ ...e, t: Math.min(durationMs, videoTime(e.ts, r.startTs, pauses)) }))
      .sort((a, b) => a.t! - b.t! || a.ts - b.ts),
  };
}
