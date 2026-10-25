import { forwardRef, lazy, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ReportEvent } from "../../api/types";
import { cx } from "../../components/ui";
import { formatTimecode } from "../../lib/format";
import { EVENT_KIND_LABEL } from "../../lib/labels";
import { toneBg, toneOf, type Tone } from "./events";
import type { ReplayHandle } from "./ReplayStage";
import { t } from "../../i18n";

// rrweb (~300 KB) is loaded only for reports with instant replay
const ReplayStage = lazy(() => import("./ReplayStage"));

export interface PlayerHandle {
  seek: (ms: number, play?: boolean) => void;
}

interface Props {
  videoUrl: string | null;
  /** Instant replay (rrweb DOM recording) — plays when there is no video. */
  replayUrl?: string | null;
  posterUrl: string | null;
  durationMs: number;
  events: ReportEvent[];
  selectedId: string | null;
  onTime: (ms: number) => void;
  onSelect: (e: ReportEvent) => void;
}

const SPEEDS = [1, 1.5, 2, 0.5];

/**
 * Video (or instant replay) + event timeline. Without either (a screenshot report)
 * the timeline still works — time moves by clicking on it.
 */
export const Player = forwardRef<PlayerHandle, Props>(function Player(
  { videoUrl, replayUrl = null, posterUrl, durationMs, events, selectedId, onTime, onSelect },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null);
  const replay = useRef<ReplayHandle>(null);
  const [replayFailed, setReplayFailed] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationMs);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  const report = useCallback(
    (ms: number) => {
      setTime(ms);
      onTime(ms);
    },
    [onTime],
  );

  const hasVideo = !!videoUrl && !failed;
  const hasReplay = !hasVideo && !!replayUrl && !replayFailed;
  const hasMedia = hasVideo || hasReplay;

  const seek = useCallback(
    (ms: number, play = false) => {
      const v = video.current;
      const clamped = Math.max(0, Math.min(ms, duration || ms));
      if (v && hasVideo) {
        v.currentTime = clamped / 1000;
        if (play) void v.play();
      } else if (hasReplay) {
        replay.current?.seek(clamped, play || playing);
      }
      report(clamped);
    },
    [duration, hasVideo, hasReplay, playing, report],
  );

  const toggle = useCallback(() => {
    if (hasVideo) {
      const v = video.current;
      if (v?.paused) void v.play();
      else v?.pause();
    } else if (hasReplay) {
      if (playing) replay.current?.pause();
      else replay.current?.play();
    }
  }, [hasVideo, hasReplay, playing]);

  const currentMs = useCallback(
    () => (hasVideo ? (video.current?.currentTime ?? 0) * 1000 : (replay.current?.currentTime() ?? 0)),
    [hasVideo],
  );

  useImperativeHandle(ref, () => ({ seek }), [seek]);

  // Smooth time updates during playback (timeupdate fires only ~4 times a second)
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      report(currentMs());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, report, currentMs]);

  // Hotkeys: space — pause, arrows — ±5 seconds
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
      if (!hasMedia) return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.code === "ArrowLeft") seek(currentMs() - 5000);
      else if (e.code === "ArrowRight") seek(currentMs() + 5000);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seek, toggle, currentMs, hasMedia]);

  return (
    <div ref={wrap} className="overflow-hidden rounded-panel border border-line bg-[#141a23]">
      <div className="relative aspect-video">
        {hasVideo ? (
          <video
            ref={video}
            src={videoUrl}
            poster={posterUrl ?? undefined}
            className="size-full bg-black object-contain"
            preload="metadata"
            playsInline
            onClick={() => (video.current?.paused ? void video.current.play() : video.current?.pause())}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onSeeked={() => video.current && report(video.current.currentTime * 1000)}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              // webm from MediaRecorder often has Infinity duration — then trust durationMs from the report
              if (Number.isFinite(d) && d > 0) setDuration(d * 1000);
            }}
            onError={() => setFailed(true)}
          />
        ) : hasReplay ? (
          <Suspense fallback={<div className="grid size-full place-items-center bg-white text-[13px] text-faint">{t("Loading the page recording…")}</div>}>
            <ReplayStage
              ref={replay}
              url={replayUrl!}
              onReady={(ms) => ms > 0 && setDuration(ms)}
              onPlaying={setPlaying}
              onError={() => setReplayFailed(true)}
            />
          </Suspense>
        ) : posterUrl ? (
          <img src={posterUrl} alt={t("Screenshot")} className="size-full object-contain" />
        ) : (
          <div className="grid size-full place-items-center text-center text-[13px] text-white/50">
            {failed ? t("The video could not be loaded") : replayFailed ? t("The page recording could not be loaded") : t("This report has no video")}
          </div>
        )}
        {hasMedia && !playing && time === 0 && (
          <button
            onClick={toggle}
            className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-105"
            aria-label={t("Play")}
          >
            <span className="ml-1 size-0 border-y-[11px] border-l-[17px] border-y-transparent border-l-ink" />
          </button>
        )}
      </div>

      <div className="bg-surface px-3 pb-2 pt-3">
        <Timeline events={events} duration={duration} time={time} selectedId={selectedId} onSeek={(ms) => seek(ms)} onSelect={onSelect} />
        <div className="mt-2 flex items-center gap-3 text-[13px]">
          <button
            disabled={!hasMedia}
            onClick={toggle}
            className="grid size-8 place-items-center rounded-control text-ink hover:bg-line-soft disabled:text-faint"
            aria-label={playing ? t("Pause") : t("Play")}
          >
            {playing ? (
              <span className="flex gap-[3px]">
                <span className="h-3.5 w-[4px] rounded-sm bg-current" />
                <span className="h-3.5 w-[4px] rounded-sm bg-current" />
              </span>
            ) : (
              <span className="ml-0.5 size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
            )}
          </button>
          <span className="font-mono text-[12px] tabular-nums text-muted">
            {formatTimecode(time)} / {formatTimecode(duration)}
          </span>
          <Legend events={events} />
          <div className="ml-auto flex items-center gap-1">
            <button
              disabled={!hasMedia}
              onClick={() => {
                const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                setSpeed(next);
                if (video.current) video.current.playbackRate = next;
                replay.current?.setSpeed(next);
              }}
              className="h-7 min-w-11 rounded-control px-2 font-mono text-[12px] text-muted hover:bg-line-soft disabled:text-faint"
              title={t("Playback speed")}
            >
              {speed}×
            </button>
            <button
              disabled={!hasMedia}
              onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen())}
              className="grid size-7 place-items-center rounded-control text-muted hover:bg-line-soft disabled:text-faint"
              aria-label={t("Full screen")}
              title={t("Full screen")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Event timeline — the key element of the page: at every moment you see what happened.
 * Lanes: errors and warnings on top, network in the middle, actions and navigation at the bottom.
 */
function Timeline({
  events,
  duration,
  time,
  selectedId,
  onSeek,
  onSelect,
}: {
  events: ReportEvent[];
  duration: number;
  time: number;
  selectedId: string | null;
  onSeek: (ms: number) => void;
  onSelect: (e: ReportEvent) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number; event: ReportEvent | null } | null>(null);
  const total = Math.max(duration, events.at(-1)?.t ?? 0, 1);

  const rows = useMemo(() => {
    const lane = (tone: Tone) => (tone === "error" || tone === "warn" ? 0 : tone === "network" ? 1 : 2);
    return events.map((e) => ({ e, tone: toneOf(e), lane: lane(toneOf(e)) }));
  }, [events]);

  const msAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * total;
  };

  const nearest = (ms: number): ReportEvent | null => {
    const tolerance = total * 0.012;
    let best: ReportEvent | null = null;
    let bestD = Infinity;
    for (const e of events) {
      const d = Math.abs(e.t - ms);
      if (d < bestD && d <= tolerance) {
        best = e;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <div className="relative select-none">
      <div
        ref={track}
        className="relative h-[46px] cursor-pointer rounded-[6px] bg-fog"
        onMouseMove={(e) => {
          const ms = msAt(e.clientX);
          setHover({ x: e.clientX - track.current!.getBoundingClientRect().left, ms, event: nearest(ms) });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const ms = msAt(e.clientX);
          const ev = nearest(ms);
          if (ev) {
            onSelect(ev);
            onSeek(ev.t);
          } else onSeek(ms);
        }}
        role="slider"
        aria-label={t("Position in the recording")}
        aria-valuemin={0}
        aria-valuemax={Math.round(total / 1000)}
        aria-valuenow={Math.round(time / 1000)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onSeek(time - 1000);
          if (e.key === "ArrowRight") onSeek(time + 1000);
        }}
      >
        {/* played part */}
        <div className="absolute inset-y-0 left-0 rounded-l-[6px] bg-primary-soft" style={{ width: `${(time / total) * 100}%` }} />
        {/* lane separators */}
        <div className="absolute inset-x-0 top-[15px] h-px bg-line-soft" />
        <div className="absolute inset-x-0 top-[30px] h-px bg-line-soft" />
        {rows.map(({ e, tone, lane }) => (
          <span
            key={e.id}
            className={cx(
              "absolute w-[3px] -translate-x-1/2 rounded-full",
              toneBg[tone],
              e.id === selectedId && "w-[5px] ring-2 ring-white outline outline-1 outline-ink/40",
              e.t > time && e.id !== selectedId && "opacity-55",
            )}
            style={{ left: `${(e.t / total) * 100}%`, top: 3 + lane * 15, height: 10 }}
          />
        ))}
        {/* playhead */}
        <div className="pointer-events-none absolute inset-y-[-3px] w-[2px] -translate-x-1/2 rounded bg-ink" style={{ left: `${(time / total) * 100}%` }} />
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute bottom-full z-10 mb-2 max-w-[320px] -translate-x-1/2 rounded-control bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lg"
          style={{ left: Math.max(80, Math.min(hover.x, (track.current?.clientWidth ?? 0) - 80)) }}
        >
          <span className="font-mono text-white/60">{formatTimecode(hover.event?.t ?? hover.ms)}</span>
          {hover.event && (
            <>
              <span className="ml-2 text-white/60">{EVENT_KIND_LABEL[hover.event.kind]}</span>
              <span className="mt-0.5 block truncate">{hover.event.summary}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ events }: { events: ReportEvent[] }) {
  const counts = useMemo(() => {
    const c: Partial<Record<Tone, number>> = {};
    for (const e of events) c[toneOf(e)] = (c[toneOf(e)] ?? 0) + 1;
    return c;
  }, [events]);
  const items: [Tone, (n: number) => string][] = [
    ["error", (n) => t("{n} errors", { n })],
    ["warn", (n) => t("{n} warnings", { n })],
    ["network", (n) => t("{n} requests", { n })],
    ["action", (n) => t("{n} actions", { n })],
  ];
  return (
    <span className="hidden items-center gap-3 text-[12px] text-faint md:flex">
      {items
        .filter(([tone]) => counts[tone])
        .map(([tone, label]) => (
          <span key={tone} className="inline-flex items-center gap-1">
            <span className={cx("h-2.5 w-[3px] rounded-full", toneBg[tone])} />
            {label(counts[tone] ?? 0)}
          </span>
        ))}
    </span>
  );
}
