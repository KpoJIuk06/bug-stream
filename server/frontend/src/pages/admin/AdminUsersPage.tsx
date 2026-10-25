import { useState } from "react";
import { errorText } from "../../api/client";
import { useAdminUsers, useAuthAdmin, useAuthConfig, useCreateUser, useInviteUser, useLdapTest, useResetPassword, useRoles, useUpdateUser } from "../../api/hooks";
import type { User } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Pagination } from "../../components/Pagination";
import { Avatar, Button, cx, ErrorBox, Field, Input, Loading, Modal, PageHeader, Select } from "../../components/ui";
import { t } from "../../i18n";
import { timeAgo } from "../../lib/format";
import { AUTH_SOURCE_LABEL } from "../../lib/labels";

export function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [inactive, setInactive] = useState(true);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const users = useAdminUsers(q, role, inactive, page, size);
  const roles = useRoles();
  const auth = useAuthConfig();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [ldapTest, setLdapTest] = useState(false);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Users")}
        subtitle={
          auth.data?.ldapEnabled
            ? t("People sign in with their Active Directory account; the account appears here after the first sign-in. You can also add it in advance to give a role.")
            : t("There is no self sign-up — accounts are created here.")
        }
        actions={
          <>
            {auth.data?.ldapEnabled && <Button onClick={() => setLdapTest(true)}>{t("Check LDAP")}</Button>}
            <Button variant="primary" onClick={() => setCreating(true)}>
              {t("New user")}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          type="search"
          placeholder={t("Search by name, e-mail or login")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
        />
        <Select
          className="w-48"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{t("All roles")}</option>
          {roles.data?.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} className="size-4 accent-primary" />
          {t("Show disabled")}
        </label>
      </div>
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {users.isLoading ? (
          <Loading />
        ) : users.error ? (
          <div className="p-4">
            <ErrorBox>{errorText(users.error)}</ErrorBox>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-line text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("User")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Role")}</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t("Sign-in")}</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">{t("Last sign-in")}</th>
                <th />
              </tr>
            </thead>
            <tbody className={cx("divide-y divide-line-soft", users.isFetching && "opacity-70")}>
              {users.data?.items.map((u) => (
                <tr key={u.id} className={cx(!u.active && "text-faint")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.fullName} size={30} />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {u.fullName} {!u.active && <span className="text-[12px] font-normal">{t("disabled")}</span>}
                          {u.active && u.authSource === "LOCAL" && !u.passwordSet && !u.lastLoginAt && (
                            <span className="ml-1 rounded-full bg-ev-warn-soft px-1.5 py-0.5 text-[11px] font-normal text-ev-warn">{t("invitation pending")}</span>
                          )}
                        </p>
                        <p className="truncate text-[13px] text-muted">
                          {u.email}
                          {u.username && <span className="ml-2 font-mono text-[12px] text-faint">{u.username}</span>}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{u.roleName ?? u.role}</td>
                  <td className="hidden px-4 py-2.5 text-[13px] text-muted md:table-cell">{AUTH_SOURCE_LABEL[u.authSource]}</td>
                  <td className="hidden px-4 py-2.5 text-[13px] text-muted md:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : t("never")}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                      {t("Edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {users.data && <Pagination page={page} size={size} total={users.data.total} onPage={setPage} onSize={(n) => (setSize(n), setPage(0))} />}
      {creating && <CreateUserModal ldap={!!auth.data?.ldapEnabled} onClose={() => setCreating(false)} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      {ldapTest && <LdapTestModal onClose={() => setLdapTest(false)} />}
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const roles = useRoles();
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} required>
      {roles.data?.map((r) => (
        <option key={r.code} value={r.code}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}

function CreateUserModal({ ldap, onClose }: { ldap: boolean; onClose: () => void }) {
  const create = useCreateUser();
  const mailOn = !!useAuthAdmin().data?.mailConfigured;
  const [invite, setInvite] = useState(true);
  const sendInvite = mailOn && invite;
  const [source, setSource] = useState<"LOCAL" | "LDAP">(ldap ? "LDAP" : "LOCAL");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DEVELOPER");
  return (
    <Modal open onClose={onClose} title={t("New user")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(
            {
              email,
              fullName,
              role,
              authSource: source,
              password: source === "LOCAL" && !sendInvite ? password : undefined,
              username: username || undefined,
              invite: source === "LOCAL" && sendInvite,
            },
            { onSuccess: onClose },
          );
        }}
      >
        {ldap && (
          <Field label={t("Sign-in")}>
            <Select value={source} onChange={(e) => setSource(e.target.value as "LOCAL" | "LDAP")}>
              <option value="LDAP">{AUTH_SOURCE_LABEL.LDAP}</option>
              <option value="LOCAL">{AUTH_SOURCE_LABEL.LOCAL}</option>
            </Select>
          </Field>
        )}
        <Field label={t("Full name")}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
        </Field>
        <Field label={t("E-mail")} hint={source === "LDAP" ? t("Must match the e-mail in Active Directory") : undefined}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        {source === "LDAP" && (
          <Field label={t("Login (sAMAccountName)")} hint={t("Optional — filled in automatically on the first sign-in")}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="font-mono" />
          </Field>
        )}
        {source === "LOCAL" && mailOn && (
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span>
              {t("Send an invitation e-mail")}
              <span className="block text-[12px] text-faint">{t("The person sets their own password from the link (valid 7 days).")}</span>
            </span>
          </label>
        )}
        {source === "LOCAL" && !sendInvite && (
          <Field label={t("Password")} hint={t("At least 8 characters. Give it to the person and ask them to change it.")}>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required className="font-mono" />
          </Field>
        )}
        <Field label={t("Role")}>
          <RoleSelect value={role} onChange={setRole} />
        </Field>
        {create.error && <ErrorBox>{errorText(create.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t("Create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const update = useUpdateUser();
  const invite = useInviteUser();
  const mailOn = !!useAuthAdmin().data?.mailConfigured;
  const reset = useResetPassword();
  const { user: me } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active);
  const [pwd, setPwd] = useState("");
  const [done, setDone] = useState(false);
  return (
    <Modal open onClose={onClose} title={user.fullName}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ id: user.id, fullName, role, active }, { onSuccess: onClose });
        }}
      >
        <p className="text-[13px] text-muted">
          {user.email} · {AUTH_SOURCE_LABEL[user.authSource]}
          {user.username && <span className="font-mono"> · {user.username}</span>}
        </p>
        <Field label={t("Full name")} hint={user.authSource === "LDAP" ? t("Updated from Active Directory on every sign-in") : undefined}>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label={t("Role")}>
          <RoleSelect value={role} onChange={setRole} />
        </Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={active} disabled={user.id === me?.id} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-primary" />
          {t("Active — can sign in")}
        </label>
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
      {user.authSource === "LOCAL" && (
        <form
          className="mt-5 space-y-2 border-t border-line-soft pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate({ id: user.id, newPassword: pwd }, { onSuccess: () => (setDone(true), setPwd("")) });
          }}
        >
          <p className="text-[13px] font-medium">{t("Reset password")}</p>
          <div className="flex gap-2">
            <Input value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={8} required placeholder={t("New password")} className="font-mono" />
            <Button type="submit" disabled={reset.isPending}>
              {t("Reset")}
            </Button>
          </div>
          {done && <p className="text-[13px] text-ev-nav">{t("Password changed; the user is signed out everywhere.")}</p>}
          {reset.error && <ErrorBox>{errorText(reset.error)}</ErrorBox>}
          {mailOn && user.active && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button type="button" size="sm" disabled={invite.isPending} onClick={() => invite.mutate(user.id)}>
                {user.passwordSet ? t("E-mail a link to set a new password") : t("Send the invitation again")}
              </Button>
              {invite.isSuccess && <span className="text-[13px] text-ev-nav">{t("Sent to {email}", { email: user.email })}</span>}
            </div>
          )}
          {invite.error && <ErrorBox>{errorText(invite.error)}</ErrorBox>}
        </form>
      )}
    </Modal>
  );
}

function LdapTestModal({ onClose }: { onClose: () => void }) {
  const test = useLdapTest();
  const [login, setLogin] = useState("");
  const r = test.data;
  return (
    <Modal open onClose={onClose} title={t("Check LDAP")} width={560}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          test.mutate(login);
        }}
      >
        <Field label={t("Login or e-mail")} hint={t("Empty — only check that the service account can connect")}>
          <div className="flex gap-2">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} className="font-mono" />
            <Button type="submit" disabled={test.isPending}>
              {t("Check")}
            </Button>
          </div>
        </Field>
        {test.error && <ErrorBox>{errorText(test.error)}</ErrorBox>}
        {r && (
          <div className={cx("rounded-control border px-3 py-2 text-[13px]", r.ok ? "border-ev-nav/30 bg-ev-nav-soft" : "border-ev-error/30 bg-ev-error-soft")}>
            <p className="font-medium">{r.message}</p>
            {r.user && (
              <dl className="mt-2 space-y-1">
                <Row k="DN" v={r.user.dn} />
                <Row k={t("Login")} v={r.user.username ?? "—"} />
                <Row k={t("E-mail")} v={r.user.email} />
                <Row k={t("Name")} v={r.user.fullName} />
                <Row k={t("Groups")} v={r.user.groups.length ? r.user.groups.join("\n") : "—"} />
              </dl>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="whitespace-pre-wrap break-all font-mono text-[12px]">{v}</dd>
    </div>
  );
}
