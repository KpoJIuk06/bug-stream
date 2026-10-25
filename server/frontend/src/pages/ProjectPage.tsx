import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { errorText, request } from "../api/client";
import {
  useAddPattern,
  useArchiveProject,
  useArchiveService,
  useCreateService,
  useDeletePattern,
  useProject,
  useProjectHistory,
  useProjectMembers,
  useRemoveMember,
  useSetMember,
  useUpdateProject,
  useUsers,
  useEnvironments,
} from "../api/hooks";
import type { AuditEntry, MatchType, MemberRole, ProjectDetails, Service } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Avatar, Button, cx, Empty, ErrorBox, Field, Input, Loading, Modal, Select, Textarea } from "../components/ui";
import { timeAgo } from "../lib/format";
import { MATCH_TYPE_HINT, MEMBER_ROLE_LABEL } from "../lib/labels";
import { UserPicker } from "../components/Combobox";
import { JiraTab } from "./project/JiraTab";
import { NetworkFilterTab } from "./project/NetworkFilterTab";
import { WidgetTab } from "./project/WidgetTab";
import { EnvBadge } from "../components/EnvBadge";
import { labels, t } from "../i18n";

export function ProjectPage() {
  const { id } = useParams();
  const project = useProject(id);
  if (project.isLoading) return <Loading />;
  if (project.error)
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorBox>{errorText(project.error)}</ErrorBox>
      </div>
    );
  return <ProjectView d={project.data!} />;
}

