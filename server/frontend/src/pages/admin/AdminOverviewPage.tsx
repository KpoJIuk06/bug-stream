import type { ReactNode } from "react";
import { Link } from "react-router";
import { useAdminOverview } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";
import { Card, Loading, PageHeader } from "../../components/ui";
import { t } from "../../i18n";
import { formatBytes, formatNumber } from "../../lib/format";

export function AdminOverviewPage() {
  const o = useAdminOverview();
  const { can } = useAuth();
  if (o.isLoading || !o.data) return <Loading />;
  const d = o.data;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
      <PageHeader title={t("Administration")} subtitle={t("System state and quick links.")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("Active users")} value={formatNumber(d.activeUsers)} note={t("{n} total", { n: d.users })} />
        <Stat label={t("Projects")} value={formatNumber(d.projects)} />
        <Stat label={t("Reports")} value={formatNumber(d.reports)} note={t("+{n} in 7 days", { n: d.reportsLast7Days })} />
        <Stat label={t("Storage used")} value={formatBytes(d.storageBytes)} note={t("videos, screenshots, files")} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title={t("Connections")}>
          <ul className="divide-y divide-line-soft text-[13px]">
            <Status ok={d.ldapEnabled} label={t("Active Directory / LDAP sign-in")} on={t("On — {n} directory users", { n: d.ldapUsers })} off={t("Not configured — Administration → Sign-in methods")} />
            <Status ok={d.mailEnabled} label={t("E-mail (SMTP)")} on={t("On")} off={t("Not configured — Administration → E-mail (SMTP)")} />
            <li className="flex justify-between gap-3 px-4 py-2.5">
              <span className="text-muted">{t("Public address")}</span>
              <span className="font-mono">{d.publicUrl}</span>
            </li>
          </ul>
        </Card>
        <Card title={t("Manage")}>
          <ul className="grid grid-cols-2 gap-2 p-3 text-[13px]">
            {can("user.manage") && <QuickLink to="/admin/users">{t("Users")}</QuickLink>}
            <QuickLink to="/admin/roles">{t("Roles & permissions")}</QuickLink>
            <QuickLink to="/admin/environments">{t("Environments")}</QuickLink>
            {can("integration.manage") && <QuickLink to="/admin/jira">{t("Jira")}</QuickLink>}
            <QuickLink to="/admin/settings">{t("Settings")}</QuickLink>
            {can("audit.view") && <QuickLink to="/admin/audit">{t("Audit log")}</QuickLink>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-4 py-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
      {note && <p className="text-[12px] text-faint">{note}</p>}
    </div>
  );
}

function Status({ ok, label, on, off }: { ok: boolean; label: string; on: string; off: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-muted">{label}</span>
      <span className={ok ? "text-ev-nav" : "text-faint"}>
        <span className={`mr-1.5 inline-block size-2 rounded-full ${ok ? "bg-ev-nav" : "bg-line"}`} />
        {ok ? on : off}
      </span>
    </li>
  );
}

function QuickLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="block rounded-control border border-line-soft px-3 py-2 hover:border-primary hover:text-primary">
        {children}
      </Link>
    </li>
  );
}
