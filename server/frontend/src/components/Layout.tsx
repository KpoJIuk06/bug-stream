import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { errorText } from "../api/client";
import { useChangePassword, useSetLocale } from "../api/hooks";
import { useAuth } from "../auth/AuthContext";
import { LOCALES, t, useI18n, type Locale } from "../i18n";
import { JiraNotice } from "./JiraNotice";
import { NotificationBell } from "./Notifications";
import { Avatar, Button, cx, ErrorBox, Field, Input, Modal } from "./ui";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
      <img src="/favicon.svg" alt="" className="size-6" />
      <span className={compact ? "hidden sm:inline" : undefined}>Bug Stream</span>
    </span>
  );
}

// ----------------------------- icons (16px, stroke) -----------------------------

const icon = (d: ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
export const Icons = {
  dashboard: icon(
    <>
      <rect x="2" y="2" width="5" height="6" rx="1" />
      <rect x="9" y="2" width="5" height="3.5" rx="1" />
      <rect x="9" y="7.5" width="5" height="6.5" rx="1" />
      <rect x="2" y="10" width="5" height="4" rx="1" />
    </>,
  ),
  reports: icon(
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M6.5 6.2v3.6L9.6 8z" />
    </>,
  ),
  mine: icon(
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5c.8-2.3 2.7-3.5 5-3.5s4.2 1.2 5 3.5" />
    </>,
  ),
  assigned: icon(
    <>
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c.7-2.2 2.4-3.5 4.5-3.5 1 0 1.9.3 2.6.8" />
      <path d="M10 11.5l1.5 1.5 3-3" />
    </>,
  ),
  projects: icon(
    <>
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3l1.5 1.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
    </>,
  ),
  overview: icon(
    <>
      <path d="M2 13.5h12" />
      <path d="M4 11V7M8 11V3.5M12 11V8.5" />
    </>,
  ),
  users: icon(
    <>
      <circle cx="6" cy="5.5" r="2.3" />
      <path d="M1.8 13.3c.7-2 2.3-3.2 4.2-3.2s3.5 1.2 4.2 3.2" />
      <path d="M10.5 3.6a2.2 2.2 0 0 1 0 4M12 10.3c1.1.4 1.9 1.4 2.2 3" />
    </>,
  ),
  roles: icon(
    <>
      <path d="M8 1.8l5 2v4c0 3-2.2 5.4-5 6.4-2.8-1-5-3.4-5-6.4v-4z" />
      <path d="M5.8 8l1.5 1.5 3-3" />
    </>,
  ),
  environments: icon(
    <>
      <rect x="2" y="2.5" width="12" height="4" rx="1" />
      <rect x="2" y="9.5" width="12" height="4" rx="1" />
      <path d="M4.5 4.5h.01M4.5 11.5h.01" />
    </>,
  ),
  jira: icon(
    <>
      <path d="M8 1.8l6.2 6.2L8 14.2 1.8 8z" />
      <path d="M8 5.2L10.8 8 8 10.8 5.2 8z" />
    </>,
  ),
  settings: icon(
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7L3.4 3.4" />
    </>,
  ),
  audit: icon(
    <>
      <path d="M4 1.8h6l2.5 2.5v9.9H4z" />
      <path d="M6.2 7h4M6.2 9.5h4M6.2 12h2.5" />
    </>,
  ),
  menu: icon(<path d="M2 4h12M2 8h12M2 12h12" />),
  signin: icon(
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
      <path d="M8 10v1.5" />
    </>,
  ),
  mail: icon(
    <>
      <rect x="1.8" y="3.5" width="12.4" height="9" rx="1.5" />
      <path d="M2.3 4.3L8 8.6l5.7-4.3" />
    </>,
  ),
  slack: icon(
    <>
      <path d="M6 2.5v5M10 8.5v5M2.5 10h5M8.5 6h5" />
      <path d="M6 2.5a1 1 0 0 0-1 1v0a1 1 0 0 0 1 1M10 13.5a1 1 0 0 0 1-1M2.5 10a1 1 0 0 0 1 1M13.5 6a1 1 0 0 0-1-1" />
    </>,
  ),
};

// ----------------------------- layout -----------------------------

type NavEntry = { to: string; label: string; icon: ReactNode; end?: boolean; show?: boolean };

export function Layout() {
  const { user, can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname, location.search]);

  const main: NavEntry[] = [
    { to: "/", label: t("Dashboard"), icon: Icons.dashboard, end: true },
    { to: "/reports", label: t("All reports"), icon: Icons.reports, end: true },
    { to: "/reports/mine", label: t("My reports"), icon: Icons.mine },
    { to: "/reports/assigned", label: t("Assigned to me"), icon: Icons.assigned },
    { to: "/projects", label: t("Projects"), icon: Icons.projects },
  ];
  const admin: NavEntry[] = [
    { to: "/admin", label: t("Overview"), icon: Icons.overview, end: true },
    { to: "/admin/users", label: t("Users"), icon: Icons.users, show: can("user.manage") },
    { to: "/admin/roles", label: t("Roles & permissions"), icon: Icons.roles },
    { to: "/admin/environments", label: t("Environments"), icon: Icons.environments },
    { to: "/admin/sign-in", label: t("Sign-in methods"), icon: Icons.signin },
    { to: "/admin/email", label: t("E-mail (SMTP)"), icon: Icons.mail },
    { to: "/admin/jira", label: t("Jira"), icon: Icons.jira, show: can("integration.manage") },
    { to: "/admin/slack", label: t("Slack"), icon: Icons.slack, show: can("integration.manage") },
    { to: "/admin/settings", label: t("Settings"), icon: Icons.settings },
    { to: "/admin/audit", label: t("Audit log"), icon: Icons.audit, show: can("audit.view") },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">
        <NavLink to="/" aria-label="Bug Stream">
          <Logo />
        </NavLink>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <NavGroup items={main} />
        {can("admin.access") && <NavGroup title={t("Administration")} items={admin} />}
      </nav>
      <SidebarFooter />
    </div>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface md:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur md:px-6">
          <button className="grid size-9 place-items-center rounded-control text-muted hover:bg-line-soft md:hidden" onClick={() => setMobileOpen(true)} aria-label={t("Menu")}>
            {Icons.menu}
          </button>
          <span className="md:hidden">
            <Logo compact />
          </span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <span className="hidden text-[13px] text-muted lg:inline">{user?.fullName}</span>
          </div>
        </header>
        <JiraNotice />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavGroup({ title, items }: { title?: string; items: NavEntry[] }) {
  return (
    <div className="mt-3 first:mt-1">
      {title && <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{title}</p>}
      <ul className="space-y-0.5">
        {items
          .filter((i) => i.show !== false)
          .map((i) => (
            <li key={i.to}>
              <NavLink
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cx(
                    "flex h-8 items-center gap-2.5 rounded-control px-2.5 text-[13.5px] transition-colors",
                    isActive ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-line-soft hover:text-ink",
                  )
                }
              >
                {i.icon}
                <span className="truncate">{i.label}</span>
              </NavLink>
            </li>
          ))}
      </ul>
    </div>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [pwd, setPwd] = useState(false);
  return (
    <div className="relative shrink-0 border-t border-line-soft p-2">
      <LanguageSwitch />
      <button onClick={() => setMenu((v) => !v)} className="mt-1 flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left hover:bg-line-soft" aria-expanded={menu}>
        <Avatar name={user?.fullName ?? "?"} size={28} />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-medium">{user?.fullName}</span>
          <span className="block truncate text-[12px] text-faint">{user?.roleName ?? user?.role}</span>
        </span>
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute bottom-full left-2 right-2 z-20 mb-1 rounded-control border border-line bg-surface py-1 shadow-[0_10px_30px_-10px_rgba(24,32,44,0.25)]">
            <p className="truncate px-3 py-1.5 text-[12px] text-faint">{user?.email}</p>
            <NavLink to="/profile" className="block w-full px-3 py-1.5 text-left hover:bg-line-soft" onClick={() => setMenu(false)}>
              {t("My profile")}
            </NavLink>
            {user?.authSource === "LOCAL" && (
              <button
                className="block w-full px-3 py-1.5 text-left hover:bg-line-soft"
                onClick={() => {
                  setMenu(false);
                  setPwd(true);
                }}
              >
                {t("Change password")}
              </button>
            )}
            <button className="block w-full px-3 py-1.5 text-left text-ev-error hover:bg-line-soft" onClick={() => logout()}>
              {t("Sign out")}
            </button>
          </div>
        </>
      )}
      <ChangePasswordModal open={pwd} onClose={() => setPwd(false)} />
    </div>
  );
}

