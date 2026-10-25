import { Replayer } from "@rrweb/replay";
import "@rrweb/replay/dist/style.css";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { t } from "../../i18n";

/**
 * Instant replay: a DOM recording of the page (rrweb) instead of a video. The file is gzipped JSON.
 * The page is replayed in a sandbox (an iframe without scripts) and scaled to the player size.
 */

export interface ReplayHandle {
  play: () => void;
  pause: () => void;
  seek: (ms: number, play?: boolean) => void;
  setSpeed: (speed: number) => void;
  currentTime: () => number;
}

interface Props {
  url: string;
  onReady: (durationMs: number) => void;
  onPlaying: (playing: boolean) => void;
  onError: () => void;
}

async function loadEvents(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  // detect gzip by the 1f 8b signature: a proxy may have unpacked the file already
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const text =
    head[0] === 0x1f && head[1] === 0x8b
      ? await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text()
      : await blob.text();
  return JSON.parse(text);
}

export const ReplayStage = forwardRef<ReplayHandle, Props>(function ReplayStage({ url, onReady, onPlaying, onError }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const replayer = useRef<Replayer | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadEvents(url)
      .then((events) => {
        if (cancelled || !stage.current) return;
        const r = new Replayer(events, { root: stage.current, skipInactive: false, showWarning: false, mouseTail: false, UNSAFE_replayCanvas: false });
        r.on("resize", (d) => {
          const { width, height } = d as { width: number; height: number };
          setSize({ w: width, h: height });
        });
        r.on("finish", () => onPlaying(false));
        replayer.current = r;
        r.pause(0);
        setLoading(false);
        onReady(r.getMetaData().totalTime);
      })
      .catch(() => !cancelled && onError());
    return () => {
      cancelled = true;
      replayer.current?.destroy();
      replayer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // The recording has its own window size — fit it into the player
  useEffect(() => {
    if (!size || !box.current) return;
    const fit = () => {
      const b = box.current!.getBoundingClientRect();
      setScale(Math.min(b.width / size.w, b.height / size.h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [size]);

  useImperativeHandle(ref, () => ({
    play: () => {
      const r = replayer.current;
      if (!r) return;
      const t = r.getCurrentTime();
      r.play(t >= r.getMetaData().totalTime ? 0 : t);
      onPlaying(true);
    },
    pause: () => {
      replayer.current?.pause();
      onPlaying(false);
    },
    seek: (ms, play = false) => {
      const r = replayer.current;
      if (!r) return;
      if (play) {
        r.play(ms);
        onPlaying(true);
      } else {
        r.pause(ms);
        onPlaying(false);
      }
    },
    setSpeed: (speed) => replayer.current?.setConfig({ speed }),
    currentTime: () => replayer.current?.getCurrentTime() ?? 0,
  }));

  return (
    <div ref={box} className="relative size-full overflow-hidden bg-white">
      {loading && <div className="absolute inset-0 grid place-items-center text-[13px] text-faint">{t("Loading the page recording…")}</div>}
      <div
        ref={stage}
        className="absolute left-1/2 top-1/2 origin-center [&_iframe]:border-0 [&_.replayer-wrapper]:relative"
        style={{
          width: size?.w,
          height: size?.h,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      />
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-ink/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
        Instant replay · {t("page recording")}
      </span>
    </div>
  );
});

export default ReplayStage;
