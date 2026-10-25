import { useState } from "react";
import { useNavigate } from "react-router";
import { useNotificationPrefs, useNotifications, useReadNotifications, useUnreadCount, useUpdateNotificationPrefs } from "../api/hooks";
import type { AppNotification, NotificationType } from "../api/types";
import { t } from "../i18n";
import { timeAgo } from "../lib/format";
import { STATUS_LABEL } from "../lib/labels";
import { cx, Spinner } from "./ui";

const TYPE_LABEL: Record<NotificationType, string> = {
  MENTION: "Mention",
  ASSIGNED: "Assigned",
  STATUS_CHANGED: "Status",
  COMMENT: "Comment",
  REPORT_CREATED: "New report",
};

const TYPE_TEXT: Record<NotificationType, string> = {
  MENTION: '{actor} mentioned you in "{title}"',
  ASSIGNED: '{actor} assigned you to "{title}"',
  STATUS_CHANGED: '{actor} changed the status of "{title}"',
  COMMENT: '{actor} commented on "{title}"',
  REPORT_CREATED: '{actor} created the report "{title}"',
};

const ENGLISH_STATUS: Record<string, string> = {
  New: "NEW",
  "In progress": "IN_PROGRESS",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
  Rejected: "REJECTED",
};

/** The line is built in the interface language; old notifications without a report title keep their text. */
function headline(n: AppNotification): string {
  if (!n.reportTitle || !n.actorName) return n.title;
  return t(TYPE_TEXT[n.type], { actor: n.actorName, title: n.reportTitle });
}

function details(n: AppNotification): string | null {
  if (n.type === "STATUS_CHANGED" && n.body?.includes(" → ")) {
    return n.body
      .split(" → ")
      .map((s) => (ENGLISH_STATUS[s] ? STATUS_LABEL[ENGLISH_STATUS[s]] : s))
      .join(" → ");
  }
  return n.body;
}

/** Bell in the top bar: unread notifications and the e-mail setting. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const count = useUnreadCount();
  const unread = count.data ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-9 place-items-center rounded-control text-muted hover:bg-line-soft hover:text-ink"
        aria-label={unread ? t("Notifications: {n} unread", { n: unread }) : t("Notifications")}
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.25 1.5H3.25z" />
          <path d="M7.25 15.5a1.9 1.9 0 0 0 3.5 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ev-error px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <Panel onClose={() => setOpen(false)} unread={unread} />
        </>
      )}
    </div>
  );
}

function Panel({ onClose, unread }: { onClose: () => void; unread: number }) {
  const list = useNotifications(true);
  const read = useReadNotifications();
  const navigate = useNavigate();

  const openItem = (n: AppNotification) => {
    if (!n.readAt) read.one.mutate(n.id);
    onClose();
    if (n.reportId) navigate(`/reports/${n.reportId}`);
  };

  return (
    <div className="fixed inset-x-2 top-14 z-20 mt-1 max-h-[calc(100dvh-72px)] overflow-hidden rounded-panel border border-line bg-surface shadow-[0_16px_40px_-12px_rgba(24,32,44,0.3)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[380px]">
      <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2.5">
        <h2 className="mr-auto text-[14px] font-semibold">{t("Notifications")}</h2>
        {unread > 0 && (
          <button className="text-[13px] text-primary hover:underline disabled:opacity-50" disabled={read.all.isPending} onClick={() => read.all.mutate()}>
            {t("Mark all read")}
          </button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {list.isLoading ? (
          <div className="grid h-24 place-items-center">
            <Spinner />
          </div>
        ) : !list.data?.length ? (
          <p className="px-4 py-8 text-center text-[13px] text-faint">
            {t("Mentions, reports assigned to you and replies to your reports will appear here.")}
          </p>
        ) : (
          <ul>
            {list.data.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={cx("flex w-full gap-3 border-b border-line-soft px-4 py-2.5 text-left hover:bg-fog", !n.readAt && "bg-primary-soft/40")}
                >
                  <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2 text-[12px] text-faint">
                      <span className="font-medium text-muted">{t(TYPE_LABEL[n.type])}</span>
                      <span className="ml-auto shrink-0">{timeAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink">{headline(n)}</span>
                    {details(n) && <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-muted">{details(n)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <EmailToggle />
    </div>
  );
}

function EmailToggle() {
  const prefs = useNotificationPrefs(true);
  const update = useUpdateNotificationPrefs();
  if (!prefs.data) return null;
  const { emailNotifications, emailConfigured } = prefs.data;
  return (
    <label className="flex cursor-pointer items-start gap-2.5 border-t border-line-soft bg-fog px-4 py-2.5 text-[13px]">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={emailNotifications}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ emailNotifications: e.target.checked })}
      />
      <span>
        {t("Send by e-mail")}
        <span className="block text-[12px] text-faint">
          {emailConfigured ? t("The same notifications by e-mail.") : t("E-mail is not configured on the server yet (SMTP in .env) — notifications only on the site.")}
        </span>
      </span>
    </label>
  );
}
