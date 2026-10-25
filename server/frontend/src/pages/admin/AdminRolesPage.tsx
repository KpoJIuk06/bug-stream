import { Fragment, useState } from "react";
import { errorText } from "../../api/client";
import { usePermissions, useRoleMutations, useRoles } from "../../api/hooks";
import type { AppRole } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorBox, Field, Input, Loading, Modal, PageHeader, Textarea } from "../../components/ui";
import { t } from "../../i18n";
import { PERMISSION_CATEGORY_LABEL, PERMISSION_LABEL } from "../../lib/labels";

/**
 * Roles × permissions matrix. A click saves the role at once. The Administrator role always keeps
 * every permission; system roles can be changed but not deleted.
 */
export function AdminRolesPage() {
  const roles = useRoles();
  const perms = usePermissions();
  const m = useRoleMutations();
  const { can } = useAuth();
  const editable = can("role.manage");
  const [editing, setEditing] = useState<AppRole | "new" | null>(null);

  if (roles.isLoading || perms.isLoading) return <Loading />;
  const list = roles.data ?? [];
  const categories = [...new Set((perms.data ?? []).map((p) => p.category))];

  const toggle = (r: AppRole, code: string) => {
    const next = r.permissions.includes(code) ? r.permissions.filter((x) => x !== code) : [...r.permissions, code];
    m.update.mutate({ id: r.id, name: r.name, description: r.description ?? undefined, permissions: next });
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Roles & permissions")}
        subtitle={t("Every user has one role. A role is a set of permissions; changes apply on the user's next request.")}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              {t("New role")}
            </Button>
          )
        }
      />
      {(m.update.error || m.remove.error) && (
        <div className="mb-3">
          <ErrorBox>{errorText(m.update.error ?? m.remove.error)}</ErrorBox>
        </div>
      )}
      <div className="overflow-x-auto rounded-panel border border-line bg-surface">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-surface px-4 py-3 font-medium text-muted">{t("Permission")}</th>
              {list.map((r) => (
                <th key={r.id} className="px-3 py-3 text-center align-bottom">
                  <button
                    className="group inline-flex flex-col items-center disabled:cursor-default"
                    disabled={!editable}
                    onClick={() => setEditing(r)}
                    title={r.description ?? undefined}
                  >
                    <span className="font-semibold text-ink group-enabled:group-hover:text-primary">{r.name}</span>
                    <span className="font-mono text-[11px] font-normal text-faint">{r.code}</span>
                    <span className="text-[11px] font-normal text-faint">{t("{n} users", { n: r.usersCount })}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="bg-fog">
                  <td colSpan={list.length + 1} className="sticky left-0 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">
                    {PERMISSION_CATEGORY_LABEL[cat]}
                  </td>
                </tr>
                {(perms.data ?? [])
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <tr key={p.code} className="border-t border-line-soft hover:bg-fog/60">
                      <td className="sticky left-0 bg-surface px-4 py-2">
                        <span className="block">{PERMISSION_LABEL[p.code] ?? p.code}</span>
                        <span className="font-mono text-[11px] text-faint">{p.code}</span>
                      </td>
                      {list.map((r) => {
                        const on = r.permissions.includes(p.code);
                        const locked = !editable || r.code === "ADMIN";
                        return (
                          <td key={r.id} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary disabled:opacity-60"
                              checked={on}
                              disabled={locked || m.update.isPending}
                              onChange={() => toggle(r, p.code)}
                              aria-label={`${r.name}: ${PERMISSION_LABEL[p.code] ?? p.code}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <RoleModal role={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoleModal({ role, onClose }: { role: AppRole | null; onClose: () => void }) {
  const m = useRoleMutations();
  const [code, setCode] = useState(role?.code ?? "");
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const error = m.create.error ?? m.update.error ?? m.remove.error;
  return (
    <Modal open onClose={onClose} title={role ? role.name : t("New role")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (role) m.update.mutate({ id: role.id, name, description, permissions: role.permissions }, { onSuccess: onClose });
          else m.create.mutate({ code, name, description, permissions: ["report.create"] }, { onSuccess: onClose });
        }}
      >
        {!role && (
          <Field label={t("Code")} hint={t("Latin capital letters, digits and _. Cannot be changed later.")}>
            <Input
              className="font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              pattern="[A-Z][A-Z0-9_]{1,29}"
              required
              autoFocus
              placeholder="SUPPORT"
            />
          </Field>
        )}
        <Field label={t("Name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus={!!role} />
        </Field>
        <Field label={t("Description")}>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <ErrorBox>{errorText(error)}</ErrorBox>}
        <div className="flex items-center justify-end gap-2 pt-2">
          {role && !role.system && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={m.remove.isPending}
              onClick={() => confirm(t("Delete the role \"{name}\"?", { name: role.name })) && m.remove.mutate(role.id, { onSuccess: onClose })}
            >
              {t("Delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={m.create.isPending || m.update.isPending}>
            {role ? t("Save") : t("Create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
