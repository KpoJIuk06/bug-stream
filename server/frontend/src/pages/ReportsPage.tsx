import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorText } from "../api/client";
import { useEnvironments, useMyJira, useProject, useReportGroups, useReports, type ReportFilters } from "../api/hooks";
import type { ProjectGroup, ReportListItem } from "../api/types";
import { JiraStatusBadge } from "../components/JiraStatus";
import { useAuth } from "../auth/AuthContext";
import { ProjectPicker, UserPicker } from "../components/Combobox";
import { EnvBadge } from "../components/EnvBadge";
import { Pagination, PAGE_SIZES } from "../components/Pagination";
import { Avatar, Button, cx, Empty, ErrorBox, Input, Loading, Select, SeverityMark, StatusBadge, Tag } from "../components/ui";
import { t } from "../i18n";
import { formatTimecode, shortUrl, timeAgo } from "../lib/format";
import { SEVERITY_LABEL, STATUS_LABEL } from "../lib/labels";

const PERIODS: Record<string, { label: string; days: number | null }> = {
  all: { label: "All time", days: null },
  "1": { label: "Last 24 hours", days: 1 },
  "7": { label: "Last 7 days", days: 7 },
  "30": { label: "Last 30 days", days: 30 },
};

export type ReportsView = "all" | "mine" | "assigned";

