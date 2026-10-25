import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ReportDetails, ReportEvent } from "../../api/types";
import { cx } from "../../components/ui";
import { formatBytes, formatDateTime, formatMs, formatTimecode, shortUrl } from "../../lib/format";
import { asString, currentIndex, isNetworkError, prettyBody, toneOf, toneSoft, toneText } from "./events";
import { t } from "../../i18n";

type Tab = "info" | "console" | "network" | "actions";

interface Props {
  report: ReportDetails;
  events: ReportEvent[];
  time: number;
  selectedId: string | null;
  onPick: (e: ReportEvent) => void;
}

/** Right panel like DevTools: Info / Console / Network / Actions, synced with the video. */
export function DevTools({ report, events, time, selectedId, onPick }: Props) {
  const [tab, setTab] = useState<Tab>("info");
  const [follow, setFollow] = useState(true);

  const byKind = useMemo(
    () => ({
      console: events.filter((e) => e.kind === "CONSOLE"),
      network: events.filter((e) => e.kind === "NETWORK"),
      actions: events.filter((e) => e.kind === "ACTION" || e.kind === "NAVIGATION"),
      custom: events.filter((e) => e.kind === "CUSTOM"),
    }),
    [events],
  );

  // Picking an event on the timeline opens its tab
  useEffect(() => {
    const e = events.find((x) => x.id === selectedId);
    if (!e) return;
    setTab(e.kind === "CONSOLE" ? "console" : e.kind === "NETWORK" ? "network" : e.kind === "CUSTOM" ? "info" : "actions");
  }, [selectedId, events]);

  const tabs: { id: Tab; label: string; count?: number; alert?: boolean }[] = [
    { id: "info", label: "Info" },
    { id: "console", label: "Console", count: byKind.console.length, alert: byKind.console.some((e) => e.level === "error") },
    { id: "network", label: "Network", count: byKind.network.length, alert: byKind.network.some(isNetworkError) },
    { id: "actions", label: "Actions", count: byKind.actions.length },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col rounded-panel border border-line bg-surface">
      <div className="flex items-center gap-1 border-b border-line px-2" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={cx(
              "relative inline-flex h-11 items-center gap-1.5 px-2.5 text-[14px] transition-colors",
              tab === tb.id ? "font-medium text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-primary" : "text-muted hover:text-ink",
            )}
          >
            {tb.label}
            {tb.count != null && <span className="font-mono text-[11px] text-faint">{tb.count}</span>}
            {tb.alert && <span className="size-1.5 rounded-full bg-ev-error" aria-label={t("has errors")} />}
          </button>
        ))}
        {tab !== "info" && (
          <label className="ml-auto flex items-center gap-1.5 pr-2 text-[12px] text-muted" title={t("Scroll the list along with the video")}>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="accent-primary" />
            {t("Follow video")}
          </label>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "info" && <InfoTab report={report} custom={byKind.custom} onPick={onPick} />}
        {tab === "console" && <ConsoleTab events={byKind.console} time={time} selectedId={selectedId} follow={follow} onPick={onPick} />}
        {tab === "network" && <NetworkTab events={byKind.network} time={time} selectedId={selectedId} follow={follow} onPick={onPick} />}
        {tab === "actions" && <ActionsTab events={byKind.actions} time={time} selectedId={selectedId} follow={follow} onPick={onPick} />}
      </div>
    </section>
  );
}

// ============================== Info ==============================