function ProjectView({ d }: { d: ProjectDetails }) {
  const p = d.project;
  const [tab, setTab] = useState<"services" | "members" | "network" | "integrations" | "widget" | "history">("services");
  const [editing, setEditing] = useState(false);
  const archive = useArchiveProject(p.id);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <Link to="/projects" className="text-[13px] text-muted hover:text-ink">
        {t("Projects")}
      </Link>
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-[5px] bg-ink px-2 py-0.5 font-mono text-[13px] font-medium text-white">{p.key}</span>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{p.name}</h1>
            {p.archivedAt && <span className="rounded-full bg-line-soft px-2.5 py-0.5 text-[12px] text-muted">{t("archived")}</span>}
            {p.jiraProjectKey && <span className="rounded-full bg-ev-network-soft px-2.5 py-0.5 text-[12px] text-ev-network">Jira {p.jiraProjectKey}</span>}
          </div>
          {p.description && <p className="mt-1 max-w-[72ch] text-muted">{p.description}</p>}
          <p className="mt-2 flex flex-wrap gap-x-4 text-[13px] text-faint">
            <span>{t("Created by {name} {when}", { name: p.createdByName, when: timeAgo(p.createdAt) })}</span>
            <Link to={`/reports?project=${p.id}`} className="text-primary hover:underline">
              {t("{n} reports", { n: p.reportsCount })}
            </Link>
          </p>
        </div>
        {d.canManage && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setEditing(true)}>
              {t("Edit")}
            </Button>
            <Button
              size="sm"
              variant={p.archivedAt ? "secondary" : "danger"}
              disabled={archive.isPending}
              onClick={() => (p.archivedAt || confirm(t("Archive the project? Its reports stay; new reports will not be linked to it."))) && archive.mutate(!p.archivedAt)}
            >
              {p.archivedAt ? t("Restore from archive") : t("Archive")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-5 overflow-x-auto border-b border-line">
        {(
          [
            ["services", `${t("Services")} ${d.services.filter((s) => !s.archivedAt).length}`],
            ["members", `${t("Members")} ${p.membersCount}`],
            ["network", `${t("Network filter")}${d.networkIgnore.length ? " " + d.networkIgnore.length : ""}`],
            ["integrations", t("Jira & Slack")],
            ["widget", t("Widget")],
            ["history", t("History")],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx("relative h-10 shrink-0", tab === k ? "font-medium after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-primary" : "text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="py-5">
        {tab === "services" && <ServicesTab d={d} />}
        {tab === "members" && <MembersTab projectId={p.id} />}
        {tab === "network" && <NetworkFilterTab d={d} />}
        {tab === "integrations" && <JiraTab d={d} />}
        {tab === "widget" && <WidgetTab projectId={p.id} canManage={d.canManage} />}
        {tab === "history" && <HistoryTab projectId={p.id} />}
      </div>

      <EditProjectModal d={d} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

// ============================== Services ==============================

function ServicesTab({ d }: { d: ProjectDetails }) {
  const [creating, setCreating] = useState(false);
  const active = d.services.filter((s) => !s.archivedAt);
  const archived = d.services.filter((s) => s.archivedAt);
  return (
    <div className="space-y-4">
      <UrlTester />
      {d.canManage && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t("Add service")}
          </Button>
        </div>
      )}
      {active.length === 0 && (
        <div className="rounded-panel border border-dashed border-line bg-surface">
          <Empty title={t("No services yet")}>{t("A service is an application or stand with an address, e.g. \"Portal\" at 10.0.0.15:8080.")}</Empty>
        </div>
      )}
      {active.map((s) => (
        <ServiceCard key={s.id} s={s} projectId={d.project.id} canManage={d.canManage} />
      ))}
      {archived.length > 0 && (
        <details className="text-muted">
          <summary className="cursor-pointer text-[13px]">{t("Archived services: {n}", { n: archived.length })}</summary>
          <div className="mt-3 space-y-3">
            {archived.map((s) => (
              <ServiceCard key={s.id} s={s} projectId={d.project.id} canManage={d.canManage} />
            ))}
          </div>
        </details>
      )}
      <CreateServiceModal projectId={d.project.id} open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ServiceCard({ s, projectId, canManage }: { s: Service; projectId: string; canManage: boolean }) {
  const add = useAddPattern(projectId);
  const del = useDeletePattern(projectId);
  const archive = useArchiveService(projectId);
  const [type, setType] = useState<MatchType>("HOST");
  const [pattern, setPattern] = useState("");

  return (
    <div className={cx("rounded-panel border border-line bg-surface", s.archivedAt && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line-soft px-4 py-3">
        <div className="mr-auto min-w-0">
          <p className="font-medium">
            {s.name} <span className="ml-1 font-mono text-[12px] font-normal text-faint">{s.code}</span>
          </p>
          {s.description && <p className="text-[13px] text-muted">{s.description}</p>}
        </div>
        <EnvBadge env={s.environment} />
        {canManage && (
          <Button size="sm" variant="ghost" onClick={() => archive.mutate({ id: s.id, archive: !s.archivedAt })}>
            {s.archivedAt ? t("Restore") : t("Archive")}
          </Button>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="mb-2 text-[13px] text-muted">{t("Addresses that link a report to this service")}</p>
        {s.patterns.length === 0 && <p className="text-[13px] text-faint">{t("No addresses — reports will not be linked automatically.")}</p>}
        <ul className="space-y-1">
          {s.patterns.map((p) => (
            <li key={p.id} className="group flex items-center gap-3 rounded-control px-2 py-1 hover:bg-fog">
              <span className="w-[150px] shrink-0 text-[12px] text-muted">{MATCH_TYPE_HINT[p.matchType].label}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{p.pattern}</code>
              {p.priority !== 0 && <span className="text-[12px] text-faint">{t("priority {n}", { n: p.priority })}</span>}
              {canManage && (
                <button onClick={() => del.mutate(p.id)} className="text-[12px] text-faint opacity-0 hover:text-ev-error group-hover:opacity-100 focus:opacity-100">
                  {t("Delete")}
                </button>
              )}
            </li>
          ))}
        </ul>
        {canManage && !s.archivedAt && (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate({ serviceId: s.id, matchType: type, pattern }, { onSuccess: () => setPattern("") });
            }}
          >
            <Select className="w-[190px]" value={type} onChange={(e) => setType(e.target.value as MatchType)}>
              {Object.entries(MATCH_TYPE_HINT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Input className="min-w-[220px] flex-1 font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder={MATCH_TYPE_HINT[type].placeholder} required />
            <Button type="submit" disabled={add.isPending}>
              {t("Add address")}
            </Button>
          </form>
        )}
        {add.error && (
          <div className="mt-2">
            <ErrorBox>{errorText(add.error)}</ErrorBox>
          </div>
        )}
      </div>
    </div>
  );
}


/** Check: which project and service a report from this address goes to. */
function UrlTester() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{ matched: boolean; projectKey?: string; serviceName?: string; pattern?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="rounded-panel border border-line bg-surface px-4 py-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          setResult(await request("/api/projects/resolve", { query: { url } }));
        } catch (err) {
          setError(errorText(err));
        }
      }}
    >
      <p className="mb-2 text-[13px] text-muted">{t("Check an address — where a report recorded on that page goes")}</p>
      <div className="flex gap-2">
        <Input className="font-mono" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://10.0.0.15:8080/runApp" required />
        <Button type="submit">{t("Check")}</Button>
      </div>
      {result && (
        <p className={cx("mt-2 text-[13px]", result.matched ? "text-ev-nav" : "text-muted")}>
          {result.matched ? (
            <>
              {t("Project")} <b>{result.projectKey}</b>, {t("service")} <b>{result.serviceName}</b> — {t("by pattern")} <code className="font-mono">{result.pattern}</code>
            </>
          ) : (
            t("No pattern matches — the report will have no project.")
          )}
        </p>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
    </form>
  );
}

function CreateServiceModal({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const create = useCreateService(projectId);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const environments = useEnvironments();
  const [env, setEnv] = useState("");
  const [type, setType] = useState<MatchType>("HOST");
  const [pattern, setPattern] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={t("New service")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { name, code, environment: env || (environments.data?.find((x) => x.code === "TEST")?.code ?? environments.data?.[0]?.code ?? ""), patterns: pattern.trim() ? [{ matchType: type, pattern: pattern.trim() }] : [] },
            {
              onSuccess: () => {
                setName("");
                setCode("");
                setPattern("");
                onClose();
              },
            },
          );
        }}
      >
        <Field label={t("Name")}>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!code || code === slug(name)) setCode(slug(e.target.value));
            }}
            required
            autoFocus
            placeholder={t("Portal")}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Code")} hint={t("Latin letters, digits, - and _")}>
            <Input className="font-mono" value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} required pattern="[a-z0-9][a-z0-9_\-]{1,49}" />
          </Field>
          <Field label={t("Environment")}>
            <Select value={env || (environments.data?.find((x) => x.code === "TEST")?.code ?? "")} onChange={(e) => setEnv(e.target.value)}>
              {environments.data?.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("Address")} hint={MATCH_TYPE_HINT[type].hint + ". " + t("Can be added later.")}>
          <div className="flex gap-2">
            <Select className="w-[170px] shrink-0" value={type} onChange={(e) => setType(e.target.value as MatchType)}>
              {Object.entries(MATCH_TYPE_HINT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Input className="font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder={MATCH_TYPE_HINT[type].placeholder} />
          </div>
        </Field>
        {create.error && <ErrorBox>{errorText(create.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t("Add service")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const TRANSLIT: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya", ə: "e", ğ: "g", ı: "i", ö: "o", ü: "u", ş: "sh", ç: "ch" };
function slug(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((c) => TRANSLIT[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function EditProjectModal({ d, open, onClose }: { d: ProjectDetails; open: boolean; onClose: () => void }) {
  const update = useUpdateProject(d.project.id);
  const [name, setName] = useState(d.project.name);
  const [description, setDescription] = useState(d.project.description ?? "");
  return (
    <Modal open={open} onClose={onClose} title={t("Project")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ name, description, visibility: d.project.visibility }, { onSuccess: onClose });
        }}
      >
        <Field label={t("Name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label={t("Description")}>
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {update.error && <ErrorBox>{errorText(update.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {t("Save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ============================== Members ==============================

function MembersTab({ projectId }: { projectId: string }) {
  const members = useProjectMembers(projectId);
  const { user, can } = useAuth();
  const setMember = useSetMember(projectId);
  const remove = useRemoveMember(projectId);
  const [newUser, setNewUser] = useState<string | undefined>();
  const [newRole, setNewRole] = useState<MemberRole>("MEMBER");

  const list = members.data ?? [];
  const myRole = list.find((m) => m.userId === user?.id)?.projectRole;
  const canManage = can("project.manage_all") || myRole === "OWNER";
  const error = setMember.error ?? remove.error;

  if (members.isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        <ul className="divide-y divide-line-soft">
          {list.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <Avatar name={m.fullName} size={30} />
              <div className="mr-auto min-w-0">
                <p className="font-medium">
                  {m.fullName} {!m.userActive && <span className="text-[12px] font-normal text-faint">{t("disabled")}</span>}
                </p>
                <p className="text-[13px] text-muted">
                  {m.email} · {m.userRole}
                </p>
              </div>
              {canManage ? (
                <Select className="w-[160px]" value={m.projectRole} onChange={(e) => setMember.mutate({ userId: m.userId, role: e.target.value as MemberRole })}>
                  {Object.entries(MEMBER_ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="text-[13px] text-muted">{MEMBER_ROLE_LABEL[m.projectRole]}</span>
              )}
              {(canManage || m.userId === user?.id) && (
                <Button size="sm" variant="ghost" onClick={() => confirm(m.userId === user?.id ? t("Leave the project?") : t("Remove {name} from the project?", { name: m.fullName })) && remove.mutate(m.userId)}>
                  {m.userId === user?.id ? t("Leave") : t("Remove")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {canManage && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newUser) setMember.mutate({ userId: newUser, role: newRole }, { onSuccess: () => setNewUser(undefined) });
          }}
        >
          <UserPicker className="min-w-[240px] flex-1" value={newUser} onChange={setNewUser} emptyLabel={t("Choose a user")} />
          <Select className="w-[160px]" value={newRole} onChange={(e) => setNewRole(e.target.value as MemberRole)}>
            {Object.entries(MEMBER_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={!newUser || setMember.isPending}>
            {t("Add member")}
          </Button>
        </form>
      )}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      <p className="text-[13px] text-faint">
        {t("The owner manages members. A maintainer configures the project and services. Public projects are visible to everyone; project roles decide who can change them.")}
      </p>
    </div>
  );
}

// ============================== History ==============================

const TABLE_LABEL = labels({
  project: "project",
  project_service: "service",
  service_url_pattern: "service address",
  project_member: "member",
  attribute: "field",
  project_widget_key: "widget key",
  project_integration: "integration",
} as Record<string, string>);

const KEY_LABEL = labels({
  name: "name",
  description: "description",
  archived_at: "archive",
  environment: "environment",
  pattern: "address",
  role: "role",
  visibility: "visibility",
  priority: "priority",
} as Record<string, string>);

function HistoryTab({ projectId }: { projectId: string }) {
  const history = useProjectHistory(projectId, true);
  const users = useUsers("", true);
  if (history.isLoading) return <Loading />;
  const list = history.data ?? [];
  if (list.length === 0) return <p className="text-muted">{t("No changes yet.")}</p>;

  const userName = (id: unknown) => users.data?.find((u) => u.id === id)?.fullName ?? t("a user");
  const describe = (h: AuditEntry): ReactNode => {
    const what = TABLE_LABEL[h.tableName] ?? h.tableName;
    const data = h.newData ?? h.oldData ?? {};
    const name = (data.name as string) ?? (data.pattern as string) ?? (h.tableName === "project_member" ? userName(data.user_id) : "");
    if (h.action === "INSERT") return <>{t("added {what}", { what })} <b className="font-medium">{name}</b></>;
    if (h.action === "DELETE") return <>{t("removed {what}", { what })} <b className="font-medium">{name}</b></>;
    const changes = Object.keys(h.newData ?? {}).map((k) => {
      const nv = h.newData?.[k];
      if (k === "archived_at") return nv ? t("archived it") : t("restored it from the archive");
      if (k === "role") return `${t("role")}: ${MEMBER_ROLE_LABEL[String(h.oldData?.[k])] ?? "—"} → ${MEMBER_ROLE_LABEL[String(nv)] ?? nv}`;
      return `${KEY_LABEL[k] ?? k}: ${String(h.oldData?.[k] ?? "—")} → ${String(nv ?? "—")}`;
    });
    return (
      <>
        {t("changed {what}", { what })} {h.tableName === "project_member" ? userName(h.oldData?.user_id ?? data.user_id) : ""}: {changes.join("; ")}
      </>
    );
  };

  return (
    <ol className="space-y-3">
      {list.map((h) => (
        <li key={h.id} className="flex gap-2.5 text-[13px]">
          <Avatar name={h.changedByName ?? "?"} size={22} />
          <p className="min-w-0 flex-1 pt-0.5">
            <span className="font-medium">{h.changedByName ?? t("System")}</span> {describe(h)}
            <span className="ml-2 text-faint">{timeAgo(h.changedAt)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
