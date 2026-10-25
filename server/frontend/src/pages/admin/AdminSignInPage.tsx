import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { errorText } from "../../api/client";
import { useAuthAdmin, useAuthAdminMutations, useLdapConfig, useLdapTest, useRoles } from "../../api/hooks";
import type { AuthAdminView, LdapRequest, LdapStatus } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, Card, cx, ErrorBox, Field, Input, Loading, PageHeader, Select, Textarea, Toggle } from "../../components/ui";
import { t } from "../../i18n";

type Settings = AuthAdminView["settings"];

/**
 * Admin → Sign-in methods. Each method can be switched on when what it needs is configured:
 * password (always), AD / LDAP (a directory), e-mail code and password reset (SMTP — Admin → E-mail).
 */
export function AdminSignInPage() {
  const view = useAuthAdmin();
  const m = useAuthAdminMutations();
  const { can } = useAuth();
  const editable = can("settings.manage");
  if (view.isLoading) return <Loading />;
  if (view.error) return <div className="p-6"><ErrorBox>{errorText(view.error)}</ErrorBox></div>;
  const v = view.data!;
  const s = v.settings;
  const set = (patch: Partial<Settings>) => m.update.mutate(patch);

  return (
    <div className="mx-auto max-w-[820px] space-y-4 px-4 py-6 md:px-6">
      <PageHeader
        title={t("Sign-in methods")}
        subtitle={t("Choose how people sign in. The sign-in page and the extension show only the methods that are on.")}
      />
      {m.update.error && <ErrorBox>{errorText(m.update.error)}</ErrorBox>}

      <Method
        title={t("Password")}
        description={t("Local accounts created by an administrator or by invitation. Administrators can always sign in with their local password, even when this method is off.")}
        on={s["auth.password.enabled"]}
        available
        editable={editable}
        onChange={(on) => set({ "auth.password.enabled": on })}
      >
        <SubToggle
          label={t("“Forgot password?” by e-mail")}
          hint={v.mailConfigured ? t("A link to set a new password, valid for 1 hour.") : undefined}
          need={!v.mailConfigured ? <NeedMail /> : undefined}
          checked={s["auth.password.reset"]}
          disabled={!editable || !s["auth.password.enabled"]}
          onChange={(on) => set({ "auth.password.reset": on })}
        />
      </Method>

      <Method
        title={t("Active Directory / LDAP")}
        description={t("People sign in with their domain login and password; the account is created on the first sign-in.")}
        on={s["auth.ldap.enabled"]}
        available={v.ldapConfigured}
        need={!v.ldapConfigured ? <span>{t("Configure the directory below.")}</span> : undefined}
        editable={editable}
        onChange={(on) => set({ "auth.ldap.enabled": on })}
      />

      <Method
        title={t("One-time code by e-mail")}
        description={t("The person enters their e-mail and gets a 6-digit code (valid 10 minutes, 5 attempts). No password to remember.")}
        on={s["auth.emailCode.enabled"]}
        available={v.mailConfigured}
        need={!v.mailConfigured ? <NeedMail /> : undefined}
        editable={editable}
        onChange={(on) => set({ "auth.emailCode.enabled": on })}
      >
        <EmailCodeOptions s={s} editable={editable && s["auth.emailCode.enabled"]} onSave={set} />
      </Method>

      <LdapCard editable={editable} />

      <p className="px-1 text-[12px] text-faint">
        {t("Single sign-on (Keycloak, Azure AD / Entra ID via OpenID Connect) can be added as another method later.")}
      </p>
    </div>
  );
}

function NeedMail() {
  return (
    <span>
      {t("Needs an SMTP server —")}{" "}
      <Link to="/admin/email" className="text-primary hover:underline">
        {t("set it up")}
      </Link>
    </span>
  );
}

function Method({
  title,
  description,
  on,
  available,
  need,
  editable,
  onChange,
  children,
}: {
  title: string;
  description: string;
  on: boolean;
  available: boolean;
  need?: ReactNode;
  editable: boolean;
  onChange: (on: boolean) => void;
  children?: ReactNode;
}) {
  const effective = on && available;
  return (
    <Card>
      <div className="flex items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                effective ? "bg-ev-nav-soft text-ev-nav" : "bg-fog text-muted",
              )}
            >
              {effective ? t("On") : on && !available ? t("Not configured") : t("Off")}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-muted">{description}</p>
          {need && <p className="mt-1 text-[13px] text-ev-warn">{need}</p>}
        </div>
        <Toggle checked={on} onChange={onChange} disabled={!editable || (!available && !on)} label={title} />
      </div>
      {children && <div className="border-t border-line-soft px-4 py-3">{children}</div>}
    </Card>
  );
}

