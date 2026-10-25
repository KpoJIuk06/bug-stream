import { useState } from "react";
import { Link } from "react-router";
import { ApiError, errorText } from "../../api/client";
import { useMyJira, useProject, useRefreshJiraLinks, useReportLinks, useSendToJira } from "../../api/hooks";
import { JiraStatusBadge } from "../../components/JiraStatus";
import { timeAgo } from "../../lib/format";
import type { ReportDetails } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Spinner } from "../../components/ui";
import { t } from "../../i18n";

/** "Send to Jira": creates an issue with the user's own token and shows links to issues already created. */
export function SendToJira({ report }: { report: ReportDetails }) {
  const { can } = useAuth();
  const links = useReportLinks(report.id);
  const project = useProject(report.project?.id);
  const my = useMyJira();
  const send = useSendToJira(report.id);
  const refresh = useRefreshJiraLinks(report.id);
  const [open, setOpen] = useState(false);

  const jiraKey = project.data?.project.jiraProjectKey;
  const canSend = can("report.send_tracker") && !!jiraKey && !!my.data?.configured;
  const needsToken = !!my.data && (!my.data.connected || my.data.invalid);
  const err = send.error instanceof ApiError ? send.error : null;
  const tokenProblem = err?.code === "JIRA_TOKEN_MISSING" || err?.code === "JIRA_TOKEN_INVALID";

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {links.data?.map((l) => (
        <span
          key={l.id}
          className="inline-flex h-7 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5"
          title={
            t("Created by {name}", { name: l.createdByName ?? "—" }) +
            (l.statusSyncedAt ? " · " + t("status checked {when}", { when: timeAgo(l.statusSyncedAt) }) : "")
          }
        >
          {l.missingAt ? (
            <span className="text-[12px] text-faint line-through">Jira {l.externalKey}</span>
          ) : (
            <JiraStatusBadge jira={{ key: l.externalKey, url: l.externalUrl, status: l.statusName, category: l.statusCategory }} />
          )}
        </span>
      ))}
      {(links.data?.length ?? 0) > 0 && (
        <button
          type="button"
          className="text-[12px] text-faint hover:text-ink disabled:opacity-50"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          title={t("Check the Jira status now")}
        >
          {refresh.isPending ? <Spinner className="size-3" /> : "↻"}
        </button>
      )}
      {canSend && (
        <Button size="sm" onClick={() => setOpen((v) => !v)} disabled={send.isPending}>
          {send.isPending ? (
            <>
              <Spinner className="size-3.5" /> {t("Creating issue…")}
            </>
          ) : (
            t("Send to Jira")
          )}
        </Button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-[300px] rounded-panel border border-line bg-surface p-3 text-[13px] shadow-[0_16px_40px_-12px_rgba(24,32,44,0.3)]">
            {needsToken ? (
              <TokenHint invalid={!!my.data?.invalid} />
            ) : (
              <>
                <p className="text-muted">
                  {t("Create an issue in Jira project {key} with a link to this report. You will be the reporter.", { key: jiraKey ?? "" })}
                </p>
                <Button
                  className="mt-3 w-full"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    send.mutate(undefined);
                  }}
                >
                  {t("Create issue")}
                </Button>
              </>
            )}
          </div>
        </>
      )}
      {send.error && !open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-[320px] rounded-panel border border-ev-error/30 bg-ev-error-soft p-3 text-[13px] text-ev-error">
          {tokenProblem ? <TokenHint invalid={err?.code === "JIRA_TOKEN_INVALID"} /> : errorText(send.error)}
          <button className="mt-2 block text-[12px] text-faint hover:text-ink" onClick={() => send.reset()}>
            {t("Close")}
          </button>
        </div>
      )}
    </div>
  );
}

function TokenHint({ invalid }: { invalid: boolean }) {
  return (
    <p className="text-ink">
      {invalid
        ? t("Jira rejected your API token (expired or revoked). Enter a new one.")
        : t("Add your Jira API token to send reports to Jira on your behalf.")}{" "}
      <Link to="/profile#jira" className="font-medium text-primary hover:underline">
        {invalid ? t("Update token") : t("Add token")}
      </Link>
    </p>
  );
}
