import { useEffect, useState } from "react";
import { errorText } from "../../api/client";
import { useActiveShares, useAdminSettings, useRevokeShare, useUpdateSettings } from "../../api/hooks";
import { Link } from "react-router";
import { timeAgo, formatDateTime } from "../../lib/format";
import type { AppSettings } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, ErrorBox, Field, Input, Loading, PageHeader, Toggle } from "../../components/ui";
import { t } from "../../i18n";

export function AdminSettingsPage() {
  const settings = useAdminSettings();
  const save = useUpdateSettings();
  const { can } = useAuth();
  const editable = can("settings.manage");
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  if (!draft) return <Loading />;
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setDraft({ ...draft, [k]: v });
    setSaved(false);
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings.data);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 md:px-6">
      <PageHeader title={t("Settings")} subtitle={t("Global settings for everyone. Server addresses and secrets stay in the .env file.")} />
      <Card title={t("Public links")}>
        <div className="space-y-4 p-4">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-medium">{t("Allow opening reports by link without signing in")}</span>
              <span className="block text-[13px] text-muted">
                {t("People with the \"Share reports\" permission can turn on a public link for a report. Turning this off disables all links at once.")}
              </span>
            </span>
            <Toggle checked={!!draft["sharing.enabled"]} disabled={!editable} onChange={(v) => set("sharing.enabled", v)} label={t("Public links")} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Default expiry, days")}>
              <Input type="number" min={1} max={365} value={draft["sharing.defaultDays"]} disabled={!editable} onChange={(e) => set("sharing.defaultDays", Number(e.target.value))} />
            </Field>
            <Field label={t("Longest allowed expiry, days")}>
              <Input type="number" min={1} max={3650} value={draft["sharing.maxDays"]} disabled={!editable} onChange={(e) => set("sharing.maxDays", Number(e.target.value))} />
            </Field>
          </div>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-medium">{t("Show request and response bodies on public links")}</span>
              <span className="block text-[13px] text-muted">{t("When off, the public page shows the network list and headers but not the bodies.")}</span>
            </span>
            <Toggle checked={!!draft["sharing.networkBodies"]} disabled={!editable} onChange={(v) => set("sharing.networkBodies", v)} label={t("Network bodies")} />
          </label>
        </div>
      </Card>
      {save.error && (
        <div className="mt-3">
          <ErrorBox>{errorText(save.error)}</ErrorBox>
        </div>
      )}
      {editable && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {saved && <span className="text-[13px] text-ev-nav">{t("Saved")}</span>}
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(settings.data!)}>
            {t("Discard")}
          </Button>
          <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(draft, { onSuccess: () => setSaved(true) })}>
            {t("Save")}
          </Button>
        </div>
      )}
      {editable && <ActiveShares />}
    </div>
  );
}

function ActiveShares() {
  const shares = useActiveShares();
  const revoke = useRevokeShare();
  return (
    <Card title={t("Active public links")} className="mt-6">
      {shares.isLoading ? (
        <Loading />
      ) : (shares.data?.length ?? 0) === 0 ? (
        <p className="p-4 text-[13px] text-faint">{t("No active public links.")}</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {shares.data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
              <Link to={`/reports/${s.reportId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {s.projectKey && <span className="mr-1.5 font-mono text-[12px] text-muted">{s.projectKey}</span>}
                {s.reportTitle}
              </Link>
              <span className="text-[12px] text-faint" title={formatDateTime(s.expiresAt)}>
                {s.createdByName} · {t("Opened {n} times", { n: s.views })} · {t("until {date}", { date: formatDateTime(s.expiresAt) })}
                {s.lastViewedAt && ` · ${t("last {when}", { when: timeAgo(s.lastViewedAt) })}`}
              </span>
              <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)} disabled={revoke.isPending}>
                {t("Turn off")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
