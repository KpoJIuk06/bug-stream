import { useEffect, useState } from "react";
import { Link } from "react-router";
import { errorText } from "../../api/client";
import { useBulkIssueType, useIssueTypeUsage, useJiraAdmin, useJiraLinked, useJiraProjects, useJiraStatus, useLinkProjectJira, useRefreshIssueTypes } from "../../api/hooks";
import type { JiraConnectResult, JiraLinkedProject } from "../../api/types";
import { Button, Card, cx, ErrorBox, Field, Input, Loading, PageHeader, Select } from "../../components/ui";
import { t } from "../../i18n";
import { timeAgo } from "../../lib/format";

const TOKEN_HELP = "https://id.atlassian.com/manage-profile/security/api-tokens";

/**
 * Admin → Jira: one Jira Cloud site for everybody. The service account only reads the project list;
 * issues are created with each person's own token (My profile → Jira).
 */
export function AdminJiraPage() {
  const status = useJiraStatus();
  if (status.isLoading) return <Loading />;
  const s = status.data!;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Jira")}
        subtitle={t("Connect your Jira Cloud site, load its projects and choose which ones Bug Stream works with. Issues are created with each person's own API token, so Jira shows who reported the bug.")}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <ConnectionCard />
        {s.configured ? (
          <div className="min-w-0 space-y-4">
            <ProjectsCard />
            {s.linkedCount > 0 && <LinkedCard />}
          </div>
        ) : (
          <Card title={t("Projects")}>
            <p className="p-4 text-[13px] text-muted">{t("Connect Jira first — then load the list of its projects here.")}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ConnectionCard() {
  const status = useJiraStatus();
  const m = useJiraAdmin();
  const s = status.data!;
  const [baseUrl, setBaseUrl] = useState(s.baseUrl ?? "https://");
  const [email, setEmail] = useState(s.serviceEmail ?? "");
  const [token, setToken] = useState("");
  const [issueType, setIssueType] = useState(s.defaultIssueType || "Bug");
  const [envField, setEnvField] = useState(s.environmentField ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(false), [baseUrl, email, token, issueType, envField]);

  return (
    <Card
      title={t("Connection")}
      actions={
        s.configured ? (
          <span className="text-[12px] text-ev-nav">● {t("connected")}</span>
        ) : (
          <span className="text-[12px] text-faint">○ {t("not connected")}</span>
        )
      }
    >
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.save.mutate(
            { baseUrl, email, token: token || undefined, defaultIssueType: issueType, environmentField: envField || undefined },
            { onSuccess: () => (setToken(""), setSaved(true)) },
          );
        }}
      >
        <Field label={t("Jira address")}>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://company.atlassian.net" required className="font-mono" />
        </Field>
        <Field label={t("Service account e-mail")} hint={t("Used only to read the list of projects. It needs \"Browse projects\" in the projects you want.")}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field
          label={t("API token")}
          hint={s.configured ? t("Leave empty to keep the saved token.") : undefined}
        >
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} required={!s.configured} autoComplete="off" />
        </Field>
        <p className="text-[12px] text-faint">
          {t("Create a token at")}{" "}
          <a href={TOKEN_HELP} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            id.atlassian.com → Security → API tokens
          </a>
        </p>
        <div className="space-y-3">
          <Field label={t("Default issue type")} hint={t("For all projects without their own type")}>
            <DefaultTypePicker value={issueType} onChange={setIssueType} enabled={s.configured} />
          </Field>
          <Field label={t("Environment field")} hint={t("Optional, e.g. environment or customfield_10050")}>
            <Input value={envField} onChange={(e) => setEnvField(e.target.value)} className="font-mono" />
          </Field>
        </div>
        {m.save.error && <ErrorBox>{errorText(m.save.error)}</ErrorBox>}
        {m.test.error && <ErrorBox>{errorText(m.test.error)}</ErrorBox>}
        {m.test.data && <p className="text-[13px] text-ev-nav">{t("Connected as {name}", { name: m.test.data.displayName })}</p>}
        {saved && <p className="text-[13px] text-ev-nav">{t("Saved — the account works.")}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={m.save.isPending}>
            {m.save.isPending ? t("Checking…") : s.configured ? t("Save") : t("Connect")}
          </Button>
          {s.configured && (
            <>
              <Button type="button" onClick={() => m.test.mutate()} disabled={m.test.isPending}>
                {t("Test")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="ml-auto !text-ev-error"
                onClick={() => confirm(t("Disconnect Jira? Links of projects stay, but nobody can send reports until it is connected again.")) && m.remove.mutate()}
              >
                {t("Disconnect")}
              </Button>
            </>
          )}
        </div>
        {s.configured && (
          <div className="space-y-1 border-t border-line-soft pt-3 text-[12px] text-faint">
            <p>{t("{n} people have added their personal Jira token.", { n: s.usersWithTokens })}</p>
            <p>
              {s.statusSyncAt
                ? t("Issue statuses (label bugstream) refreshed {when}; every 5 minutes.", { when: timeAgo(s.statusSyncAt) })
                : t("Issue statuses (label bugstream) are refreshed every 5 minutes.")}
            </p>
            {s.statusSyncError && <p className="text-ev-error">{t("Last status refresh failed: {error}", { error: s.statusSyncError })}</p>}
          </div>
        )}
      </form>
    </Card>
  );
}

function ProjectsCard() {
  const status = useJiraStatus();
  const m = useJiraAdmin();
  const s = status.data!;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "linked" | "unlinked">(s.linkedCount ? "all" : "unlinked");
  const list = useJiraProjects(q, filter);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<JiraConnectResult[] | null>(null);

  const selectable = (list.data ?? []).filter((p) => !p.linkedProjectId && !p.removedAt);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <Card
      title={t("Jira projects")}
      actions={
        <Button size="sm" onClick={() => m.sync.mutate()} disabled={m.sync.isPending}>
          {m.sync.isPending ? t("Syncing…") : t("Sync")}
        </Button>
      }
    >
      <div className="space-y-3 p-4">
        <p className="text-[13px] text-muted">
          {s.lastSyncAt
            ? t("Last sync {when}: {n} projects in Jira, {linked} linked.", { when: timeAgo(s.lastSyncAt), n: s.projectsCount, linked: s.linkedCount })
            : t("Press Sync to load the projects from Jira.")}
        </p>
        {s.lastSyncError && <ErrorBox>{s.lastSyncError}</ErrorBox>}
        {m.sync.error && <ErrorBox>{errorText(m.sync.error)}</ErrorBox>}
        {m.sync.data && <p className="text-[13px] text-ev-nav">{t("Loaded {n} projects, {added} new.", { n: m.sync.data.total, added: m.sync.data.added })}</p>}

        <div className="flex flex-wrap gap-2">
          <Input className="min-w-[200px] flex-1" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by key, name or Jira ID")} />
          <Select className="w-44" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="unlinked">{t("Not linked")}</option>
            <option value="linked">{t("Linked")}</option>
            <option value="all">{t("All")}</option>
          </Select>
        </div>

        <div className="overflow-hidden rounded-control border border-line-soft">
          {list.isLoading ? (
            <Loading />
          ) : (list.data?.length ?? 0) === 0 ? (
            <p className="p-5 text-center text-[13px] text-faint">{s.projectsCount ? t("Nothing found") : t("No projects loaded yet")}</p>
          ) : (
            <table className={cx("w-full text-left text-[13px]", list.isFetching && "opacity-70")}>
              <thead className="border-b border-line-soft bg-fog text-[12px] text-muted">
                <tr>
                  <th className="w-9 px-3 py-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={allSelected}
                      disabled={selectable.length === 0}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.id)))}
                      aria-label={t("Select all")}
                    />
                  </th>
                  <th className="px-3 py-2 font-medium">{t("Jira project")}</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">ID</th>
                  <th className="px-3 py-2 font-medium">{t("Bug Stream project")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {list.data?.map((p) => (
                  <tr key={p.id} className={cx(p.removedAt && "text-faint")}>
                    <td className="px-3 py-2">
                      {!p.linkedProjectId && !p.removedAt && (
                        <input type="checkbox" className="size-4 accent-primary" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={p.key} />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {p.avatarUrl && <img src={p.avatarUrl} alt="" className="size-5 rounded" referrerPolicy="no-referrer" />}
                        <span className="font-mono text-[12px] font-medium">{p.key}</span>
                        <span className="truncate">{p.name}</span>
                        {p.removedAt && <span className="text-[11px]">({t("removed in Jira")})</span>}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2 font-mono text-[12px] text-faint sm:table-cell">{p.id}</td>
                    <td className="px-3 py-2">
                      {p.linkedProjectId ? (
                        <Link to={`/projects/${p.linkedProjectId}`} className="text-primary hover:underline">
                          {p.linkedProjectKey}
                        </Link>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-control bg-primary-soft px-3 py-2">
            <span className="text-[13px]">{t("Selected: {n}", { n: selected.size })}</span>
            <Button
              size="sm"
              variant="primary"
              className="ml-auto"
              disabled={m.connect.isPending}
              onClick={() =>
                m.connect.mutate([...selected], {
                  onSuccess: (r) => {
                    setResults(r);
                    setSelected(new Set());
                  },
                })
              }
            >
              {t("Connect selected")}
            </Button>
          </div>
        )}
        <p className="text-[12px] text-faint">
          {t("Connecting creates a Bug Stream project with the same key (or links an existing one with that key). Add services and their addresses on the project page.")}
        </p>
        {m.connect.error && <ErrorBox>{errorText(m.connect.error)}</ErrorBox>}
        {results && (
          <ul className="space-y-1 rounded-control border border-ev-nav/30 bg-ev-nav-soft p-3 text-[13px]">
            {results.map((r) => (
              <li key={r.jiraKey}>
                <span className="font-mono">{r.jiraKey}</span> →{" "}
                <Link to={`/projects/${r.projectId}`} className="font-medium text-primary hover:underline">
                  {r.projectKey}
                </Link>{" "}
                <span className="text-muted">
                  {r.outcome === "CREATED" ? t("project created") : r.outcome === "LINKED" ? t("linked to the existing project") : t("already linked")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Issue type names found in the synced projects, most common first; "Other" allows any name. */
function DefaultTypePicker({ value, onChange, enabled }: { value: string; onChange: (v: string) => void; enabled: boolean }) {
  const usage = useIssueTypeUsage(enabled);
  const [custom, setCustom] = useState(false);
  const list = usage.data ?? [];
  const known = list.some((u) => u.name.toLowerCase() === value.toLowerCase());
  if (!enabled || custom || (list.length > 0 && !known && value !== "") || list.length === 0) {
    return (
      <div className="flex gap-1">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Bug" className="flex-1" />
        {list.length > 0 && (
          <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => (setCustom(false), onChange(list[0].name))} title={t("Pick from the list")}>
            ▾
          </Button>
        )}
      </div>
    );
  }
  return (
    <Select
      value={list.find((u) => u.name.toLowerCase() === value.toLowerCase())?.name ?? ""}
      onChange={(e) => (e.target.value === "__other" ? setCustom(true) : onChange(e.target.value))}
    >
      {list.map((u) => (
        <option key={u.name} value={u.name}>
          {u.linkedProjects > 0
            ? t("{name} — in {n} of the linked projects", { name: u.name, n: u.linkedProjects })
            : t("{name} — in {n} projects", { name: u.name, n: u.allProjects })}
        </option>
      ))}
      <option value="__other">{t("Other…")}</option>
    </Select>
  );
}

/** Linked projects: the issue type each will use; change one or many at once. */
function LinkedCard() {
  const [q, setQ] = useState("");
  const list = useJiraLinked(q);
  const bulk = useBulkIssueType();
  const refresh = useRefreshIssueTypes();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState("");
  const rows = list.data ?? [];
  const allNames = [...new Set(rows.flatMap((r) => r.issueTypes.map((x) => x.name)))].sort();
  const fallbacks = rows.filter((r) => r.effective.source === "BUG_LIKE" || r.effective.source === "FIRST" || r.effective.source === "NAME").length;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.projectId));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  return (
    <Card title={t("Issue types of linked projects")}>
      <div className="space-y-3 p-4">
        <p className="text-[13px] text-muted">
          {t("Each report becomes the project's own type, else the default type, else the bug type of that Jira project. You do not have to set every project.")}
        </p>
        {fallbacks > 0 && (
          <p className="text-[13px] text-ev-warn">{t("{n} projects do not have the default type — they use their own bug type or first type (shown below).", { n: fallbacks })}</p>
        )}
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search by key or name")} />
        <div className="max-h-[480px] overflow-auto rounded-control border border-line-soft">
          <table className={cx("w-full text-left text-[13px]", list.isFetching && "opacity-70")}>
            <thead className="sticky top-0 border-b border-line-soft bg-fog text-[12px] text-muted">
              <tr>
                <th className="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.projectId)))}
                    aria-label={t("Select all")}
                  />
                </th>
                <th className="px-3 py-2 font-medium">{t("Project")}</th>
                <th className="px-3 py-2 font-medium">{t("Issue type")}</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">{t("Reports become")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((r) => (
                <LinkedRow key={r.projectId} r={r} checked={selected.has(r.projectId)} onCheck={() => toggle(r.projectId)} onRefresh={() => refresh.mutate(r.jiraProjectId)} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-control bg-fog px-3 py-2">
          <span className="text-[13px]">{selected.size ? t("Selected: {n}", { n: selected.size }) : t("All linked projects")}</span>
          <Select className="w-52" value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
            <option value="">{t("Default")}</option>
            {allNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            disabled={bulk.isPending}
            onClick={() => {
              const ids = selected.size ? [...selected] : undefined;
              if (!ids && !confirm(t("Set this issue type for all linked projects?"))) return;
              bulk.mutate({ projectIds: ids, issueType: bulkType || null }, { onSuccess: () => setSelected(new Set()) });
            }}
          >
            {t("Apply")}
          </Button>
        </div>
        {bulk.data && <p className="text-[13px] text-ev-nav">{t("Updated: {n}", { n: bulk.data.updated })}</p>}
        {(bulk.error || refresh.error) && <ErrorBox>{errorText(bulk.error ?? refresh.error)}</ErrorBox>}
      </div>
    </Card>
  );
}

function LinkedRow({ r, checked, onCheck, onRefresh }: { r: JiraLinkedProject; checked: boolean; onCheck: () => void; onRefresh: () => void }) {
  const link = useLinkProjectJira(r.projectId);
  const warn = r.effective.source === "BUG_LIKE" || r.effective.source === "FIRST" || r.effective.source === "NAME";
  return (
    <tr>
      <td className="px-3 py-2">
        <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={onCheck} aria-label={r.projectKey} />
      </td>
      <td className="px-3 py-2">
        <Link to={`/projects/${r.projectId}`} className="font-mono text-[12px] font-medium text-primary hover:underline">
          {r.projectKey}
        </Link>{" "}
        <span className="text-muted">{r.projectName}</span>
      </td>
      <td className="px-3 py-2">
        {r.issueTypes.length > 0 ? (
          <Select
            className="h-8 w-40 text-[13px]"
            value={r.issueType ?? ""}
            disabled={link.isPending}
            onChange={(e) => link.mutate({ jiraProjectId: r.jiraProjectId, issueType: e.target.value || null })}
          >
            <option value="">{t("Default")}</option>
            {r.issueTypes.map((x) => (
              <option key={x.id} value={x.name}>
                {x.name}
              </option>
            ))}
            {r.issueType && !r.issueTypes.some((x) => x.name.toLowerCase() === r.issueType!.toLowerCase()) && (
              <option value={r.issueType}>{t("{name} (not in this project)", { name: r.issueType })}</option>
            )}
          </Select>
        ) : (
          <Button size="sm" onClick={onRefresh}>
            {t("Load types")}
          </Button>
        )}
      </td>
      <td className={cx("hidden px-3 py-2 md:table-cell", warn ? "text-ev-warn" : "text-muted")}>{r.effective.name}</td>
    </tr>
  );
}
