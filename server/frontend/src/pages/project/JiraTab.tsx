import { useState } from "react";
import { Link } from "react-router";
import { errorText } from "../../api/client";
import { useJiraPickerProjects, useLinkProjectJira, useMyJira, useNotificationPrefs, useProjectJira, useProjectSlack, useRefreshIssueTypes, useSetProjectSlack } from "../../api/hooks";
import { Input } from "../../components/ui";
import type { IssueTypeChoice, ProjectDetails } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Combobox } from "../../components/Combobox";
import { Button, ErrorBox, Field, Select } from "../../components/ui";
import { t } from "../../i18n";

/** Jira project and Slack channel of this project. */
export function JiraTab({ d }: { d: ProjectDetails }) {
  return (
    <div className="space-y-8">
      <JiraSection d={d} />
      <SlackSection d={d} />
    </div>
  );
}

function SlackSection({ d }: { d: ProjectDetails }) {
  const prefs = useNotificationPrefs(true);
  const slack = useProjectSlack(d.project.id);
  const save = useSetProjectSlack(d.project.id);
  const [channel, setChannel] = useState<string | null>(null);
  if (!prefs.data?.slackConfigured) return null;
  const value = channel ?? slack.data?.channel ?? "";
  return (
    <div className="max-w-[640px] space-y-3">
      <h3 className="text-[15px] font-semibold">Slack</h3>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(value);
        }}
      >
        <div className="min-w-[240px] flex-1">
          <Field label={t("Channel for new reports")} hint={t("Channel ID (C0123ABC). Empty — the default channel from Administration → Slack.")}>
            <Input className="font-mono" value={value} disabled={!d.canManage} onChange={(e) => setChannel(e.target.value)} placeholder="C0123ABC" />
          </Field>
        </div>
        {d.canManage && (
          <Button type="submit" disabled={save.isPending}>
            {t("Save")}
          </Button>
        )}
      </form>
      {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
      {save.isSuccess && <p className="text-[13px] text-ev-nav">{t("Saved")}</p>}
    </div>
  );
}

const SOURCE_TEXT: Record<string, string> = {
  PROJECT: "chosen for this project",
  DEFAULT: "the default from Administration → Jira",
  BUG_LIKE: "the bug type of this Jira project (the chosen or default type does not exist here)",
  FIRST: "the first standard type of this Jira project (no bug type here)",
  NAME: "issue types unknown — press Refresh",
  REQUESTED: "chosen when sending",
};

/** Explains which issue type reports of a project become, and why. */
export function EffectiveType({ choice }: { choice: IssueTypeChoice }) {
  return (
    <span>
      <b>{choice.name}</b> <span className="text-faint">— {t(SOURCE_TEXT[choice.source] ?? choice.source)}</span>
    </span>
  );
}

function JiraSection({ d }: { d: ProjectDetails }) {
  const { can } = useAuth();
  const my = useMyJira();
  const editable = d.canManage || can("integration.manage");
  const [q, setQ] = useState("");
  const jira = useJiraPickerProjects(q, !!my.data?.configured);
  const pj = useProjectJira(d.project.id);
  const link = useLinkProjectJira(d.project.id);
  const refresh = useRefreshIssueTypes();
  const [jiraId, setJiraId] = useState<string | undefined>(d.project.jiraProjectId ?? undefined);
  const [issueType, setIssueType] = useState<string | null>(null);

  if (my.data && !my.data.configured) {
    return (
      <p className="max-w-[640px] text-[13px] text-muted">
        {t("Jira is not connected yet — an administrator connects it in Administration → Jira.")}
        {can("integration.manage") && (
          <>
            {" "}
            <Link to="/admin/jira" className="text-primary hover:underline">
              {t("Open")}
            </Link>
          </>
        )}
      </p>
    );
  }

  const options = (jira.data ?? [])
    .filter((p) => !p.removedAt && (!p.linkedProjectId || p.linkedProjectId === d.project.id))
    .map((p) => ({ value: p.id, label: `${p.key} — ${p.name}`, hint: p.id }));
  const sameProject = jiraId === pj.data?.jiraProjectId;
  const chosen = jira.data?.find((p) => p.id === jiraId);
  const types = (sameProject ? pj.data?.issueTypes : chosen?.issueTypes.filter((x) => !x.subtask && (x.level == null || x.level === 0))) ?? [];
  const current = issueType ?? (sameProject ? pj.data?.issueType ?? "" : "");
  const unknownSaved = !!current && !types.some((x) => x.name.toLowerCase() === current.toLowerCase());

  return (
    <div className="max-w-[640px] space-y-4">
      <h3 className="text-[15px] font-semibold">Jira</h3>
      <div className="space-y-1 rounded-panel border border-line bg-surface px-4 py-3 text-[13px]">
        {d.project.jiraProjectKey ? (
          <>
            <p>
              {t("Reports of this project are sent to Jira project")} <b className="font-mono">{d.project.jiraProjectKey}</b>
              {pj.data?.jiraProjectName && <span className="text-muted"> — {pj.data.jiraProjectName}</span>}.
            </p>
            {pj.data?.effective && (
              <p className="text-muted">
                {t("Issue type:")} <EffectiveType choice={pj.data.effective} />
              </p>
            )}
          </>
        ) : (
          <p className="text-muted">{t("Not linked to Jira — reports of this project cannot be sent to Jira.")}</p>
        )}
      </div>
      {editable && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            link.mutate({ jiraProjectId: jiraId ?? null, issueType: current || null }, { onSuccess: () => setIssueType(null) });
          }}
        >
          <Field label={t("Jira project")}>
            <Combobox
              value={jiraId}
              onChange={(v) => {
                setJiraId(v);
                setIssueType("");
              }}
              options={options}
              selectedLabel={d.project.jiraProjectKey ?? undefined}
              emptyLabel={t("Not linked")}
              onQuery={setQ}
              loading={jira.isFetching}
              placeholder={t("Key, name or Jira ID")}
            />
          </Field>
          {jiraId && (
            <Field
              label={t("Issue type")}
              hint={t("Loaded from Jira. “Default” follows Administration → Jira ({type}); if that type does not exist in this project, the bug type of the project is used.", {
                type: pj.data?.defaultIssueType ?? "Bug",
              })}
            >
              <div className="flex gap-2">
                <Select value={current} onChange={(e) => setIssueType(e.target.value)} className="flex-1">
                  <option value="">{t("Default")}</option>
                  {types.map((x) => (
                    <option key={x.id} value={x.name}>
                      {x.name}
                    </option>
                  ))}
                  {unknownSaved && <option value={current}>{t("{name} (not in this project)", { name: current })}</option>}
                </Select>
                <Button type="button" onClick={() => refresh.mutate(jiraId)} disabled={refresh.isPending} title={t("Reload the issue types from Jira")}>
                  {refresh.isPending ? t("Loading…") : t("Refresh")}
                </Button>
              </div>
            </Field>
          )}
          {refresh.error && <ErrorBox>{errorText(refresh.error)}</ErrorBox>}
          {link.error && <ErrorBox>{errorText(link.error)}</ErrorBox>}
          {link.isSuccess && <p className="text-[13px] text-ev-nav">{t("Saved")}</p>}
          <Button type="submit" variant="primary" disabled={link.isPending}>
            {t("Save")}
          </Button>
        </form>
      )}
    </div>
  );
}
