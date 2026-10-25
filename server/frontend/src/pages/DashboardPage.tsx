import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { errorText } from "../api/client";
import { useDashboard, useEnvironments } from "../api/hooks";
import type { Dashboard } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ProjectPicker } from "../components/Combobox";
import { Card, cx, ErrorBox, Loading, PageHeader, Select, SeverityMark, StatusBadge } from "../components/ui";
import { t } from "../i18n";
import { formatDay, formatNumber, timeAgo } from "../lib/format";
import { SEVERITY_LABEL, STATUS_LABEL } from "../lib/labels";

// categorical slots 1 and 2 of the validated reference palette (light surface)
const SERIES = { created: "#2a78d6", resolved: "#eb6834" };
const BAR = "#2a78d6";

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const days = Number(params.get("days") ?? 30);
  const dash = useDashboard(projectId, days);
  const set = (k: string, v: string | undefined) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Dashboard")}
        subtitle={t("What is happening with bugs right now.")}
        actions={
          <>
            <ProjectPicker className="w-64" value={projectId} onChange={(id) => set("project", id)} />
            <Select className="w-40" value={days} onChange={(e) => set("days", e.target.value === "30" ? undefined : e.target.value)}>
              <option value={7}>{t("Last 7 days")}</option>
              <option value={30}>{t("Last 30 days")}</option>
              <option value={90}>{t("Last 90 days")}</option>
            </Select>
          </>
        }
      />
      {dash.isLoading ? (
        <Loading />
      ) : dash.error ? (
        <ErrorBox>{errorText(dash.error)}</ErrorBox>
      ) : (
        <Body d={dash.data!} projectId={projectId} fetching={dash.isFetching} />
      )}
    </div>
  );
}

