import type { JiraRef } from "../api/types";
import { t } from "../i18n";
import { cx } from "./ui";

const TONE: Record<string, string> = {
  new: "bg-fog text-muted border-line",
  indeterminate: "bg-ev-network-soft text-ev-network border-ev-network/25",
  done: "bg-ev-nav-soft text-ev-nav border-ev-nav/25",
};

/** Jira issue key + its status, colored by Jira's status category (To Do / In Progress / Done). */
export function JiraStatusBadge({ jira, link = true, compact = false }: { jira: JiraRef; link?: boolean; compact?: boolean }) {
  const tone = TONE[jira.category ?? "new"] ?? TONE.new;
  const label = jira.status ?? t("status pending");
  const body = (
    <>
      <span className="font-mono font-medium">{jira.key}</span>
      {!compact && <span className={cx("truncate rounded-full border px-1.5 py-px text-[11px]", tone)}>{label}</span>}
    </>
  );
  const title = t("Jira {key}: {status}", { key: jira.key, status: label });
  return link ? (
    <a
      href={jira.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex max-w-full items-center gap-1.5 text-[12px] text-ink hover:underline"
      title={title}
    >
      {body}
    </a>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1.5 text-[12px]" title={title}>
      {body}
    </span>
  );
}