/** Filters live in the address bar — a link to a filtered list can be shared. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const size = Number(params.get("size") ?? 25);
  const filters: ReportFilters & { period: string } = {
    q: params.get("q") ?? undefined,
    projectId: params.get("project") ?? undefined,
    serviceId: params.get("service") ?? undefined,
    status: params.getAll("status"),
    severity: params.getAll("severity"),
    environment: params.getAll("environment"),
    assigneeId: params.get("assignee") ?? undefined,
    authorId: params.get("author") ?? undefined,
    hasErrors: params.get("errors") === "1" ? true : undefined,
    jira: params.getAll("jira"),
    includeDeleted: params.get("deleted") === "1" || undefined,
    sort: params.get("sort") ?? "newest",
    page: Math.max(0, Number(params.get("page") ?? 1) - 1),
    size: PAGE_SIZES.includes(size) ? size : 25,
    period: params.get("period") ?? "all",
  };
  const group = params.get("group") === "list" ? "list" : "project";
  const set = (patch: Record<string, string | string[] | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  const keys = [...params.keys()].filter((k) => k !== "page" && k !== "size" && k !== "sort" && k !== "group");
  const clear = () => setParams(params.get("group") ? new URLSearchParams({ group: params.get("group")! }) : new URLSearchParams(), { replace: true });
  return { filters, group, set, clear, hasAny: keys.length > 0 };
}

const TITLES: Record<ReportsView, string> = {
  all: "All reports",
  mine: "My reports",
  assigned: "Assigned to me",
};

export function ReportsPage({ view = "all" }: { view?: ReportsView }) {
  const { user } = useAuth();
  const { filters, group, set, clear, hasAny } = useFilters();
  const myJira = useMyJira();
  const jiraOn = !!myJira.data?.configured;
  const [search, setSearch] = useState(filters.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const environments = useEnvironments(true);

  const days = PERIODS[filters.period]?.days;
  const from = useMemo(() => (days ? new Date(Date.now() - days * 86400_000).toISOString() : undefined), [days]);
  const { period: _period, ...apiFilters } = filters;
  if (view === "mine" && user) apiFilters.authorId = user.id;
  if (view === "assigned" && user) apiFilters.assigneeId = user.id;
  // "By project" on All reports unless a project is already chosen
  const grouped = view === "all" && group === "project" && !filters.projectId;
  const reports = useReports({ ...apiFilters, from }, !grouped);
  const groups = useReportGroups({ ...apiFilters, from }, grouped);

  const project = useProject(filters.projectId);

  const toggle = (key: "status" | "severity" | "environment" | "jira", value: string) => {
    const cur = filters[key] ?? [];
    set({ [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
  };

  const data = reports.data;
  const me = user ? [{ value: user.id, label: t("Me") }] : [];

  return (
    <div className="mx-auto grid max-w-[1680px] gap-6 px-4 py-6 md:px-6 xl:grid-cols-[248px_minmax(0,1fr)]">
      {/* ------------------------- filters ------------------------- */}
      <button
        className="flex h-9 items-center justify-between rounded-control border border-line bg-surface px-3 text-left xl:hidden"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
      >
        <span>{hasAny ? t("Filters (on)") : t("Filters")}</span>
        <span className="text-faint">{showFilters ? t("Hide") : t("Show")}</span>
      </button>
      <aside className={cx("space-y-5 xl:sticky xl:top-20 xl:block xl:self-start", !showFilters && "hidden")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: search.trim() || undefined });
          }}
        >
          <Input
            type="search"
            placeholder={t("Search title, description, URL")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => search !== (filters.q ?? "") && set({ q: search.trim() || undefined })}
          />
        </form>

        <FilterGroup title={t("Project")}>
          <ProjectPicker value={filters.projectId} onChange={(id) => set({ project: id, service: undefined })} />
          {filters.projectId && (project.data?.services.length ?? 0) > 0 && (
            <Select className="mt-2" value={filters.serviceId ?? ""} onChange={(e) => set({ service: e.target.value || undefined })}>
              <option value="">{t("All services")}</option>
              {project.data?.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </FilterGroup>

        <FilterGroup title={t("Status")}>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(STATUS_LABEL).map((v) => (
              <Chip key={v} active={filters.status?.includes(v)} onClick={() => toggle("status", v)}>
                {STATUS_LABEL[v]}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title={t("Severity")}>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(SEVERITY_LABEL).map((v) => (
              <Chip key={v} active={filters.severity?.includes(v)} onClick={() => toggle("severity", v)}>
                <SeverityMark severity={v} /> {SEVERITY_LABEL[v]}
              </Chip>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title={t("Environment")}>
          <div className="flex flex-wrap gap-1.5">
            {environments.data?.map((e) => (
              <Chip key={e.code} active={filters.environment?.includes(e.code)} onClick={() => toggle("environment", e.code)}>
                <span className="size-2 rounded-full" style={{ background: e.color }} />
                <span className={cx(!e.active && "line-through")}>{e.name}</span>
              </Chip>
            ))}
          </div>
        </FilterGroup>

        {jiraOn && (
          <FilterGroup title={t("Jira")}>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["NONE", t("Not in Jira")],
                  ["TODO", t("To Do")],
                  ["IN_PROGRESS", t("In Progress")],
                  ["DONE", t("Done")],
                ] as const
              ).map(([v, label]) => (
                <Chip key={v} active={filters.jira?.includes(v)} onClick={() => toggle("jira", v)}>
                  {label}
                </Chip>
              ))}
            </div>
          </FilterGroup>
        )}

        <FilterGroup title={t("People")}>
          {view !== "assigned" && (
            <UserPicker value={filters.assigneeId} onChange={(id) => set({ assignee: id })} emptyLabel={t("Any assignee")} extra={me} />
          )}
          {view !== "mine" && (
            <UserPicker
              className="mt-2 w-full"
              value={filters.authorId}
              onChange={(id) => set({ author: id })}
              emptyLabel={t("Any author")}
              extra={me}
            />
          )}
        </FilterGroup>

        <FilterGroup title={t("Period")}>
          <Select value={filters.period} onChange={(e) => set({ period: e.target.value === "all" ? undefined : e.target.value })}>
            {Object.entries(PERIODS).map(([k, p]) => (
              <option key={k} value={k}>
                {t(p.label)}
              </option>
            ))}
          </Select>
        </FilterGroup>

        <div className="space-y-2">
          <Check checked={!!filters.hasErrors} onChange={(v) => set({ errors: v ? "1" : undefined })}>
            {t("Only with errors")}
          </Check>
          <Check checked={!!filters.includeDeleted} onChange={(v) => set({ deleted: v ? "1" : undefined })}>
            {t("Show deleted")}
          </Check>
        </div>

        {hasAny && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              clear();
            }}
          >
            {t("Reset filters")}
          </Button>
        )}
      </aside>

      {/* ------------------------- list ------------------------- */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{t(TITLES[view])}</h1>
            <p className="text-muted">
              {grouped
                ? groups.data
                  ? t("{n} reports in {p} projects", { n: groups.data.reduce((a, g) => a + g.total, 0), p: groups.data.filter((g) => g.project).length })
                  : " "
                : data
                  ? t("{n} reports", { n: data.total })
                  : " "}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === "all" && !filters.projectId && (
              <div className="flex rounded-control border border-line bg-surface p-0.5 text-[13px]" role="group" aria-label={t("View")}>
                {(["project", "list"] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={group === g}
                    onClick={() => set({ group: g === "list" ? "list" : undefined })}
                    className={cx("h-7 rounded-[5px] px-3 font-medium", group === g ? "bg-ink text-white" : "text-muted hover:text-ink")}
                  >
                    {g === "project" ? t("By project") : t("List")}
                  </button>
                ))}
              </div>
            )}
            {!grouped && (
              <Select className="w-auto" value={filters.sort} onChange={(e) => set({ sort: e.target.value === "newest" ? undefined : e.target.value })}>
                <option value="newest">{t("Newest first")}</option>
                <option value="updated">{t("Recently updated")}</option>
                <option value="oldest">{t("Oldest first")}</option>
              </Select>
            )}
          </div>
        </div>

        {grouped ? (
          <GroupList
            groups={groups.data}
            loading={groups.isLoading}
            fetching={groups.isFetching}
            error={groups.error}
            hasAny={hasAny}
            filters={{ ...apiFilters, from }}
            jiraOn={jiraOn}
            onOpenProject={(id) => set({ project: id ?? undefined, group: "list" })}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-panel border border-line bg-surface">
              {reports.isLoading ? (
                <Loading />
              ) : reports.error ? (
                <div className="p-4">
                  <ErrorBox>{errorText(reports.error)}</ErrorBox>
                </div>
              ) : data && data.items.length === 0 ? (
                hasAny ? (
                  <Empty title={t("Nothing found")}>{t("Try removing some filters.")}</Empty>
                ) : (
                  <Empty title={t("No reports yet")}>
                    {t("Record a bug with the Bug Stream extension in Chrome — the report appears here with video, console and network requests.")}
                  </Empty>
                )
              ) : (
                <ReportTable items={data?.items ?? []} fetching={reports.isFetching} jiraOn={jiraOn} showProject={!filters.projectId} />
              )}
            </div>

            {data && (
              <Pagination
                page={filters.page ?? 0}
                size={filters.size ?? 25}
                total={data.total}
                onPage={(p) => {
                  set({ page: p > 0 ? String(p + 1) : undefined });
                  window.scrollTo({ top: 0 });
                }}
                onSize={(n) => set({ size: n === 25 ? undefined : String(n) })}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ----------------------------- by project -----------------------------

function GroupList({
  groups,
  loading,
  fetching,
  error,
  hasAny,
  filters,
  jiraOn,
  onOpenProject,
}: {
  groups: ProjectGroup[] | undefined;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  hasAny: boolean;
  filters: ReportFilters;
  jiraOn: boolean;
  onOpenProject: (projectId: string | null) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  if (loading) return <Loading />;
  if (error) return <ErrorBox>{errorText(error)}</ErrorBox>;
  if (!groups || groups.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        {hasAny ? (
          <Empty title={t("Nothing found")}>{t("Try removing some filters.")}</Empty>
        ) : (
          <Empty title={t("No reports yet")}>
            {t("Record a bug with the Bug Stream extension in Chrome — the report appears here with video, console and network requests.")}
          </Empty>
        )}
      </div>
    );
  }
  const toggle = (k: string) => {
    const next = new Set(open);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOpen(next);
  };
  return (
    <div className={cx("space-y-2", fetching && "opacity-70")}>
      {groups.map((g) => {
        const k = g.project?.id ?? "none";
        const isOpen = open.has(k);
        return (
          <section key={k} className="overflow-hidden rounded-panel border border-line bg-surface">
            <button
              type="button"
              onClick={() => toggle(k)}
              aria-expanded={isOpen}
              className="grid w-full grid-cols-[20px_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left hover:bg-fog/60 lg:grid-cols-[20px_minmax(0,1fr)_auto_auto]"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" className={cx("text-faint transition-transform", isOpen && "rotate-90")} aria-hidden>
                <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  {g.project ? (
                    <>
                      <span className="rounded bg-fog px-1.5 py-0.5 font-mono text-[12px] font-semibold">{g.project.key}</span>
                      <span className="truncate text-[15px] font-medium">{g.project.name}</span>
                    </>
                  ) : (
                    <span className="text-[15px] font-medium text-muted">{t("No project")}</span>
                  )}
                  {jiraOn && g.jiraProjectKey && <span className="hidden text-[12px] text-faint sm:inline">Jira {g.jiraProjectKey}</span>}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span>
                    <b className="text-ink">{g.total}</b> {t("reports")}
                  </span>
                  {g.newCount > 0 && <Dot color="bg-primary">{t("{n} new", { n: g.newCount })}</Dot>}
                  {g.inProgress > 0 && <Dot color="bg-ev-network">{t("{n} in progress", { n: g.inProgress })}</Dot>}
                  {g.done > 0 && <Dot color="bg-ev-nav">{t("{n} done", { n: g.done })}</Dot>}
                  {g.critical > 0 && <Dot color="bg-ev-error">{t("{n} high / critical open", { n: g.critical })}</Dot>}
                  {g.withErrors > 0 && <span className="text-faint">{t("{n} with errors", { n: g.withErrors })}</span>}
                  {jiraOn && g.inJira > 0 && <span className="text-faint">{t("Jira: {n} sent, {d} done", { n: g.inJira, d: g.jiraDone })}</span>}
                  <span className="text-faint">· {t("last {when}", { when: timeAgo(g.lastAt) })}</span>
                </div>
                <StatusBar g={g} />
              </div>
              <div className="col-span-2 hidden gap-1.5 lg:col-span-1 lg:flex">
                {g.thumbnails.map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" className="h-12 w-[86px] rounded-[5px] border border-line-soft bg-[#1e2633] object-cover" />
                ))}
              </div>
              <span className="hidden text-[13px] text-primary lg:inline">{isOpen ? t("Hide") : t("Show")}</span>
            </button>
            {isOpen && <GroupReports g={g} filters={filters} jiraOn={jiraOn} onOpenProject={onOpenProject} />}
          </section>
        );
      })}
    </div>
  );
}

const GROUP_PAGE = 10;

function GroupReports({
  g,
  filters,
  jiraOn,
  onOpenProject,
}: {
  g: ProjectGroup;
  filters: ReportFilters;
  jiraOn: boolean;
  onOpenProject: (projectId: string | null) => void;
}) {
  const reports = useReports({ ...filters, projectId: g.project?.id, noProject: g.project ? undefined : true, page: 0, size: GROUP_PAGE });
  return (
    <div className="border-t border-line-soft">
      {reports.isLoading ? (
        <Loading />
      ) : reports.error ? (
        <div className="p-4">
          <ErrorBox>{errorText(reports.error)}</ErrorBox>
        </div>
      ) : (
        <ReportTable items={reports.data?.items ?? []} fetching={reports.isFetching} jiraOn={jiraOn} showProject={false} />
      )}
      {reports.data && reports.data.total > GROUP_PAGE && g.project && (
        <div className="border-t border-line-soft px-4 py-2.5 text-right">
          <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => onOpenProject(g.project!.id)}>
            {t("All {n} reports of {key} →", { n: reports.data.total, key: g.project.key })}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBar({ g }: { g: ProjectGroup }) {
  const rest = Math.max(0, g.total - g.newCount - g.inProgress - g.done);
  const parts: [number, string][] = [
    [g.newCount, "bg-primary"],
    [g.inProgress, "bg-ev-network"],
    [g.done, "bg-ev-nav"],
    [rest, "bg-line"],
  ];
  return (
    <div className="mt-2 flex h-1.5 max-w-[420px] gap-[2px] overflow-hidden rounded-full" aria-hidden>
      {parts
        .filter(([n]) => n > 0)
        .map(([n, c], i) => (
          <span key={i} className={cx("h-full rounded-full", c)} style={{ flexGrow: n }} />
        ))}
    </div>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("size-2 rounded-full", color)} />
      {children}
    </span>
  );
}

// ----------------------------- table -----------------------------

const COLS = "lg:grid-cols-[112px_minmax(0,1fr)_104px_126px_minmax(0,150px)_118px]";

function ReportTable({ items, fetching, jiraOn, showProject }: { items: ReportListItem[]; fetching: boolean; jiraOn: boolean; showProject: boolean }) {
  return (
    <div className={cx(fetching && "opacity-70")}>
      <div className={cx("hidden gap-4 border-b border-line bg-fog/60 px-4 py-2 text-[12px] font-medium text-muted lg:grid", COLS)}>
        <span>{t("Recording")}</span>
        <span>{t("Report")}</span>
        <span>{t("Status")}</span>
        <span>{t("Severity · environment")}</span>
        <span>{jiraOn ? t("Jira · errors") : t("Errors")}</span>
        <span className="text-right">{t("Author · created")}</span>
      </div>
      <ul className="divide-y divide-line-soft">
        {items.map((r) => (
          <ReportRow key={r.id} r={r} jiraOn={jiraOn} showProject={showProject} />
        ))}
      </ul>
    </div>
  );
}

function ReportRow({ r, jiraOn, showProject }: { r: ReportListItem; jiraOn: boolean; showProject: boolean }) {
  const navigate = useNavigate();
  const open = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    if (e.metaKey || e.ctrlKey) window.open(`/reports/${r.id}`, "_blank");
    else navigate(`/reports/${r.id}`);
  };
  return (
    <li
      onClick={open}
      className={cx("grid cursor-pointer grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-3 hover:bg-fog/70 lg:items-center", COLS)}
    >
      <Thumb r={r} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12px] text-faint">
          {showProject &&
            (r.project ? (
              <span className="font-medium text-muted">{r.project.key}</span>
            ) : (
              <span>{t("No project")}</span>
            ))}
          {r.service && (
            <span className="truncate">
              {showProject && "/ "}
              {r.service.name}
            </span>
          )}
        </div>
        <Link to={`/reports/${r.id}`} className="mt-0.5 line-clamp-2 text-[15px] font-medium leading-snug hover:text-primary" title={r.title}>
          {r.title}
        </Link>
        <p className="truncate font-mono text-[12px] text-faint" title={r.pageUrl}>
          {shortUrl(r.pageUrl)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-faint">
          {r.browser && <span>{[r.browser, r.os].filter(Boolean).join(" · ")}</span>}
          {r.commentsCount > 0 && <span>· {t("{n} comments", { n: r.commentsCount })}</span>}
          {r.tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </div>
        {/* compact line for narrow screens */}
        <div className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
          <StatusBadge status={r.status} />
          <SeverityMark severity={r.severity} />
          <EnvBadge env={r.environment} size="sm" />
          {jiraOn && r.jira && <JiraStatusBadge jira={r.jira} />}
          {r.consoleErrors > 0 && <ErrorCount kind="console" n={r.consoleErrors} />}
          {r.networkErrors > 0 && <ErrorCount kind="network" n={r.networkErrors} />}
        </div>
      </div>
      <div className="hidden lg:block">
        <StatusBadge status={r.status} />
        <p className="mt-1 truncate text-[12px] text-faint">
          {r.assignee ? (
            <span title={t("Assignee: {name}", { name: r.assignee.name })}>→ {r.assignee.name}</span>
          ) : (
            t("unassigned")
          )}
        </p>
      </div>
      <div className="hidden space-y-1.5 lg:block">
        <p className="flex items-center gap-1.5 text-[13px]">
          <SeverityMark severity={r.severity} withLabel />
        </p>
        <EnvBadge env={r.environment} size="sm" />
      </div>
      <div className="hidden min-w-0 space-y-1.5 lg:block">
        {jiraOn && (r.jira ? <JiraStatusBadge jira={r.jira} /> : <p className="text-[12px] text-faint">{t("not sent")}</p>)}
        <div className="flex flex-wrap gap-1">
          {r.consoleErrors > 0 && <ErrorCount kind="console" n={r.consoleErrors} />}
          {r.networkErrors > 0 && <ErrorCount kind="network" n={r.networkErrors} />}
          {!jiraOn && r.consoleErrors === 0 && r.networkErrors === 0 && <span className="text-[12px] text-faint">—</span>}
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 text-[13px] text-muted lg:col-span-1 lg:flex-col lg:items-end lg:justify-center lg:gap-1">
        <span className="flex items-center gap-1.5 truncate" title={t("Author: {name}", { name: r.author.name })}>
          <Avatar name={r.author.name} size={20} />
          <span className="truncate">{r.author.name}</span>
        </span>
        <span className="text-[12px] text-faint" title={new Date(r.createdAt).toLocaleString()}>
          {timeAgo(r.createdAt)}
        </span>
      </div>
    </li>
  );
}

function Thumb({ r }: { r: ReportListItem }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-[6px] border border-line-soft bg-[#1e2633]">
      {r.thumbnailUrl ? (
        <img src={r.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="grid size-full place-items-center">
          <span className="size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-white/60" />
        </div>
      )}
      {r.durationMs > 0 && (
        <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 font-mono text-[11px] text-white">{formatTimecode(r.durationMs)}</span>
      )}
    </div>
  );
}

function ErrorCount({ kind, n }: { kind: "console" | "network"; n: number }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[12px] font-medium",
        kind === "console" ? "bg-ev-error-soft text-ev-error" : "bg-ev-network-soft text-ev-network",
      )}
      title={kind === "console" ? t("Console errors") : t("Failed network requests")}
    >
      <span className={cx("size-1.5 rounded-full", kind === "console" ? "bg-ev-error" : "bg-ev-network")} />
      {kind === "console" ? t("{n} in console", { n }) : t("{n} in network", { n })}
    </span>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-muted">{title}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-muted hover:border-faint",
      )}
    >
      {children}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-primary" />
      {children}
    </label>
  );
}