function Body({ d, projectId, fetching }: { d: Dashboard; projectId?: string; fetching: boolean }) {
  const { user } = useAuth();
  const c = d.counters;
  const q = (extra: string) => `/reports?${projectId ? `project=${projectId}&` : ""}${extra}`;
  const delta = c.createdInPeriod - c.createdPrevPeriod;
  return (
    <div className={cx("space-y-4", fetching && "opacity-80")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t("Open")} value={c.open} to={q("status=NEW&status=IN_PROGRESS")} />
        <Tile
          label={t("New in {n} days", { n: d.days })}
          value={c.createdInPeriod}
          note={delta === 0 ? t("same as before") : t("{sign}{n} vs previous period", { sign: delta > 0 ? "+" : "−", n: Math.abs(delta) })}
          to={q(`period=${d.days <= 30 ? d.days : "all"}`)}
        />
        <Tile label={t("Resolved in {n} days", { n: d.days })} value={c.resolvedInPeriod} to={q("status=RESOLVED&status=CLOSED")} />
        <Tile label={t("Unassigned")} value={c.unassignedOpen} to={q("status=NEW&status=IN_PROGRESS")} />
        <Tile label={t("Assigned to me")} value={c.assignedToMeOpen} to="/reports/assigned?status=NEW&status=IN_PROGRESS" />
        <Tile label={t("Critical open")} value={c.criticalOpen} to={q("severity=CRITICAL&status=NEW&status=IN_PROGRESS")} alert={c.criticalOpen > 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t("Reports per day")}>
          <TrendChart days={d.perDay} />
        </Card>
        <Card title={t("By status")}>
          <Bars
            items={d.byStatus.map((b) => ({ key: b.key, label: STATUS_LABEL[b.key] ?? b.key, count: b.count, to: q(`status=${b.key}`) }))}
          />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title={t("Open by severity")}>
          <Bars
            items={d.bySeverity.map((b) => ({
              key: b.key,
              label: b.key ? SEVERITY_LABEL[b.key] ?? b.key : t("Not set"),
              icon: b.key ? <SeverityMark severity={b.key} /> : undefined,
              count: b.count,
              to: b.key ? q(`severity=${b.key}&status=NEW&status=IN_PROGRESS`) : undefined,
            }))}
          />
        </Card>
        <Card title={t("By environment, {n} days", { n: d.days })}>
          <EnvBars d={d} link={(code) => q(`environment=${code}`)} />
        </Card>
        <Card title={t("By project, {n} days", { n: d.days })}>
          <Bars items={d.byProject.map((b) => ({ key: b.key, label: b.label || t("No project"), count: b.count, to: b.key ? `/reports?project=${b.key}` : undefined }))} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={t("Most frequent errors, {n} days", { n: d.days })}>
          {d.topErrors.length === 0 ? (
            <Empty>{t("No console or network errors in this period.")}</Empty>
          ) : (
            <ul className="divide-y divide-line-soft">
              {d.topErrors.map((e) => (
                <li key={e.kind + e.summary}>
                  <Link to={`/reports/${e.sampleReportId}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-fog">
                    <span
                      className={cx(
                        "mt-0.5 shrink-0 rounded px-1.5 py-px text-[11px] font-medium",
                        e.kind === "CONSOLE" ? "bg-ev-error-soft text-ev-error" : "bg-ev-network-soft text-ev-network",
                      )}
                    >
                      {e.kind === "CONSOLE" ? t("Console") : t("Network")}
                    </span>
                    <span className="min-w-0 flex-1 break-words font-mono text-[12.5px]">{e.summary}</span>
                    <span className="shrink-0 text-right text-[12px] text-muted">
                      <b className="font-semibold text-ink">{t("{n} reports", { n: e.reports })}</b>
                      <span className="block text-faint">{timeAgo(e.lastSeen)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title={t("My queue")} actions={<Link to="/reports/assigned" className="text-[12px] text-primary hover:underline">{t("All")}</Link>}>
            {d.myQueue.length === 0 ? (
              <Empty>{t("Nothing assigned to you.")}</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {d.myQueue.map((r) => (
                  <li key={r.id}>
                    <Link to={`/reports/${r.id}`} className="flex items-center gap-2.5 px-4 py-2 hover:bg-fog">
                      <SeverityMark severity={r.severity} />
                      <span className="min-w-0 flex-1 truncate text-[13px]">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("Recently sent to Jira")}>
            {d.recentJira.length === 0 ? (
              <Empty>{t("No Jira issues yet.")}</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {d.recentJira.map((j) => (
                  <li key={j.key + j.createdAt} className="flex items-center gap-2.5 px-4 py-2 text-[13px]">
                    <a href={j.url} target="_blank" rel="noreferrer" className="shrink-0 font-mono font-medium text-ev-network hover:underline">
                      {j.key}
                    </a>
                    <Link to={`/reports/${j.reportId}`} className="min-w-0 flex-1 truncate hover:underline">
                      {j.reportTitle}
                    </Link>
                    <span className="shrink-0 text-[12px] text-faint">{timeAgo(j.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("Top reporters, {n} days", { n: d.days })}>
            <Bars items={d.topReporters.map((b) => ({ key: b.key, label: b.key === user?.id ? `${b.label} (${t("Me")})` : b.label, count: b.count, to: `/reports?author=${b.key}` }))} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, note, to, alert }: { label: string; value: number; note?: string; to?: string; alert?: boolean }) {
  const body = (
    <>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cx("mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.02em]", alert && "text-ev-error")}>{formatNumber(value)}</p>
      {note && <p className="mt-1.5 text-[12px] text-faint">{note}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="block rounded-panel border border-line bg-surface px-4 py-3 transition-colors hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="rounded-panel border border-line bg-surface px-4 py-3">{body}</div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-faint">{children}</p>;
}

type BarItem = { key: string; label: string; count: number; to?: string; icon?: ReactNode; color?: string };

/** Horizontal bars of one measure: single hue, value labels in text color. */
function Bars({ items }: { items: BarItem[] }) {
  if (items.length === 0) return <Empty>{t("No data for this period.")}</Empty>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-1 p-3">
      {items.map((i) => {
        const row = (
          <>
            <span className="flex w-[38%] min-w-0 items-center gap-1.5 truncate text-[13px]">
              {i.icon}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="relative h-3 flex-1">
              <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${Math.max((i.count / max) * 100, 1.5)}%`, background: i.color ?? BAR }} />
            </span>
            <span className="w-10 text-right text-[13px] tabular-nums text-muted">{formatNumber(i.count)}</span>
          </>
        );
        return (
          <li key={i.key || "none"}>
            {i.to ? (
              <Link to={i.to} title={`${i.label}: ${i.count}`} className="flex items-center gap-3 rounded px-1 py-1 hover:bg-fog">
                {row}
              </Link>
            ) : (
              <div title={`${i.label}: ${i.count}`} className="flex items-center gap-3 px-1 py-1">
                {row}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EnvBars({ d, link }: { d: Dashboard; link: (code: string) => string }) {
  const envs = useEnvironments(true);
  return (
    <Bars
      items={d.byEnvironment.map((b) => {
        const e = envs.data?.find((x) => x.code === b.key);
        return {
          key: b.key,
          label: b.key ? e?.name ?? b.label : t("Not set"),
          count: b.count,
          to: b.key ? link(b.key) : undefined,
          icon: e ? <span className="size-2 shrink-0 rounded-full" style={{ background: e.color }} /> : undefined,
        };
      })}
    />
  );
}

/** Created vs resolved per day: two lines on one count axis, crosshair + tooltip on hover. */
function TrendChart({ days }: { days: Dashboard["perDay"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const max = Math.max(1, ...days.flatMap((d) => [d.created, d.resolved]));
  const niceMax = useMemo(() => {
    const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5 / 5) * 5;
    return Math.ceil(max / step) * step;
  }, [max]);
  const ticks = useMemo(() => {
    const n = Math.min(niceMax, 4);
    return Array.from({ length: n + 1 }, (_, i) => Math.round((niceMax / n) * i));
  }, [niceMax]);
  const x = (i: number) => pad.l + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const path = (k: "created" | "resolved") => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));
  const h = hover != null ? days[hover] : null;

  return (
    <div className="p-3">
      <div className="mb-2 flex gap-4 text-[12px] text-muted">
        <Legend color={SERIES.created} label={t("Created")} />
        <Legend color={SERIES.resolved} label={t("Resolved")} />
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label={t("Reports per day")}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (days.length - 1));
            setHover(Math.max(0, Math.min(days.length - 1, i)));
          }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line-soft)" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)">
                {v}
              </text>
            </g>
          ))}
          {days.map((d, i) =>
            (i % labelEvery === 0 && days.length - 1 - i >= labelEvery / 2) || i === days.length - 1 ? (
              <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--color-faint)">
                {formatDay(d.day)}
              </text>
            ) : null,
          )}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-faint)" strokeDasharray="3 3" />}
          <path d={path("resolved")} fill="none" stroke={SERIES.resolved} strokeWidth="2" strokeLinejoin="round" />
          <path d={path("created")} fill="none" stroke={SERIES.created} strokeWidth="2" strokeLinejoin="round" />
          {hover != null && h && (
            <>
              <circle cx={x(hover)} cy={y(h.resolved)} r="4" fill={SERIES.resolved} stroke="white" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(h.created)} r="4" fill={SERIES.created} stroke="white" strokeWidth="2" />
            </>
          )}
        </svg>
        {h && hover != null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-[0_8px_24px_-10px_rgba(24,32,44,0.35)]"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > days.length / 2 ? "-105%" : "5%"})` }}
          >
            <p className="font-medium">{formatDay(h.day)}</p>
            <p className="flex items-center gap-1.5 text-muted">
              <span className="h-0.5 w-3 rounded" style={{ background: SERIES.created }} /> {t("Created")}: <b className="text-ink">{h.created}</b>
            </p>
            <p className="flex items-center gap-1.5 text-muted">
              <span className="h-0.5 w-3 rounded" style={{ background: SERIES.resolved }} /> {t("Resolved")}: <b className="text-ink">{h.resolved}</b>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
