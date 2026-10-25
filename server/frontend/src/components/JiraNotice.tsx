import { useState } from "react";
import { Link } from "react-router";
import { useMyJira } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { t } from "../i18n";

const KEY = "bugstream.jiraNotice.hidden";

/**
 * A strip under the top bar when Jira is connected but the user has no working personal token —
 * so they add it before they need to send a report.
 */
export function JiraNotice() {
  const { can } = useAuth();
  const my = useMyJira();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const d = my.data;
  if (!d || !d.configured || !can("report.send_tracker") || (d.connected && !d.invalid)) return null;
  if (hidden && !d.invalid) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-ev-warn/30 bg-ev-warn-soft px-4 py-2 text-[13px] md:px-6">
      <span className="text-ev-warn">●</span>
      <span>
        {d.invalid
          ? t("Jira rejected your API token (expired or revoked). Enter a new one.")
          : t("Add your Jira API token to send reports to Jira on your behalf.")}
      </span>
      <Link to="/profile#jira" className="font-medium text-primary hover:underline">
        {d.invalid ? t("Update token") : t("Add token")}
      </Link>
      {!d.invalid && (
        <button
          className="ml-auto text-faint hover:text-ink"
          onClick={() => {
            setHidden(true);
            try {
              sessionStorage.setItem(KEY, "1");
            } catch {
              /* ignore */
            }
          }}
          aria-label={t("Hide")}
        >
          ✕
        </button>
      )}
    </div>
  );
}
