import { useState, type ReactNode } from "react";
import { errorText } from "../../api/client";
import { useEnvironments, useProject, useUpdateReport, useUsers } from "../../api/hooks";
import type { ReportDetails } from "../../api/types";
import { Avatar, ErrorBox, Select, SeverityMark, Tag } from "../../components/ui";
import { formatDuration, timeAgo } from "../../lib/format";
import { SEVERITY_LABEL, STATUS_LABEL } from "../../lib/labels";
import { ProjectPicker, UserPicker } from "../../components/Combobox";
import { EnvBadge } from "../../components/EnvBadge";
import { t } from "../../i18n";

/** Side column of report properties: status, severity, assignee, tags, project. Saved on every change. */
export function Fields({ report }: { report: ReportDetails }) {
  const update = useUpdateReport(report.id);
  const project = useProject(report.project?.id);
  const environments = useEnvironments(true);
  const f = report.fields;
  const readOnly = !!report.deletedAt || !report.canEdit;
  const envOptions = (environments.data ?? []).filter((e) => e.active || e.code === f.environment);

  const save = (fields: Record<string, unknown>) => update.mutate({ fields });

  return (
    <div className="space-y-3">
      <Prop label={t("Status")}>
        <Select disabled={readOnly} value={f.status ?? "NEW"} onChange={(e) => save({ status: e.target.value })}>
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </Select>
      </Prop>

      <Prop label={t("Severity")}>
        <div className="flex items-center gap-2">
          <SeverityMark severity={f.severity} />
          <Select disabled={readOnly} value={f.severity ?? ""} onChange={(e) => save({ severity: e.target.value || null })}>
            <option value="">{t("Not set")}</option>
            {Object.keys(SEVERITY_LABEL).map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s] ?? s}
              </option>
            ))}
          </Select>
        </div>
      </Prop>

      <Prop label={t("Environment")}>
        <div className="flex items-center gap-2">
          <EnvBadge env={f.environment} size="sm" />
          <Select disabled={readOnly} value={f.environment ?? ""} onChange={(e) => save({ environment: e.target.value || null })}>
            <option value="">{t("Not set")}</option>
            {envOptions.map((e) => (
              <option key={e.code} value={e.code}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>
      </Prop>

      <Prop label={t("Assignee")}>
        {readOnly ? (
          <p className="text-[13px]">{f.assignee_id ? <AssigneeName id={f.assignee_id} /> : t("Unassigned")}</p>
        ) : (
          <UserPicker value={f.assignee_id ?? undefined} onChange={(id) => save({ assignee_id: id ?? null })} emptyLabel={t("Unassigned")} />
        )}
      </Prop>

      <Prop label={t("Tags")}>
        <TagsEditor disabled={readOnly} tags={f.tags ?? []} onChange={(tags) => save({ tags })} />
      </Prop>

      <Prop label={t("Project")}>
        {readOnly ? (
          <p className="text-[13px]">{report.project ? `${report.project.key} — ${report.project.name}` : t("No project")}</p>
        ) : (
          <ProjectPicker
            value={report.project?.id}
            onChange={(id) => (id ? update.mutate({ projectId: id }) : update.mutate({ clearProject: true }))}
            emptyLabel={t("No project")}
          />
        )}
        {report.project && (project.data?.services.length ?? 0) > 0 && (
          <Select
            className="mt-2"
            disabled={readOnly}
            value={report.service?.id ?? ""}
            onChange={(e) => e.target.value && update.mutate({ projectId: report.project!.id, serviceId: e.target.value })}
          >
            <option value="" disabled>
              {t("No service")}
            </option>
            {project.data?.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </Prop>

      {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}

      <dl className="space-y-2 border-t border-line-soft pt-3 text-[13px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted">{t("Author")}</dt>
          <dd className="flex items-center gap-1.5">
            <Avatar name={report.author.name} size={20} />
            {report.author.name}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">{t("Created")}</dt>
          <dd>{timeAgo(report.createdAt)}</dd>
        </div>
        {report.summary.durationMs > 0 && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted">{t("Duration")}</dt>
            <dd>{formatDuration(report.summary.durationMs)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-muted">{t("Source")}</dt>
          <dd>{t(({ SCREENSHOT: "Screenshot (extension)", REPLAY: "Last 2 minutes (extension)", WIDGET: "Site widget", API: "API" } as Record<string, string>)[String(f.source)] ?? "Chrome extension")}</dd>
        </div>
      </dl>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[12px] text-muted">{label}</p>
      {children}
    </div>
  );
}

function AssigneeName({ id }: { id: string }) {
  const users = useUsers();
  return <>{users.data?.find((u) => u.id === id)?.fullName ?? "—"}</>;
}

function TagsEditor({ tags, onChange, disabled }: { tags: string[]; onChange: (t: string[]) => void; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const tag = draft.trim().toLowerCase();
    if (tag && !tags.includes(tag)) onChange([...tags, tag]);
    setDraft("");
  };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-control border border-line bg-surface px-2 py-1.5 focus-within:border-primary">
      {tags.map((tag) => (
        <Tag key={tag} onRemove={disabled ? undefined : () => onChange(tags.filter((x) => x !== tag))}>
          {tag}
        </Tag>
      ))}
      {!disabled && (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && tags.length) onChange(tags.slice(0, -1));
          }}
          onBlur={add}
          placeholder={tags.length ? "" : t("Add a tag")}
          className="h-6 min-w-[80px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
      )}
    </div>
  );
}