function InfoTab({ report, custom, onPick }: { report: ReportDetails; custom: ReportEvent[]; onPick: (e: ReportEvent) => void }) {
  const f = report.fields as Record<string, unknown>;
  const s = (k: string) => (f[k] == null || f[k] === "" ? null : String(f[k]));

  const network = [
    s("network_type"),
    f.network_downlink != null ? t("{n} Mbps", { n: Number(f.network_downlink) }) : null,
    f.network_rtt != null ? t("latency {n} ms", { n: String(f.network_rtt) }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  const rows: [string, ReactNode][] = [
    [t("Recorded at"), s("recorded_at") ? formatDateTime(s("recorded_at")!) : null],
    [t("Location"), s("location")],
    [t("Time zone"), s("timezone")],
    [t("Language"), s("locale")],
    [t("OS"), [s("os"), s("os_version")].filter(Boolean).join(" ") || null],
    [t("Browser"), [s("browser"), s("browser_version")].filter(Boolean).join(" ") || null],
    [t("Window size"), s("window_size")],
    [t("Screen"), [s("screen_size"), f.device_pixel_ratio ? t("scale {n}", { n: Number(f.device_pixel_ratio) }) : null].filter(Boolean).join(", ") || null],
    [t("Network"), network || null],
    [t("Extension"), s("extension_version")],
  ];

  // App data (window.adtask.setContext / user in the widget) — the latest version
  const ctxEvent = [...custom].reverse().find((e) => (e.payload as { type?: string } | null)?.type === "app-context");
  const appContext = (ctxEvent?.payload as { context?: Record<string, unknown> } | undefined)?.context ?? null;
  const logs = custom.filter((e) => {
    const type = (e.payload as { type?: string } | null)?.type;
    return type !== "app-context" && type !== "pause" && type !== "resume";
  });

  return (
    <div className="p-3">
      <div className="rounded-control border border-line-soft bg-fog/60 p-3">
        <p className="text-[12px] text-faint">URL</p>
        <a href={s("page_url") ?? "#"} target="_blank" rel="noreferrer" className="mt-0.5 block break-all font-mono text-[12.5px] text-primary hover:underline">
          {s("page_url")}
        </a>
        {s("page_title") && <p className="mt-1 text-[13px] text-muted">{s("page_title")}</p>}
      </div>
      <dl className="mt-2 divide-y divide-line-soft">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-1 py-2">
              <dt className="text-muted">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
      </dl>
      {appContext && Object.keys(appContext).length > 0 && (
        <div className="mt-3">
          <p className="mb-1 px-1 text-[13px] font-medium text-muted">{t("App data")}</p>
          <dl className="divide-y divide-line-soft rounded-control border border-line-soft">
            {Object.entries(appContext).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[132px_minmax(0,1fr)] gap-3 px-2 py-1.5">
                <dt className="truncate font-mono text-[12.5px] text-muted">{k}</dt>
                <dd className="break-words font-mono text-[12.5px]">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {logs.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 px-1 text-[13px] font-medium text-muted">{t("Custom logs")}</p>
          {logs.map((e) => (
            <button key={e.id} onClick={() => onPick(e)} className="flex w-full gap-3 rounded px-1 py-1.5 text-left hover:bg-fog">
              <span className="font-mono text-[12px] text-faint">{formatTimecode(e.t)}</span>
              <span className="font-mono text-[12.5px]">{e.summary}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================== shared list ==============================

interface ListProps {
  events: ReportEvent[];
  time: number;
  selectedId: string | null;
  follow: boolean;
  onPick: (e: ReportEvent) => void;
}

/** Event rows: past ones normal, future ones dimmed, the current one highlighted; the list follows the video. */
function useFollow(events: ReportEvent[], time: number, follow: boolean) {
  const container = useRef<HTMLDivElement>(null);
  const idx = currentIndex(events, time);
  const currentId = idx >= 0 ? events[idx].id : null;
  useEffect(() => {
    if (!follow || !currentId) return;
    const el = container.current?.querySelector<HTMLElement>(`[data-id="${currentId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [currentId, follow]);
  return { container, currentId };
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface/95 px-3 py-2 backdrop-blur">{children}</div>;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-control border border-line p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cx("h-6 rounded-[5px] px-2 text-[12px]", value === v ? "bg-ink text-white" : "text-muted hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("Filter")}
      className="h-7 min-w-0 flex-1 rounded-control border border-line px-2 text-[12px] focus:border-primary focus:outline-none"
    />
  );
}

function Row({
  e,
  time,
  current,
  selected,
  onPick,
  children,
  details,
}: {
  e: ReportEvent;
  time: number;
  current: boolean;
  selected: boolean;
  onPick: (e: ReportEvent) => void;
  children: ReactNode;
  details?: ReactNode;
}) {
  const tone = toneOf(e);
  const future = e.t > time;
  return (
    <div data-id={e.id} className={cx("border-b border-line-soft", (tone === "error" || tone === "warn") && toneSoft[tone], selected && "outline outline-2 -outline-offset-2 outline-primary/50")}>
      <button
        onClick={() => onPick(e)}
        className={cx("grid w-full grid-cols-[42px_minmax(0,1fr)] items-start gap-2 px-3 py-1.5 text-left hover:bg-fog", future && "opacity-50")}
      >
        <span className={cx("pt-px font-mono text-[11.5px] tabular-nums", current ? "font-medium text-primary" : "text-faint")}>
          {current && <span className="mr-0.5">▸</span>}
          {formatTimecode(e.t)}
        </span>
        <span className="min-w-0">{children}</span>
      </button>
      {selected && details && <div className="border-t border-line-soft bg-surface px-3 py-2">{details}</div>}
    </div>
  );
}

function Pre({ children }: { children: ReactNode }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-[6px] bg-fog p-2 font-mono text-[11.5px] leading-relaxed">{children}</pre>;
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="mb-1 text-[12px] font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}

function Headers({ value }: { value: unknown }) {
  if (!value || typeof value !== "object") return <p className="text-[12px] text-faint">{t("no data")}</p>;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return <p className="text-[12px] text-faint">{t("empty")}</p>;
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-[11.5px]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="break-all">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

// ============================== Console ==============================

function ConsoleTab(p: ListProps) {
  const [level, setLevel] = useState<"all" | "error" | "warn" | "log">("all");
  const [q, setQ] = useState("");
  const list = p.events.filter((e) => {
    const lv = e.level ?? "log";
    if (level === "error" && lv !== "error") return false;
    if (level === "warn" && lv !== "warn" && lv !== "warning") return false;
    if (level === "log" && (lv === "error" || lv === "warn" || lv === "warning")) return false;
    return !q || e.summary.toLowerCase().includes(q.toLowerCase());
  });
  const { container, currentId } = useFollow(list, p.time, p.follow);
  return (
    <div ref={container}>
      <Toolbar>
        <Seg value={level} onChange={setLevel} options={[["all", t("All")], ["error", t("Errors")], ["warn", t("Warnings")], ["log", t("Logs")]]} />
        <SearchBox value={q} onChange={setQ} />
      </Toolbar>
      {list.length === 0 && <p className="p-6 text-center text-muted">{t("No messages")}</p>}
      {list.map((e) => {
        const tone = toneOf(e);
        const stack = asString(e.payload.stack);
        const args = e.payload.args;
        return (
          <Row
            key={e.id}
            e={e}
            time={p.time}
            current={e.id === currentId}
            selected={e.id === p.selectedId}
            onPick={p.onPick}
            details={
              stack || args ? (
                <>
                  {args != null && (
                    <DetailBlock title={t("Arguments")}>
                      <Pre>{prettyBody(args)}</Pre>
                    </DetailBlock>
                  )}
                  {stack && (
                    <DetailBlock title={t("Stack")}>
                      <Pre>{stack}</Pre>
                    </DetailBlock>
                  )}
                </>
              ) : undefined
            }
          >
            <span className={cx("block break-words font-mono text-[12px] leading-[1.55]", tone === "muted" ? "text-ink" : toneText[tone])}>{e.summary}</span>
            {typeof e.payload.source === "string" && <span className="block truncate font-mono text-[11px] text-faint">{e.payload.source}</span>}
          </Row>
        );
      })}
    </div>
  );
}

// ============================== Network ==============================

function statusTone(e: ReportEvent) {
  if (isNetworkError(e)) return "text-ev-error";
  if ((e.status ?? 0) >= 300) return "text-ev-warn";
  return "text-ev-nav";
}

function NetworkTab(p: ListProps) {
  const [mode, setMode] = useState<"all" | "errors">("all");
  const [q, setQ] = useState("");
  const list = p.events.filter((e) => (mode === "all" || isNetworkError(e)) && (!q || e.summary.toLowerCase().includes(q.toLowerCase())));
  const { container, currentId } = useFollow(list, p.time, p.follow);
  return (
    <div ref={container}>
      <Toolbar>
        <Seg value={mode} onChange={setMode} options={[["all", t("All")], ["errors", t("Failed")]]} />
        <SearchBox value={q} onChange={setQ} />
      </Toolbar>
      {list.length === 0 && <p className="p-6 text-center text-muted">{t("No requests")}</p>}
      {list.map((e) => {
        const url = asString(e.payload.url) ?? e.summary;
        return (
          <Row
            key={e.id}
            e={e}
            time={p.time}
            current={e.id === currentId}
            selected={e.id === p.selectedId}
            onPick={p.onPick}
            details={<NetworkDetails e={e} />}
          >
            <span className="grid grid-cols-[42px_36px_minmax(0,1fr)_auto] items-baseline gap-2 font-mono text-[12px]">
              <span className="font-medium text-muted">{e.method ?? "—"}</span>
              <span className={cx("font-medium", statusTone(e))}>{e.status || "ERR"}</span>
              <span className="truncate" title={url}>
                {shortUrl(url)}
              </span>
              <span className="text-[11px] text-faint">{formatMs(e.duration)}</span>
            </span>
          </Row>
        );
      })}
    </div>
  );
}

function NetworkDetails({ e }: { e: ReportEvent }) {
  const pl = e.payload;
  const req = prettyBody(pl.requestBody);
  const res = prettyBody(pl.responseBody);
  return (
    <div>
      <DetailBlock title={t("Request")}>
        <dl className="grid grid-cols-[80px_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[12px]">
          <dt className="text-muted">URL</dt>
          <dd className="break-all font-mono">{asString(pl.url) ?? e.summary}</dd>
          <dt className="text-muted">{t("Status")}</dt>
          <dd className={cx("font-mono", statusTone(e))}>
            {e.status || t("network error")} {asString(pl.statusText) ?? ""}
          </dd>
          <dt className="text-muted">{t("Time")}</dt>
          <dd>{formatMs(e.duration)}</dd>
          {typeof pl.size === "number" && (
            <>
              <dt className="text-muted">{t("Size")}</dt>
              <dd>{formatBytes(pl.size)}</dd>
            </>
          )}
          {typeof pl.error === "string" && (
            <>
              <dt className="text-muted">{t("Error")}</dt>
              <dd className="text-ev-error">{pl.error}</dd>
            </>
          )}
        </dl>
      </DetailBlock>
      <DetailBlock title={t("Request headers")}>
        <Headers value={pl.requestHeaders} />
      </DetailBlock>
      {req && (
        <DetailBlock title={t("Request body")}>
          <Pre>{req}</Pre>
        </DetailBlock>
      )}
      <DetailBlock title={t("Response headers")}>
        <Headers value={pl.responseHeaders} />
      </DetailBlock>
      {res && (
        <DetailBlock title={t("Response")}>
          <Pre>{res}</Pre>
        </DetailBlock>
      )}
      {pl.truncated === true && <p className="text-[12px] text-faint">{t("The body was cut — too large.")}</p>}
    </div>
  );
}

// ============================== Actions ==============================

const actionVerb: Record<string, string> = {
  click: "Click",
  dblclick: "Double click",
  input: "Input",
  change: "Change",
  submit: "Form submit",
  key: "Key",
  scroll: "Scroll",
};

function ActionsTab(p: ListProps) {
  const { container, currentId } = useFollow(p.events, p.time, p.follow);
  return (
    <div ref={container}>
      {p.events.length === 0 && <p className="p-6 text-center text-muted">{t("No actions")}</p>}
      {p.events.map((e) => {
        const selector = asString(e.payload.selector);
        const nav = e.kind === "NAVIGATION";
        return (
          <Row
            key={e.id}
            e={e}
            time={p.time}
            current={e.id === currentId}
            selected={e.id === p.selectedId}
            onPick={p.onPick}
            details={
              Object.keys(e.payload).length > 0 ? (
                <Pre>{JSON.stringify(e.payload, null, 2)}</Pre>
              ) : undefined
            }
          >
            <span className="flex items-baseline gap-2">
              <span className={cx("shrink-0 text-[12px] font-medium", nav ? "text-ev-nav" : "text-ev-action")}>
                {nav ? t("Navigation") : t(actionVerb[e.level ?? ""] ?? e.level ?? "Action")}
              </span>
              <span className="min-w-0 break-words">{e.summary}</span>
            </span>
            {selector && <span className="block truncate font-mono text-[11px] text-faint">{selector}</span>}
          </Row>
        );
      })}
    </div>
  );
}
