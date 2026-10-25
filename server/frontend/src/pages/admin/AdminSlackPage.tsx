import { useState } from "react";
import { errorText } from "../../api/client";
import { useSlackAdmin, useSlackStatus } from "../../api/hooks";
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader } from "../../components/ui";
import { t } from "../../i18n";

/** Admin → Slack: a bot posts new reports to channels and sends personal notifications as direct messages. */
export function AdminSlackPage() {
  const status = useSlackStatus();
  const m = useSlackAdmin();
  const [token, setToken] = useState("");
  const [channel, setChannel] = useState<string | null>(null);
  const [testChannel, setTestChannel] = useState("");
  if (status.isLoading) return <Loading />;
  const s = status.data!;
  const ch = channel ?? s.defaultChannel ?? "";

  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 py-6 md:px-6">
      <PageHeader
        title={t("Slack")}
        subtitle={t("A Slack bot posts new reports to a channel and sends mentions, assignments and replies as direct messages.")}
      />
      <Card
        title={t("Connection")}
        actions={s.configured ? <span className="text-[12px] text-ev-nav">● {s.teamName}</span> : <span className="text-[12px] text-faint">○ {t("not connected")}</span>}
      >
        <form
          className="space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.save.mutate({ botToken: token || undefined, defaultChannel: ch }, { onSuccess: () => setToken("") });
          }}
        >
          <Field label={t("Bot token")} hint={s.configured ? t("Leave empty to keep the saved token.") : "xoxb-…"}>
            <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} required={!s.configured} autoComplete="off" className="font-mono" />
          </Field>
          <Field label={t("Default channel for new reports")} hint={t("Channel ID (C0123ABC). Projects can have their own channel. Empty — no channel posts.")}>
            <Input value={ch} onChange={(e) => setChannel(e.target.value)} className="font-mono" placeholder="C0123ABC" />
          </Field>
          {m.save.error && <ErrorBox>{errorText(m.save.error)}</ErrorBox>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={m.save.isPending}>
              {m.save.isPending ? t("Checking…") : s.configured ? t("Save") : t("Connect")}
            </Button>
            {s.configured && (
              <Button type="button" variant="ghost" className="ml-auto !text-ev-error" onClick={() => confirm(t("Disconnect Slack?")) && m.remove.mutate()}>
                {t("Disconnect")}
              </Button>
            )}
          </div>
        </form>
      </Card>
      {s.configured && (
        <Card title={t("Test message")}>
          <form
            className="flex flex-wrap gap-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.test.mutate(testChannel || undefined);
            }}
          >
            <Input className="min-w-[200px] flex-1 font-mono" value={testChannel} onChange={(e) => setTestChannel(e.target.value)} placeholder={ch || "C0123ABC"} />
            <Button type="submit" disabled={m.test.isPending}>
              {t("Send test")}
            </Button>
            {m.test.isSuccess && <p className="w-full text-[13px] text-ev-nav">{t("Sent — check the channel.")}</p>}
            {m.test.error && (
              <div className="w-full">
                <ErrorBox>{errorText(m.test.error)}</ErrorBox>
              </div>
            )}
          </form>
        </Card>
      )}
      <Card title={t("How to create the Slack app")}>
        <ol className="list-decimal space-y-1 p-4 pl-9 text-[13px] text-muted">
          <li>{t("api.slack.com/apps → Create New App → From scratch, choose your workspace.")}</li>
          <li>{t("OAuth & Permissions → Bot Token Scopes: chat:write, users:read, users:read.email.")}</li>
          <li>{t("Install to Workspace and copy the Bot User OAuth Token (xoxb-…).")}</li>
          <li>{t("Invite the bot to the channels it posts to: /invite @YourBot.")}</li>
          <li>{t("If the server reaches the internet through a proxy, set JAVA_OPTS in .env.")}</li>
        </ol>
      </Card>
    </div>
  );
}
