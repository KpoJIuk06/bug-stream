import { useState } from "react";
import { errorText } from "../../api/client";
import { useAudit, useAuditTables } from "../../api/hooks";
import type { AuditEntry } from "../../api/types";
import { Pagination } from "../../components/Pagination";
import { Avatar, cx, ErrorBox, Loading, PageHeader, Select } from "../../components/ui";
import { labels, t } from "../../i18n";
import { formatDateTime, timeAgo } from "../../lib/format";

const TABLES = labels({
  app_user: "Users",
  app_role: "Roles",
  role_permission: "Role permissions",
  environment: "Environments",
  app_setting: "Settings",
  project: "Projects",
  project_member: "Project members",
  project_service: "Services",
  service_url_pattern: "Service addresses",
  project_integration: "Integrations",
  project_widget_key: "Widget keys",
  attribute: "Report fields",
  jira_connection: "Jira connection",
  report_share: "Public links",
} as Record<string, string>);

const ACTIONS = labels({ INSERT: "created", UPDATE: "changed", DELETE: "deleted" } as Record<string, string>);

/** Who changed what in the reference tables (users, roles, projects, settings ...). */
export function AdminAuditPage() {
  const [table, setTable] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(50);
  const audit = useAudit(table, page, size);
  const tables = useAuditTables();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Audit log")}
        subtitle={t("Changes of users, roles, projects and settings. Passwords and tokens are never logged.")}
        actions={
          <Select
            className="w-56"
            value={table}
            onChange={(e) => {
              setTable(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{t("Everything")}</option>
            {tables.data?.map((x) => (
              <option key={x} value={x}>
                {TABLES[x] ?? x}
              </option>
            ))}
          </Select>
        }
      />
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {audit.isLoading ? (
          <Loading />
        ) : audit.error ? (
          <div className="p-4">
            <ErrorBox>{errorText(audit.error)}</ErrorBox>
          </div>
        ) : audit.data?.items.length === 0 ? (
          <p className="p-6 text-center text-muted">{t("No changes yet.")}</p>
        ) : (
          <ul className={cx("divide-y divide-line-soft", audit.isFetching && "opacity-70")}>
            {audit.data?.items.map((a) => (
              <li key={a.id}>
                <button className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-fog" onClick={() => setOpen(open === a.id ? null : a.id)}>
                  <Avatar name={a.changedByName ?? "?"} size={24} />
                  <span className="min-w-0 flex-1 text-[13px]">
                    <span className="font-medium">{a.changedByName ?? t("System")}</span> {ACTIONS[a.action]}{" "}
                    <span className="text-muted">{TABLES[a.tableName] ?? a.tableName}</span> <b className="font-medium">{summary(a)}</b>
                    <span className="block text-[12px] text-faint" title={formatDateTime(a.changedAt)}>
                      {timeAgo(a.changedAt)}
                    </span>
                  </span>
                  <span className="text-faint">{open === a.id ? "▾" : "▸"}</span>
                </button>
                {open === a.id && <Diff a={a} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      {audit.data && <Pagination page={page} size={size} total={audit.data.total} onPage={setPage} onSize={(n) => (setSize(n), setPage(0))} />}
    </div>
  );
}

function summary(a: AuditEntry): string {
  const d = (a.newData ?? a.oldData ?? {}) as Record<string, unknown>;
  const v = d.name ?? d.full_name ?? d.email ?? d.code ?? d.key ?? d.pattern ?? d.permission_code;
  return v == null ? "" : String(v);
}

function Diff({ a }: { a: AuditEntry }) {
  const keys = [...new Set([...Object.keys(a.oldData ?? {}), ...Object.keys(a.newData ?? {})])];
  const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <div className="bg-fog/60 px-4 pb-3 pl-[52px]">
      <table className="w-full text-[12px]">
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="align-top">
              <td className="w-40 py-0.5 pr-3 font-mono text-muted">{k}</td>
              <td className="py-0.5 pr-3 font-mono text-faint line-through decoration-1">{a.action === "INSERT" ? "" : show(a.oldData?.[k])}</td>
              <td className="py-0.5 font-mono">{a.action === "DELETE" ? "" : show(a.newData?.[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
