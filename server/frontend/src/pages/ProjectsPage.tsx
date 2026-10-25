import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { errorText } from "../api/client";
import { useCreateProject, useProjects } from "../api/hooks";
import { Button, cx, Empty, ErrorBox, Field, Input, Loading, Modal, Textarea } from "../components/ui";
import { MEMBER_ROLE_LABEL } from "../lib/labels";
import { useAuth } from "../auth/AuthContext";
import { t } from "../i18n";

export function ProjectsPage() {
  const { can } = useAuth();
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState("");
  const projects = useProjects(q, archived);
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{t("Projects")}</h1>
          <p className="text-muted">{t("A project groups services. From the service addresses the extension knows which project a report belongs to.")}</p>
        </div>
        {can("project.create") && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t("New project")}
          </Button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" type="search" placeholder={t("Search by key, name or Jira ID")} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="size-4 accent-primary" />
          {t("Show archived")}
        </label>
      </div>

      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {projects.isLoading ? (
          <Loading />
        ) : projects.error ? (
          <div className="p-4">
            <ErrorBox>{errorText(projects.error)}</ErrorBox>
          </div>
        ) : projects.data?.length === 0 ? (
          <Empty title={q ? t("Nothing found") : t("No projects yet")}>
            {!q && t("Create a project and add services with their addresses — reports will be linked to it automatically.")}
          </Empty>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-line text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("Project")}</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t("Services")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Reports")}</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t("Members")}</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("Your role")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {projects.data?.map((p) => (
                <tr key={p.id} className={cx("hover:bg-fog/70", p.archivedAt && "text-faint")}>
                  <td className="px-4 py-3">
                    <Link to={`/projects/${p.id}`} className="group flex items-start gap-3">
                      <span className="mt-0.5 rounded-[5px] bg-ink px-1.5 py-0.5 font-mono text-[11px] font-medium text-white">{p.key}</span>
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:underline">
                          {p.name}
                          {p.archivedAt && <span className="ml-2 text-[12px] font-normal">{t("archived")}</span>}
                          {p.jiraProjectKey && <span className="ml-2 rounded bg-ev-network-soft px-1.5 py-px text-[11px] font-normal text-ev-network">Jira {p.jiraProjectKey}</span>}
                        </span>
                        {p.description && <span className="block max-w-[60ch] truncate text-[13px] text-muted">{p.description}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">{p.servicesCount}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <Link to={`/reports?project=${p.id}`} className="text-primary hover:underline">
                      {p.reportsCount}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums md:table-cell">{p.membersCount}</td>
                  <td className="hidden px-4 py-3 text-[13px] text-muted sm:table-cell">{p.myRole ? MEMBER_ROLE_LABEL[p.myRole] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateProjectModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function CreateProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateProject();
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={t("New project")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            { key, name, description },
            {
              onSuccess: (d) => {
                onClose();
                navigate(`/projects/${d.project.id}`);
              },
            },
          );
        }}
      >
        <Field label={t("Name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="E-Social" />
        </Field>
        <Field label={t("Key")} hint={t("Short code for lists: Latin capital letters, digits and _. Cannot be changed later.")}>
          <Input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            required
            pattern="[A-Z][A-Z0-9_]{1,19}"
            maxLength={20}
            placeholder="ESOC"
            className="font-mono"
          />
        </Field>
        <Field label={t("Description")}>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {create.error && <ErrorBox>{errorText(create.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t("Create project")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