function SubToggle({
  label,
  hint,
  need,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  need?: ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 text-[13px]">
        <p className="font-medium">{label}</p>
        {hint && <p className="text-faint">{hint}</p>}
        {need && <p className="text-ev-warn">{need}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

function EmailCodeOptions({ s, editable, onSave }: { s: Settings; editable: boolean; onSave: (p: Partial<Settings>) => void }) {
  const roles = useRoles();
  const [domains, setDomains] = useState(s["auth.emailCode.domains"].join("\n"));
  useEffect(() => setDomains(s["auth.emailCode.domains"].join("\n")), [s]);
  const list = domains
    .split(/[\s,;]+/)
    .map((d) => d.trim())
    .filter(Boolean);
  const changed = list.join(",") !== s["auth.emailCode.domains"].join(",");
  return (
    <div className="space-y-3">
      <Field
        label={t("Allowed e-mail domains")}
        hint={t("One per line, e.g. example.com (subdomains included). Empty — any address of an existing user.")}
      >
        <Textarea rows={3} value={domains} onChange={(e) => setDomains(e.target.value)} disabled={!editable} className="font-mono" placeholder="example.com" />
      </Field>
      {changed && editable && (
        <Button size="sm" variant="primary" onClick={() => onSave({ "auth.emailCode.domains": list })}>
          {t("Save domains")}
        </Button>
      )}
      <SubToggle
        label={t("Create an account on the first sign-in")}
        hint={t("Anyone with an address from the allowed domains gets an account with the role below. Off — only existing users.")}
        checked={s["auth.emailCode.autoCreate"]}
        disabled={!editable}
        onChange={(v) => onSave({ "auth.emailCode.autoCreate": v })}
      />
      {s["auth.emailCode.autoCreate"] && s["auth.emailCode.domains"].length === 0 && (
        <p className="text-[13px] text-ev-warn">{t("Set the allowed domains — otherwise any e-mail address could create an account.")}</p>
      )}
      {s["auth.emailCode.autoCreate"] && (
        <Field label={t("Role of new accounts")}>
          <Select
            className="w-64"
            value={s["auth.emailCode.defaultRole"]}
            disabled={!editable}
            onChange={(e) => onSave({ "auth.emailCode.defaultRole": e.target.value })}
          >
            {roles.data?.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </div>
  );
}

const EMPTY_LDAP: LdapRequest = {
  url: "",
  baseDn: "",
  bindDn: "",
  bindPassword: "",
  userFilter: "",
  emailAttribute: "",
  nameAttribute: "",
  usernameAttribute: "",
  groupRoles: "",
  defaultRole: "",
};

function fromStatus(s: LdapStatus | undefined): LdapRequest {
  if (!s || !s.configured) return EMPTY_LDAP;
  return {
    url: s.url ?? "",
    baseDn: s.baseDn ?? "",
    bindDn: s.bindDn ?? "",
    bindPassword: "",
    userFilter: s.userFilter ?? "",
    emailAttribute: s.emailAttribute ?? "",
    nameAttribute: s.nameAttribute ?? "",
    usernameAttribute: s.usernameAttribute ?? "",
    groupRoles: (s.groupRoles ?? "").split(";").join("\n"),
    defaultRole: s.defaultRole ?? "",
  };
}

/** Group mapping is edited one per line and stored as "group=ROLE;group=ROLE". */
function normalized(f: LdapRequest): LdapRequest {
  return { ...f, groupRoles: f.groupRoles.split(/[\n;]+/).map((x) => x.trim()).filter(Boolean).join(";") };
}

function LdapCard({ editable }: { editable: boolean }) {
  const cfg = useLdapConfig();
  const m = useAuthAdminMutations();
  const test = useLdapTest();
  const roles = useRoles();
  const [form, setForm] = useState<LdapRequest>(EMPTY_LDAP);
  const [login, setLogin] = useState("");
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => setForm(fromStatus(cfg.data)), [cfg.data]);
  if (cfg.isLoading) return <Loading />;
  const s = cfg.data!;
  const f = (k: keyof LdapRequest) => ({
    value: form[k],
    disabled: !editable,
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });
  const r = test.data;

  return (
    <Card
      title={t("Directory connection (AD / LDAP)")}
      actions={
        <span className="text-[12px] text-faint">
          {s.source === "DB" ? t("set here") : s.source === "ENV" ? t("from .env") : t("not configured")}
        </span>
      }
    >
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.saveLdap.mutate(normalized(form), { onSuccess: () => setForm((x) => ({ ...x, bindPassword: "" })) });
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("Server")} hint={t("ldaps://dc1.example.com:636 — several separated by spaces")}>
            <Input {...f("url")} required className="font-mono" placeholder="ldaps://dc1.example.com:636" />
          </Field>
          <Field label={t("Base DN")} hint={t("Where users are searched")}>
            <Input {...f("baseDn")} required className="font-mono" placeholder="DC=example,DC=com" />
          </Field>
          <Field label={t("Service account (bind DN)")} hint={t("Read-only account that searches users")}>
            <Input {...f("bindDn")} className="font-mono" placeholder="CN=svc-bugstream,OU=Service Accounts,DC=example,DC=com" />
          </Field>
          <Field label={t("Service account password")} hint={s.bindPasswordSet ? t("Leave empty to keep the saved password.") : undefined}>
            <Input {...f("bindPassword")} type="password" autoComplete="off" />
          </Field>
        </div>
        <Field
          label={t("Roles from AD groups")}
          hint={t("One per line: group DN=ROLE. The role follows the groups on every sign-in, and people outside these groups cannot sign in. Empty — roles are set in Users.")}
        >
          <Textarea
            rows={3}
            {...f("groupRoles")}
            className="font-mono text-[12px]"
            placeholder="CN=BugStream-QA,OU=Groups,DC=example,DC=com=TESTER"
          />
        </Field>
        <Field label={t("Role of new users")} hint={t("When no group mapping is set")}>
          <Select className="w-64" {...f("defaultRole")}>
            <option value="">{t("Developer (default)")}</option>
            {roles.data?.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <button type="button" className="text-[13px] text-primary hover:underline" onClick={() => setAdvanced(!advanced)}>
          {advanced ? t("Hide advanced") : t("Advanced: search filter and attributes")}
        </button>
        {advanced && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("User filter")} hint={t("{0} — what the user typed. Empty — sAMAccountName, userPrincipalName or mail")}>
              <Input {...f("userFilter")} className="font-mono text-[12px]" placeholder="(&(objectClass=user)(sAMAccountName={0}))" />
            </Field>
            <Field label={t("E-mail attribute")}>
              <Input {...f("emailAttribute")} className="font-mono" placeholder="mail" />
            </Field>
            <Field label={t("Name attribute")}>
              <Input {...f("nameAttribute")} className="font-mono" placeholder="displayName" />
            </Field>
            <Field label={t("Login attribute")}>
              <Input {...f("usernameAttribute")} className="font-mono" placeholder="sAMAccountName" />
            </Field>
          </div>
        )}
        {m.saveLdap.error && <ErrorBox>{errorText(m.saveLdap.error)}</ErrorBox>}
        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={m.saveLdap.isPending}>
              {t("Save")}
            </Button>
            {s.source === "DB" && (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto"
                onClick={() => confirm(t("Remove the directory settings saved here? The values from .env will be used, if any.")) && m.resetLdap.mutate()}
              >
                {t("Reset to .env")}
              </Button>
            )}
          </div>
        )}
      </form>
      <form
        className="space-y-2 border-t border-line-soft p-4"
        onSubmit={(e) => {
          e.preventDefault();
          test.mutate({ login, config: form.url && form.baseDn ? normalized(form) : undefined });
        }}
      >
        <p className="text-[13px] font-medium">{t("Test connection")}</p>
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-[200px] flex-1 font-mono" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t("Login to look up (optional)")} />
          <Button type="submit" disabled={test.isPending || !form.url}>
            {test.isPending ? t("Checking…") : t("Test")}
          </Button>
        </div>
        <p className="text-[12px] text-faint">{t("Tests the values in the form, before saving.")}</p>
        {test.error && <ErrorBox>{errorText(test.error)}</ErrorBox>}
        {r && (
          <div className={cx("rounded-control border px-3 py-2 text-[13px]", r.ok ? "border-ev-nav/30 bg-ev-nav-soft" : "border-ev-error/30 bg-ev-error-soft")}>
            <p className="font-medium">{r.message}</p>
            {r.user && (
              <dl className="mt-2 space-y-1 font-mono text-[12px]">
                <div>{r.user.dn}</div>
                <div>
                  {r.user.username ?? "—"} · {r.user.email} · {r.user.fullName}
                </div>
                {r.user.groups.map((g) => (
                  <div key={g} className="text-muted">
                    {g}
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}
