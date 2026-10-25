import { useState } from "react";
import { errorText } from "../../api/client";
import { usePublicSettings, useReportShare, useShareMutations } from "../../api/hooks";
import type { ReportDetails } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Button, ErrorBox, Input, Modal, Select, Toggle } from "../../components/ui";
import { t } from "../../i18n";
import { formatDateTime, timeAgo } from "../../lib/format";

const DAY_OPTIONS = [1, 7, 14, 30, 60, 90, 180, 365];

/** "Share": a public read-only link that works without signing in, until it expires or is turned off. */
export function ShareButton({ report }: { report: ReportDetails }) {
  const { can } = useAuth();
  const settings = usePublicSettings();
  const share = useReportShare(report.id);
  const [open, setOpen] = useState(false);
  if (!can("report.share") || !settings.data?.sharingEnabled || report.deletedAt) return null;
  const active = !!share.data;
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {active && <span className="size-1.5 rounded-full bg-ev-nav" />}
        {t("Share")}
      </Button>
      {open && <ShareModal report={report} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareModal({ report, onClose }: { report: ReportDetails; onClose: () => void }) {
  const settings = usePublicSettings();
  const share = useReportShare(report.id);
  const m = useShareMutations(report.id);
  const s = share.data;
  const max = settings.data?.sharingMaxDays ?? 90;
  const options = [...new Set([...DAY_OPTIONS.filter((d) => d <= max), settings.data?.sharingDefaultDays ?? 30])].sort((a, b) => a - b);
  const [days, setDays] = useState(settings.data?.sharingDefaultDays ?? 30);
  const [copied, setCopied] = useState(false);
  const error = m.share.error ?? m.revoke.error;

  return (
    <Modal open onClose={onClose} title={t("Share report")} width={520}>
      <div className="space-y-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block font-medium">{t("Anyone with the link can view")}</span>
            <span className="block text-[13px] text-muted">
              {t("No sign-in needed. Read-only: video, console, network and actions; comments and history stay private.")}
            </span>
          </span>
          <Toggle
            checked={!!s}
            disabled={m.share.isPending || m.revoke.isPending}
            onChange={(v) => (v ? m.share.mutate(days) : m.revoke.mutate())}
            label={t("Public link")}
          />
        </label>
        {s && (
          <>
            <div className="flex gap-2">
              <Input readOnly value={s.url} className="font-mono text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
              <Button
                variant="primary"
                onClick={() => {
                  void navigator.clipboard?.writeText(s.url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? t("Copied") : t("Copy")}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-muted">{t("Expires")}</span>
              <b className="font-medium">{formatDateTime(s.expiresAt)}</b>
              <span className="ml-auto flex items-center gap-2">
                <Select className="h-8 w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {options.map((d) => (
                    <option key={d} value={d}>
                      {t("{n} days", { n: d })}
                    </option>
                  ))}
                </Select>
                <Button size="sm" onClick={() => m.share.mutate(days)} disabled={m.share.isPending}>
                  {t("Extend")}
                </Button>
              </span>
            </div>
            <p className="text-[12px] text-faint">
              {t("Created by {name} {when}", { name: s.createdByName ?? "—", when: timeAgo(s.createdAt) })} ·{" "}
              {t("Opened {n} times", { n: s.views })}
              {s.lastViewedAt && <> · {t("last {when}", { when: timeAgo(s.lastViewedAt) })}</>}
            </p>
          </>
        )}
        {!s && (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">{t("Link lifetime")}</span>
            <Select className="h-8 w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {options.map((d) => (
                <option key={d} value={d}>
                  {t("{n} days", { n: d })}
                </option>
              ))}
            </Select>
          </div>
        )}
        {error && <ErrorBox>{errorText(error)}</ErrorBox>}
        <p className="border-t border-line-soft pt-3 text-[12px] text-faint">
          {t("Everyone who has the link can open the report — share it only with people who should see it. Every opening is logged.")}
        </p>
      </div>
    </Modal>
  );
}
