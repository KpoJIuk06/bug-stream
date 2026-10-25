import { useCallback, useRef, useState } from "react";
import { useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ApiError, errorText, request } from "../api/client";
import type { ReportDetails, ReportEvent } from "../api/types";
import { EnvBadge } from "../components/EnvBadge";
import { LanguageSwitch, Logo } from "../components/Layout";
import { Empty, ErrorBox, Loading, SeverityMark, StatusBadge } from "../components/ui";
import { t } from "../i18n";
import { formatDateTime } from "../lib/format";
import { DevTools } from "./report/DevTools";
import { Player, type PlayerHandle } from "./report/Player";

/** A report opened by a public link: read-only, no sign-in, no comments or history. */
export function PublicReportPage() {
  const { token } = useParams();
  const report = useQuery({
    queryKey: ["public", token],
    queryFn: () => request<ReportDetails>(`/api/public/reports/${token}`, { auth: false }),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["public", token, "events"],
    queryFn: () => request<ReportEvent[]>(`/api/public/reports/${token}/events`, { auth: false }),
    enabled: report.isSuccess,
    staleTime: Infinity,
  });

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
        <Logo />
        <span className="rounded-full bg-line-soft px-2.5 py-0.5 text-[12px] text-muted">{t("Shared report · read-only")}</span>
        <div className="ml-auto w-36">
          <LanguageSwitch compact />
        </div>
      </header>
      {report.isLoading ? (
        <Loading />
      ) : report.error ? (
        report.error instanceof ApiError && report.error.status === 404 ? (
          <Empty title={t("The link has expired or was turned off")}>{t("Ask the person who shared it for a new link.")}</Empty>
        ) : (
          <div className="mx-auto max-w-xl p-6">
            <ErrorBox>{errorText(report.error)}</ErrorBox>
          </div>
        )
      ) : (
        <View report={report.data!} events={events.data ?? []} />
      )}
    </div>
  );
}

function View({ report, events }: { report: ReportDetails; events: ReportEvent[] }) {
  const player = useRef<PlayerHandle>(null);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const video = report.files.find((f) => f.kind === "VIDEO");
  const replay = report.files.find((f) => f.kind === "REPLAY");
  const poster = report.files.find((f) => f.kind === "SCREENSHOT") ?? report.files.find((f) => f.kind === "THUMBNAIL");
  const pick = useCallback((e: ReportEvent) => {
    setSelected((cur) => (cur === e.id ? null : e.id));
    player.current?.seek(e.t);
  }, []);
  const f = report.fields;

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4 md:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(400px,34%)]">
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
          <div className="mt-5">
            <p className="text-[12px] text-faint">
              {report.project ? `${report.project.key} · ${report.project.name}` : t("No project")}
              {report.service && ` / ${report.service.name}`}
            </p>
            <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.01em]">{f.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {f.status && <StatusBadge status={f.status} />}
              <SeverityMark severity={f.severity} withLabel />
              <EnvBadge env={f.environment} size="sm" />
              <span className="text-[13px] text-muted">
                {report.author.name} · {formatDateTime(report.createdAt)}
              </span>
            </div>
            {f.description && <p className="mt-3 max-w-[72ch] whitespace-pre-wrap leading-relaxed">{f.description}</p>}
          </div>
        </div>
        <div className="xl:sticky xl:top-4 xl:h-[calc(100dvh-88px)]">
          <div className="h-[560px] xl:h-full">
            <DevTools report={report} events={events} time={time} selectedId={selected} onPick={pick} />
          </div>
        </div>
      </div>
    </div>
  );
}
