import { useState } from "react";
import { errorText } from "../../api/client";
import { useEnvironmentMutations, useEnvironments } from "../../api/hooks";
import type { Environment } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { EnvBadge } from "../../components/EnvBadge";
import { Button, cx, ErrorBox, Field, Input, Loading, Modal, PageHeader } from "../../components/ui";
import { t } from "../../i18n";

const PALETTE = ["#64748b", "#2563eb", "#0d9488", "#16a34a", "#7c3aed", "#d97706", "#ea580c", "#dc2626"];

/** Environments for reports and services: DEV, TEST, STAGE, PROD and your own. */
export function AdminEnvironmentsPage() {
  const envs = useEnvironments(true);
  const m = useEnvironmentMutations();
  const { can } = useAuth();
  const editable = can("environment.manage");
  const [editing, setEditing] = useState<Environment | "new" | null>(null);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6">
      <PageHeader
        title={t("Environments")}
        subtitle={t("Shown in the extension, on reports and in filters, and sent to Jira as a label. A used environment can be hidden but not deleted.")}
        actions={
          editable && (
            <Button variant="primary" onClick={() => setEditing("new")}>
              {t("New environment")}
            </Button>
          )
        }
      />
      {(m.update.error || m.remove.error) && (
        <div className="mb-3">
          <ErrorBox>{errorText(m.update.error ?? m.remove.error)}</ErrorBox>
        </div>
      )}
      <div className="overflow-hidden rounded-panel border border-line bg-surface">
        {envs.isLoading ? (
          <Loading />
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line text-[12px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("Environment")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Code")}</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("Services")}</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">{t("Reports")}</th>
                <th className="px-4 py-2.5 font-medium">{t("Shown")}</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {envs.data?.map((e) => (
                <tr key={e.code} className={cx(!e.active && "text-faint")}>
                  <td className="px-4 py-2.5">
                    <EnvBadge env={e.code} />
                  </td>
                  <td className="px-4 py-2.5 font-mono">{e.code}</td>
                  <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{e.servicesCount}</td>
                  <td className="hidden px-4 py-2.5 tabular-nums sm:table-cell">{e.reportsCount}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={e.active}
                      disabled={!editable || m.update.isPending}
                      onChange={() => m.update.mutate({ code: e.code, name: e.name, color: e.color, sortOrder: e.sortOrder, active: !e.active })}
                      aria-label={t("Shown in pickers")}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editable && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                        {t("Edit")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <EnvModal env={editing === "new" ? null : editing} nextOrder={((envs.data?.at(-1)?.sortOrder ?? 0) + 10)} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EnvModal({ env, nextOrder, onClose }: { env: Environment | null; nextOrder: number; onClose: () => void }) {
  const m = useEnvironmentMutations();
  const [code, setCode] = useState(env?.code ?? "");
  const [name, setName] = useState(env?.name ?? "");
  const [color, setColor] = useState(env?.color ?? PALETTE[4]);
  const [sortOrder, setSortOrder] = useState(env?.sortOrder ?? nextOrder);
  const error = m.create.error ?? m.update.error ?? m.remove.error;
  const used = !!env && (env.servicesCount > 0 || env.reportsCount > 0);
  return (
    <Modal open onClose={onClose} title={env ? env.name : t("New environment")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (env) m.update.mutate({ code: env.code, name, color, sortOrder, active: env.active }, { onSuccess: onClose });
          else m.create.mutate({ code, name, color, sortOrder }, { onSuccess: onClose });
        }}
      >
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label={t("Name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="UAT" />
          </Field>
          <Field label={t("Code")}>
            <Input
              className="font-mono"
              value={code}
              disabled={!!env}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
              pattern="[A-Z][A-Z0-9_]{0,19}"
              required
              placeholder="UAT"
            />
          </Field>
        </div>
        <Field label={t("Color")}>
          <div className="flex flex-wrap items-center gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cx("size-7 rounded-full border-2", color === c ? "border-ink" : "border-transparent")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10 cursor-pointer rounded border border-line" />
          </div>
        </Field>
        <Field label={t("Order")} hint={t("Smaller numbers come first")}>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-32" />
        </Field>
        <p className="text-[12px] text-faint">{t("Jira label: {label}", { label: `env-${(code || "code").toLowerCase()}` })}</p>
        {error && <ErrorBox>{errorText(error)}</ErrorBox>}
        <div className="flex items-center justify-end gap-2 pt-2">
          {env && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              disabled={used || m.remove.isPending}
              title={used ? t("Used by services or reports — hide it instead") : undefined}
              onClick={() => confirm(t("Delete the environment \"{name}\"?", { name: env.name })) && m.remove.mutate(env.code, { onSuccess: onClose })}
            >
              {t("Delete")}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={m.create.isPending || m.update.isPending}>
            {env ? t("Save") : t("Create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
