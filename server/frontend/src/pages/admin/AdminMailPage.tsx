import { useEffect, useState } from "react";
import { errorText } from "../../api/client";
import { useMailConfig, useMailMutations } from "../../api/hooks";
import type { MailRequest, MailStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, cx, ErrorBox, Field, Input, Loading, PageHeader, Select } from "../../components/ui";
import { t } from "../../i18n";

const PORTS: Record<MailRequest["security"], number> = { STARTTLS: 587, SSL: 465, NONE: 25 };

function fromStatus(s: MailStatus | undefined, fallbackFrom: string): MailRequest {
  return {
    host: s?.host ?? "",
    port: s?.port ?? 587,
    security: s?.security ?? "STARTTLS",
    username: s?.username ?? "",
    password: "",
    fromAddress: s?.fromAddress ?? fallbackFrom,
    fromName: s?.fromName ?? "Bug Stream",
  };
}

/**
 * Admin → E-mail (SMTP): your own mail server for sign-in codes, password reset and invitation links,
 * and notifications. Until it is set here, SMTP_* from .env are used.
 */
export function AdminMailPage() {
  const cfg = useMailConfig();
  const m = useMailMutations();
  const { user, can } = useAuth();
  const editable = can("settings.manage");
  const [form, setForm] = useState<MailRequest>(fromStatus(undefined, ""));
  const [to, setTo] = useState("");
  useEffect(() => setForm(fromStatus(cfg.data, "")), [cfg.data]);
  if (cfg.isLoading) return <Loading />;
  if (cfg.error) return <div className="p-6"><ErrorBox>{errorText(cfg.error)}</ErrorBox></div>;
  const s = cfg.data!;
  const f = (k: "host" | "username" | "password" | "fromAddress" | "fromName") => ({
    value: form[k],
    disabled: !editable,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });
  const r = m.test.data;

  return (
    <div className="mx-auto max-w-[760px] space-y-4 px-4 py-6 md:px-6">
      <PageHeader
        title={t("E-mail (SMTP)")}
        subtitle={t("Your mail server sends sign-in codes, password reset and invitation links, and notifications.")}
      />
      <Card
        title={t("SMTP server")}
        actions={
          <span className={cx("text-[12px]", s.configured ? "text-ev-nav" : "text-faint")}>
            {s.source === "DB" ? `● ${t("set here")}` : s.source === "ENV" ? `● ${t("from .env")}` : `○ ${t("not configured")}`}
          </span>
        }
      >
        <form
          className="space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.save.mutate(form, { onSuccess: () => setForm((x) => ({ ...x, password: "" })) });
          }}
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_150px]">
            <Field label={t("Server")}>
              <Input {...f("host")} required className="font-mono" placeholder="smtp.example.com" />
            </Field>
            <Field label={t("Port")}>
              <Input
                type="number"
                min={1}
                max={65535}
                value={form.port}
                disabled={!editable}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                required
                className="font-mono"
              />
            </Field>
            <Field label={t("Encryption")}>
              <Select
                value={form.security}
                disabled={!editable}
                onChange={(e) => {
                  const security = e.target.value as MailRequest["security"];
                  setForm({ ...form, security, port: Object.values(PORTS).includes(form.port) ? PORTS[security] : form.port });
                }}
              >
                <option value="STARTTLS">STARTTLS</option>
                <option value="SSL">SSL / TLS</option>
                <option value="NONE">{t("None")}</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("User name")} hint={t("Empty — the server does not require sign-in")}>
              <Input {...f("username")} autoComplete="off" className="font-mono" />
            </Field>
            <Field label={t("Password")} hint={s.passwordSet ? t("Leave empty to keep the saved password.") : undefined}>
              <Input {...f("password")} type="password" autoComplete="new-password" />
            </Field>
            <Field label={t("Sender address")}>
              <Input {...f("fromAddress")} type="email" required className="font-mono" placeholder="bugstream@example.com" />
            </Field>
            <Field label={t("Sender name")}>
              <Input {...f("fromName")} placeholder="Bug Stream" />
            </Field>
          </div>
          {form.security === "NONE" && <p className="text-[13px] text-ev-warn">{t("Without encryption the password and e-mails travel in clear text — use it only inside a trusted network.")}</p>}
          {m.save.error && <ErrorBox>{errorText(m.save.error)}</ErrorBox>}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={m.save.isPending}>
                {t("Save")}
              </Button>
              {s.source === "DB" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => confirm(t("Remove the SMTP settings saved here? The values from .env will be used, if any.")) && m.reset.mutate()}
                >
                  {t("Reset to .env")}
                </Button>
              )}
            </div>
          )}
        </form>
      </Card>
      {s.configured && editable && (
        <Card title={t("Test e-mail")}>
          <form
            className="space-y-2 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.test.mutate(to);
            }}
          >
            <div className="flex flex-wrap gap-2">
              <Input type="email" className="min-w-[220px] flex-1" value={to} onChange={(e) => setTo(e.target.value)} placeholder={user?.email} />
              <Button type="submit" disabled={m.test.isPending}>
                {m.test.isPending ? t("Sending…") : t("Send test e-mail")}
              </Button>
            </div>
            <p className="text-[12px] text-faint">{t("Uses the saved settings.")}</p>
            {m.test.error && <ErrorBox>{errorText(m.test.error)}</ErrorBox>}
            {r && (
              <p className={cx("rounded-control border px-3 py-2 text-[13px]", r.ok ? "border-ev-nav/30 bg-ev-nav-soft" : "border-ev-error/30 bg-ev-error-soft")}>
                {r.ok ? t("Sent to {email}", { email: to || user?.email }) : t("Not sent: {error}", { error: r.message })}
              </p>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
