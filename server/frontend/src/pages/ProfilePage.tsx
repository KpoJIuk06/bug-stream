import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { errorText } from "../api/client";
import { useChangePassword, useMyJira, useMyJiraMutations, useNotificationPrefs, useUpdateNotificationPrefs } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitch } from "../components/Layout";
import { Avatar, Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Toggle } from "../components/ui";
import { t } from "../i18n";
import { formatDateTime } from "../lib/format";
import { AUTH_SOURCE_LABEL } from "../lib/labels";

const TOKEN_HELP = "https://id.atlassian.com/manage-profile/security/api-tokens";

export function ProfilePage() {
  const { user } = useAuth();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
  }, [hash]);
  if (!user) return <Loading />;
  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 py-6 md:px-6">
      <PageHeader title={t("My profile")} />
      <Card>
        <div className="flex items-center gap-4 p-4">
          <Avatar name={user.fullName} size={48} />
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{user.fullName}</p>
            <p className="text-[13px] text-muted">
              {user.email} · {user.roleName ?? user.role} · {AUTH_SOURCE_LABEL[user.authSource]}
            </p>
          </div>
        </div>
      </Card>
      <Card title={t("Language")}>
        <div className="max-w-[260px] p-4">
          <LanguageSwitch compact />
        </div>
      </Card>
      <JiraCard />
      <NotificationsCard />
      {user.authSource === "LOCAL" && <PasswordCard />}
    </div>
  );
}

function JiraCard() {
  const my = useMyJira();
  const m = useMyJiraMutations();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [editing, setEditing] = useState(false);
  if (!my.data) return null;
  const d = my.data;
  const showForm = editing || !d.connected || d.invalid;

  return (
    <Card title={t("Jira")} actions={<span id="jira" />}>
      <div className="space-y-3 p-4">
        {!d.configured ? (
          <p className="text-[13px] text-muted">{t("Jira is not connected yet — an administrator connects it in Administration → Jira.")}</p>
        ) : (
          <>
            <p className="text-[13px] text-muted">
              {t("Reports are sent to Jira on your behalf: the issue reporter is your Jira account. Add a personal API token once — it is stored encrypted and is never shown again.")}
            </p>
            {d.connected && !d.invalid && !editing && (
              <div className="flex flex-wrap items-center gap-3 rounded-control border border-ev-nav/30 bg-ev-nav-soft px-3 py-2 text-[13px]">
                <span>
                  ● {t("Connected as {name}", { name: d.displayName ?? d.email ?? "" })} <span className="text-muted">({d.email})</span>
                  {d.verifiedAt && <span className="block text-[12px] text-faint">{t("Checked {when}", { when: formatDateTime(d.verifiedAt) })}</span>}
                </span>
                <span className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => (setEditing(true), setEmail(d.email ?? ""))}>
                    {t("Replace token")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => confirm(t("Remove your Jira token?")) && m.remove.mutate()}>
                    {t("Remove")}
                  </Button>
                </span>
              </div>
            )}
            {d.invalid && <ErrorBox>{t("Jira rejected your API token (expired or revoked). Enter a new one.")}</ErrorBox>}
            {showForm && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  m.save.mutate({ email, token }, { onSuccess: () => (setToken(""), setEditing(false)) });
                }}
              >
                <Field label={t("Atlassian account e-mail")}>
                  <Input type="email" value={email || (d.email ?? user?.email ?? "")} onChange={(e) => setEmail(e.target.value)} required />
                </Field>
                <Field label={t("API token")}>
                  <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" />
                </Field>
                <ol className="list-decimal space-y-0.5 pl-5 text-[12.5px] text-muted">
                  <li>
                    {t("Open")}{" "}
                    <a href={TOKEN_HELP} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      id.atlassian.com → Security → API tokens
                    </a>
                  </li>
                  <li>{t("Create API token, name it \"Bug Stream\", choose an expiry")}</li>
                  <li>{t("Copy the token and paste it here")}</li>
                </ol>
                {m.save.error && <ErrorBox>{errorText(m.save.error)}</ErrorBox>}
                <div className="flex gap-2">
                  <Button type="submit" variant="primary" disabled={m.save.isPending}>
                    {m.save.isPending ? t("Checking…") : t("Save and check")}
                  </Button>
                  {editing && (
                    <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                      {t("Cancel")}
                    </Button>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function NotificationsCard() {
  const prefs = useNotificationPrefs(true);
  const update = useUpdateNotificationPrefs();
  if (!prefs.data) return null;
  const p = prefs.data;
  return (
    <Card title={t("Notifications")}>
      <div className="divide-y divide-line-soft">
        <label className="flex items-start justify-between gap-4 p-4">
          <span>
            <span className="block font-medium">{t("Send by e-mail")}</span>
            <span className="block text-[13px] text-muted">
              {p.emailConfigured ? t("The same notifications by e-mail.") : t("E-mail is not configured on the server yet (SMTP in .env) — notifications only on the site.")}
            </span>
          </span>
          <Toggle checked={p.emailNotifications} disabled={update.isPending} onChange={(v) => update.mutate({ emailNotifications: v })} label={t("Send by e-mail")} />
        </label>
        <label className="flex items-start justify-between gap-4 p-4">
          <span>
            <span className="block font-medium">{t("Send to Slack")}</span>
            <span className="block text-[13px] text-muted">
              {p.slackConfigured
                ? t("Direct messages from the Bug Stream bot; your Slack account is found by your e-mail.")
                : t("Slack is not connected yet — an administrator connects it in Administration → Slack.")}
            </span>
          </span>
          <Toggle checked={p.slackNotifications} disabled={update.isPending || !p.slackConfigured} onChange={(v) => update.mutate({ slackNotifications: v })} label={t("Send to Slack")} />
        </label>
      </div>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const { logout, user } = useAuth();
  const hasPassword = user?.passwordSet !== false;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <Card title={hasPassword ? t("Change password") : t("Set a password")}>
      <form
        className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate({ currentPassword: hasPassword ? current : undefined, newPassword: next }, { onSuccess: () => logout() });
        }}
      >
        {hasPassword ? (
          <Field label={t("Current password")}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
        ) : (
          <p className="text-[13px] text-muted">{t("You sign in with an e-mail code. A password lets you sign in without it.")}</p>
        )}
        <Field label={t("New password")}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
        </Field>
        <Button type="submit" variant="primary" disabled={change.isPending}>
          {hasPassword ? t("Change password") : t("Set password")}
        </Button>
        {change.error && (
          <div className="sm:col-span-3">
            <ErrorBox>{errorText(change.error)}</ErrorBox>
          </div>
        )}
      </form>
    </Card>
  );
}