/** Interface language; saved in the user's profile so the extension and e-mails can follow it. */
export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const { user, setUser } = useAuth();
  const save = useSetLocale();
  return (
    <div className={cx("flex items-center gap-1", compact ? "" : "px-1")} role="group" aria-label={t("Language")}>
      {LOCALES.map((l) => (
        <button
          key={l.code}
          title={l.label}
          onClick={() => {
            setLocale(l.code as Locale);
            if (user) save.mutate(l.code as Locale, { onSuccess: (u) => setUser(u) });
          }}
          className={cx(
            "h-7 flex-1 rounded-[6px] px-2 text-[12px] font-medium uppercase",
            locale === l.code ? "bg-ink text-white" : "text-muted hover:bg-line-soft",
          )}
          aria-pressed={locale === l.code}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const change = useChangePassword();
  const { logout, user } = useAuth();
  const hasPassword = user?.passwordSet !== false;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={hasPassword ? t("Change password") : t("Set a password")}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate(
            { currentPassword: hasPassword ? current : undefined, newPassword: next },
            { onSuccess: () => logout() }, // the server ends all sessions — sign in again
          );
        }}
      >
        {hasPassword && (
          <Field label={t("Current password")}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </Field>
        )}
        <Field label={t("New password")} hint={t("At least 8 characters. You will need to sign in again on all devices.")}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
        </Field>
        {change.error && <ErrorBox>{errorText(change.error)}</ErrorBox>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={change.isPending}>
            {t("Change password")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
