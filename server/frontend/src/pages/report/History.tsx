import { useReportHistory, useUsers } from "../../api/hooks";
import type { HistoryEntry } from "../../api/types";
import { Avatar, Spinner } from "../../components/ui";
import { formatDateTime, timeAgo } from "../../lib/format";
import { FIELD_LABEL, valueLabel } from "../../lib/labels";
import { t } from "../../i18n";

/** Report history: who changed what and when. */
export function History({ reportId }: { reportId: string }) {
  const history = useReportHistory(reportId, true);
  const users = useUsers("", true);
  const userName = (id: unknown) => users.data?.find((u) => u.id === id)?.fullName ?? t("unknown user");

  if (history.isLoading) return <Spinner />;
  const list = history.data ?? [];
  if (list.length === 0) return <p className="text-muted">{t("No changes yet.")}</p>;

  const describe = (h: HistoryEntry): React.ReactNode => {
    const field = h.field ? FIELD_LABEL[h.field] ?? h.fieldLabel ?? h.field : null;
    const show = (v: unknown) => (h.field === "assignee_id" ? (v ? userName(v) : "—") : valueLabel(h.field, v));
    switch (h.action) {
      case "CREATE":
        return t("created the report");
      case "DELETE":
        return t("deleted the report");
      case "RESTORE":
        return t("restored the report");
      case "MOVE":
        return t("moved the report to another project or service");
      case "SET":
        return (
          <>
            {t("set {field}", { field: field?.toLowerCase() })}: <b className="font-medium">{show(h.newValue)}</b>
          </>
        );
      case "UNSET":
        return (
          <>
            {t("cleared {field}", { field: field?.toLowerCase() })} <span className="text-faint line-through">{show(h.oldValue)}</span>
          </>
        );
      case "UPDATE":
        if (h.field === "description") return t("changed the description");
        return (
          <>
            {t("changed {field}", { field: field?.toLowerCase() })}: <span className="text-faint">{show(h.oldValue)}</span> → <b className="font-medium">{show(h.newValue)}</b>
          </>
        );
      default:
        return h.action;
    }
  };

  return (
    <ol className="space-y-3">
      {list.map((h) => (
        <li key={h.id} className="flex gap-2.5 text-[13px]">
          <Avatar name={h.changedBy?.name ?? "?"} size={22} />
          <p className="min-w-0 flex-1 pt-0.5">
            <span className="font-medium">{h.changedBy?.name ?? t("System")}</span> {describe(h)}
            <span className="ml-2 text-faint" title={formatDateTime(h.changedAt)}>
              {timeAgo(h.changedAt)}
            </span>
          </p>
        </li>
      ))}
    </ol>
  );
}
