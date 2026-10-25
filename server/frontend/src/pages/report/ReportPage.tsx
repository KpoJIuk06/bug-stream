import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { ApiError, errorText } from "../../api/client";
import { useDeleteReport, useReport, useReportEvents, useUpdateReport } from "../../api/hooks";
import type { ReportDetails, ReportEvent } from "../../api/types";
import { Button, cx, Empty, ErrorBox, Loading, Textarea } from "../../components/ui";
import { Comments } from "./Comments";
import { DevTools } from "./DevTools";
import { Fields } from "./Fields";
import { History } from "./History";
import { Player, type PlayerHandle } from "./Player";
import { SendToJira } from "./SendToJira";
import { ShareButton } from "./ShareButton";
import { t } from "../../i18n";

export function ReportPage() {
  const { id } = useParams();
  const report = useReport(id);
  const events = useReportEvents(id);

  if (report.isLoading) return <Loading />;
  if (report.error) {
    return report.error instanceof ApiError && report.error.status === 404 ? (
      <Empty title={t("Report not found")}>{t("It may have been deleted for good, or the link is incomplete.")}</Empty>
    ) : (
      <div className="mx-auto max-w-xl p-6">
        <ErrorBox>{errorText(report.error)}</ErrorBox>
      </div>
    );
  }
  return <ReportView report={report.data!} events={events.data ?? []} />;
}

function ReportView({ report, events }: { report: ReportDetails; events: ReportEvent[] }) {
  const player = useRef<PlayerHandle>(null);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"comments" | "history">("comments");
  const [copied, setCopied] = useState(false);
  const del = useDeleteReport(report.id);

  const video = report.files.find((f) => f.kind === "VIDEO");
  const replay = report.files.find((f) => f.kind === "REPLAY");
  const poster = report.files.find((f) => f.kind === "SCREENSHOT") ?? report.files.find((f) => f.kind === "THUMBNAIL");
  const deleted = !!report.deletedAt;

  const pick = useCallback((e: ReportEvent) => {
    setSelected((cur) => (cur === e.id ? null : e.id));
    player.current?.seek(e.t);
  }, []);

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-6">
      {/* ------------------------- page header ------------------------- */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <nav className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
          <Link to="/reports" className="hover:text-ink">
            {t("Reports")}
          </Link>
          {report.project && (
            <>
              <span className="text-faint">/</span>
              <Link to={`/reports?project=${report.project.id}`} className="hover:text-ink">
                {report.project.key}
              </Link>
            </>
          )}
          {report.service && report.project && (
            <>
              <span className="text-faint">/</span>
              <Link to={`/reports?project=${report.project.id}&service=${report.service.id}`} className="truncate hover:text-ink">
                {report.service.name}
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {report.project && <SendToJira report={report} />}
          <ShareButton report={report} />
          <Button
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? t("Link copied") : t("Copy link")}
          </Button>
          {report.canDelete &&
            (deleted ? (
              <Button size="sm" onClick={() => del.mutate(false)} disabled={del.isPending}>
                {t("Restore")}
              </Button>
            ) : (
              <Button size="sm" variant="danger" onClick={() => confirm(t("Delete the report? It can be restored later.")) && del.mutate(true)} disabled={del.isPending}>
                {t("Delete")}
              </Button>
            ))}
        </div>
      </div>

      {deleted && (
        <div className="mb-3">
          <ErrorBox>{t("The report is deleted. It is hidden from lists; the author, a project maintainer or an administrator can restore it.")}</ErrorBox>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(400px,34%)]">
        {/* ------------------------- left column ------------------------- */}
        <div className="min-w-0">
          <Player
            ref={player}
            videoUrl={video?.url ?? null}
            replayUrl={replay?.url ?? null}
            posterUrl={poster?.url ?? null}
            durationMs={report.summary.durationMs || video?.durationMs || 0}
            events={events}
            selectedId={selected}
            onTime={setTime}
            onSelect={(e) => setSelected(e.id)}
          />

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_248px]">
            <div className="min-w-0">
              <TitleAndDescription report={report} />

              <div className="mt-6 flex gap-5 border-b border-line">
                {(
                  [
                    ["comments", t("Comments")],
                    ["history", t("History")],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={cx(
                      "relative h-10 text-[14px]",
                      tab === k ? "font-medium text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:bg-primary" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="py-4">
                {tab === "comments" ? (
                  <Comments reportId={report.id} time={time} hasVideo={!!video || !!replay} disabled={deleted} onSeek={(ms) => player.current?.seek(ms)} />
                ) : (
                  <History reportId={report.id} />
                )}
              </div>
            </div>
            <aside>
              <Fields report={report} />
            </aside>
          </div>
        </div>

        {/* ------------------------- DevTools ------------------------- */}
        <div className="xl:sticky xl:top-[72px] xl:h-[calc(100dvh-88px)]">
          <div className="h-[560px] xl:h-full">
            <DevTools report={report} events={events} time={time} selectedId={selected} onPick={pick} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TitleAndDescription({ report }: { report: ReportDetails }) {
  const update = useUpdateReport(report.id);
  const [editTitle, setEditTitle] = useState(false);
  const [editDesc, setEditDesc] = useState(false);
  const [title, setTitle] = useState(report.fields.title ?? "");
  const [desc, setDesc] = useState(report.fields.description ?? "");
  const readOnly = !!report.deletedAt || !report.canEdit;

  const saveTitle = () => {
    setEditTitle(false);
    if (title.trim() && title !== report.fields.title) update.mutate({ fields: { title: title.trim() } });
    else setTitle(report.fields.title ?? "");
  };
  const saveDesc = () => {
    setEditDesc(false);
    if (desc !== (report.fields.description ?? "")) update.mutate({ fields: { description: desc } });
  };

  return (
    <div>
      {editTitle ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setTitle(report.fields.title ?? "");
              setEditTitle(false);
            }
          }}
          className="-mx-2 w-[calc(100%+16px)] rounded-control border border-primary bg-surface px-2 py-0.5 text-[22px] font-semibold tracking-[-0.01em] outline-none"
        />
      ) : (
        <h1
          className={cx("-mx-2 rounded-control px-2 py-0.5 text-[22px] font-semibold leading-tight tracking-[-0.01em]", !readOnly && "cursor-text hover:bg-line-soft")}
          onClick={() => !readOnly && setEditTitle(true)}
          title={readOnly ? undefined : t("Click to edit")}
        >
          {report.fields.title}
        </h1>
      )}

      {editDesc ? (
        <div className="mt-2">
          <Textarea
            autoFocus
            rows={5}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveDesc();
              if (e.key === "Escape") {
                setDesc(report.fields.description ?? "");
                setEditDesc(false);
              }
            }}
            placeholder={t("Steps to reproduce, what you expected, what happened")}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={saveDesc}>
              {t("Save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDesc(report.fields.description ?? "");
                setEditDesc(false);
              }}
            >
              {t("Cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cx("-mx-2 mt-1 max-w-[72ch] rounded-control px-2 py-1.5 leading-relaxed", !readOnly && "cursor-text hover:bg-line-soft")}
          onClick={() => !readOnly && setEditDesc(true)}
        >
          {report.fields.description ? (
            <p className="whitespace-pre-wrap">{report.fields.description}</p>
          ) : (
            <p className="text-faint">{readOnly ? t("No description") : t("Add a description…")}</p>
          )}
        </div>
      )}
      {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}
    </div>
  );
}
